import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurAdmin } from "../../../../lib/auth-serveur";
import { controlerPin } from "../../../../lib/pin-serveur";
import { notifier } from "../../../../lib/notifications";

/*
  Gestion MANUELLE des séquestres par l'équipe (admin / équipe).

  GET  → liste des séquestres encore bloqués ("retenu" ou "litige"),
         avec acheteur, vendeur, produit, montants et état du code de
         livraison, pour décider en connaissance de cause.
  POST → { sequestreId, action: "liberer" | "rembourser", pin, note }
         - "liberer"   : le vendeur reçoit (montant produit - commission),
                         la commande passe à "livre".
         - "rembourser": l'acheteur est remboursé (montant payé moins
                         le cashback déjà crédité), la commande passe à
                         "annule", le stock est restitué.
         Réservé au rôle admin/équipe, PIN de l'admin revérifié côté
         serveur, verrou atomique anti-double-traitement, action tracée
         dans journal_securite (voir migration_admin_sequestres.sql).
*/
const STATUTS_TRAITABLES = ["retenu", "litige"];

export async function GET(req) {
  try {
    const admin = await utilisateurAdmin(req);
    if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

    const { data: sequestres, error } = await supabaseAdmin
      .from("sequestres")
      .select("id, commande_id, montant_produit, frais_protection_acheteur, statut, date_paiement, date_limite_confirmation")
      .in("statut", STATUTS_TRAITABLES)
      .order("date_paiement", { ascending: true })
      .limit(300);
    if (error) throw error;
    if (!sequestres?.length) return NextResponse.json({ sequestres: [] });

    const commandeIds = sequestres.map((s) => s.commande_id);
    const { data: commandes } = await supabaseAdmin
      .from("commandes")
      .select("id, client_id, vendeur_id, produit_id, quantite, montant_total, commission_appliquee, statut")
      .in("id", commandeIds);
    const parId = Object.fromEntries((commandes || []).map((c) => [c.id, c]));

    const clientIds = [...new Set((commandes || []).map((c) => c.client_id))];
    const vendeurIds = [...new Set((commandes || []).map((c) => c.vendeur_id))];
    const produitIds = [...new Set((commandes || []).map((c) => c.produit_id))];
    const [{ data: clients }, { data: vendeurs }, { data: produits }, { data: codes }] = await Promise.all([
      supabaseAdmin.from("users").select("id, nom").in("id", clientIds),
      supabaseAdmin.from("vendeurs").select("id, user_id, nom_boutique").in("id", vendeurIds),
      supabaseAdmin.from("produits").select("id, nom").in("id", produitIds),
      supabaseAdmin.from("codes_livraison").select("commande_id, bloque, tentatives, date_validation").in("commande_id", commandeIds),
    ]);
    const mapClients = Object.fromEntries((clients || []).map((u) => [u.id, u.nom]));
    const mapVendeurs = Object.fromEntries((vendeurs || []).map((v) => [v.id, v.nom_boutique]));
    const mapProduits = Object.fromEntries((produits || []).map((p) => [p.id, p.nom]));
    const mapCodes = Object.fromEntries((codes || []).map((c) => [c.commande_id, c]));

    return NextResponse.json({
      sequestres: sequestres.map((s) => {
        const c = parId[s.commande_id] || {};
        const code = mapCodes[s.commande_id];
        const commission = Number(c.commission_appliquee || 0);
        return {
          id: s.id,
          statut: s.statut,
          datePaiement: s.date_paiement,
          dateLimite: s.date_limite_confirmation,
          montantProduit: Number(s.montant_produit),
          fraisProtection: Number(s.frais_protection_acheteur),
          montantTotal: Number(c.montant_total || 0),
          commission,
          netVendeur: Math.max(0, Number(s.montant_produit) - commission),
          commandeStatut: c.statut || null,
          acheteur: mapClients[c.client_id] || "—",
          vendeur: mapVendeurs[c.vendeur_id] || "—",
          produit: mapProduits[c.produit_id] || "—",
          quantite: c.quantite || 1,
          codeLivraison: code ? { bloque: !!code.bloque, tentatives: code.tentatives || 0, valide: !!code.date_validation } : null,
        };
      }),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur serveur." }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const admin = await utilisateurAdmin(req);
    if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

    const { sequestreId, action, pin, note } = await req.json();
    if (!sequestreId || !["liberer", "rembourser"].includes(action)) {
      return NextResponse.json({ error: "sequestreId et action (liberer | rembourser) requis." }, { status: 400 });
    }
    const verifPin = await controlerPin(admin.id, pin);
    if (!verifPin.ok) {
      return NextResponse.json({ error: verifPin.error, tentativesRestantes: verifPin.tentativesRestantes }, { status: verifPin.status });
    }

    const { data: sequestre } = await supabaseAdmin
      .from("sequestres")
      .select("id, commande_id, montant_produit, statut")
      .eq("id", sequestreId)
      .single();
    if (!sequestre) return NextResponse.json({ error: "Séquestre introuvable." }, { status: 404 });
    if (!STATUTS_TRAITABLES.includes(sequestre.statut)) {
      return NextResponse.json({ error: "Ce séquestre a déjà été traité." }, { status: 400 });
    }
    const { data: commande } = await supabaseAdmin
      .from("commandes")
      .select("id, client_id, vendeur_id, produit_id, variante_id, quantite, montant_total, commission_appliquee, cashback_credite")
      .eq("id", sequestre.commande_id)
      .single();
    if (!commande) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });

    // Verrou atomique : ne réussit que si le séquestre est encore "retenu"
    // ou "litige" pile maintenant (même principe que valider-code,
    // confirmer-reception et annuler).
    const nouveauStatut = action === "liberer" ? "libere_manuel" : "annule";
    const { data: verrou, error: erreurVerrou } = await supabaseAdmin
      .from("sequestres")
      .update({ statut: nouveauStatut, date_liberation: new Date().toISOString() })
      .eq("id", sequestre.id)
      .in("statut", STATUTS_TRAITABLES)
      .select()
      .single();
    if (erreurVerrou || !verrou) {
      return NextResponse.json({ error: "Ce séquestre a déjà été traité." }, { status: 400 });
    }
    const annulerVerrou = () => supabaseAdmin.from("sequestres").update({ statut: sequestre.statut, date_liberation: null }).eq("id", sequestre.id);

    const { data: vendeurRow } = await supabaseAdmin.from("vendeurs").select("user_id, nb_ventes").eq("id", commande.vendeur_id).single();

    if (action === "liberer") {
      const montantVendeur = Math.max(0, Number(sequestre.montant_produit) - Number(commande.commission_appliquee || 0));
      if (!vendeurRow?.user_id) {
        await annulerVerrou();
        return NextResponse.json({ error: "Vendeur introuvable." }, { status: 404 });
      }
      const { error: erreurCredit } = await supabaseAdmin.rpc("crediter_wallet_atomique", { p_user_id: vendeurRow.user_id, p_montant: montantVendeur });
      if (erreurCredit) {
        await annulerVerrou();
        throw erreurCredit;
      }
      await supabaseAdmin.from("transactions_wallet").insert({ user_id: vendeurRow.user_id, type: "recharge", montant: montantVendeur, statut: "reussi" });
      await supabaseAdmin.from("vendeurs").update({ nb_ventes: (vendeurRow.nb_ventes || 0) + 1 }).eq("id", commande.vendeur_id);
      await supabaseAdmin.from("commandes").update({ statut: "livre" }).eq("id", commande.id);
      await supabaseAdmin.from("codes_livraison").update({ date_validation: new Date().toISOString() }).eq("commande_id", commande.id).is("date_validation", null);
      await notifier(supabaseAdmin, { user_id: vendeurRow.user_id, type: "commande", texte: "L'équipe TEKÇA a libéré le paiement d'une de vos commandes : le montant est sur votre portefeuille." });
      await notifier(supabaseAdmin, { user_id: commande.client_id, type: "commande", texte: "L'équipe TEKÇA a clôturé votre commande et libéré le paiement au vendeur." });
    } else {
      // Remboursement : montant payé moins le cashback déjà crédité à l'achat
      // (sinon l'acheteur Premium garderait son cashback sur une vente annulée).
      const montantRembourse = Math.max(0, Number(commande.montant_total) - Number(commande.cashback_credite || 0));
      const { error: erreurCredit } = await supabaseAdmin.rpc("crediter_wallet_atomique", { p_user_id: commande.client_id, p_montant: montantRembourse });
      if (erreurCredit) {
        await annulerVerrou();
        throw erreurCredit;
      }
      await supabaseAdmin.from("transactions_wallet").insert({ user_id: commande.client_id, type: "remboursement", montant: montantRembourse, statut: "reussi" });
      await supabaseAdmin.from("commandes").update({ statut: "annule" }).eq("id", commande.id);
      if (commande.variante_id) {
        await supabaseAdmin.rpc("incrementer_stock_variante", { p_variante_id: commande.variante_id, p_quantite: commande.quantite });
      } else {
        const { data: produit } = await supabaseAdmin.from("produits").select("stock_global").eq("id", commande.produit_id).single();
        if (produit?.stock_global !== null && produit?.stock_global !== undefined) {
          await supabaseAdmin.rpc("incrementer_stock_global", { p_produit_id: commande.produit_id, p_quantite: commande.quantite });
        }
      }
      await notifier(supabaseAdmin, { user_id: commande.client_id, type: "commande", texte: "L'équipe TEKÇA vous a remboursé une commande : le montant est de retour sur votre portefeuille." });
      if (vendeurRow?.user_id) {
        await notifier(supabaseAdmin, { user_id: vendeurRow.user_id, type: "commande", texte: "L'équipe TEKÇA a remboursé l'acheteur d'une de vos commandes." });
      }
    }

    // Trace de l'action (qui, quoi, pourquoi). Ne bloque jamais l'opération
    // si l'enregistrement échoue (ex. migration_admin_sequestres.sql pas
    // encore appliquée).
    try {
      await supabaseAdmin.from("journal_securite").insert({
        user_id: admin.id,
        type: "admin_sequestre",
        details: `action=${action};sequestre=${sequestre.id};commande=${commande.id};note=${String(note || "").slice(0, 300)}`,
      });
    } catch (e) {
      console.error("Journal admin_sequestre non enregistré :", e);
    }
    return NextResponse.json({ succes: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur serveur." }, { status: 500 });
  }
}
