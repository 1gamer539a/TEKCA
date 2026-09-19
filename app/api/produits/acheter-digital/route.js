import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { tauxCommissionVendeur, tauxCashbackAcheteur } from "../../../../lib/commission";
import { notifierPlusieurs } from "../../../../lib/notifications";

/*
  Achat instantané d'un produit du Coffre-fort numérique
  (recharge_jeu / abonnement_service / ebook / template, avec
  via_coffre_fort = true).

  Différences volontaires avec /api/commandes/creer (produits
  physiques) :
  - AUCUN séquestre : le vendeur est crédité immédiatement (moins la
    commission de son palier), pas de délai de confirmation.
  - Un code est réclamé atomiquement dans le stock du vendeur
    (reclamer_code_coffre_fort, voir migration_coffre_fort_numerique.sql)
    et lié à la commande — jamais retourné dans CETTE réponse : le
    client va le récupérer via /api/achats-numeriques après avoir saisi
    son PIN, pas directement sur l'écran de confirmation d'achat.
  - Si le stock vient d'être épuisé entre l'affichage de la fiche
    produit et le clic (double-achat simultané), on annule proprement
    et on rembourse le débit — jamais de commande "payée" sans code.
*/
export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { produitId } = await req.json();
    if (!produitId) return NextResponse.json({ error: "Produit requis." }, { status: 400 });

    const { data: produit, error: erreurProduit } = await supabaseAdmin
      .from("produits")
      .select("id, nom, prix_base, vendeur_id, type, via_coffre_fort")
      .eq("id", produitId)
      .eq("statut_validation", "valide")
      .single();
    if (erreurProduit || !produit) {
      return NextResponse.json({ error: "Produit introuvable ou non disponible." }, { status: 404 });
    }
    if (!produit.via_coffre_fort) {
      return NextResponse.json({ error: "Ce produit n'est pas livré via le Coffre-fort numérique." }, { status: 400 });
    }

    const { data: vendeurRow } = await supabaseAdmin
      .from("vendeurs")
      .select("user_id, en_pause, message_pause")
      .eq("id", produit.vendeur_id)
      .single();
    if (vendeurRow?.en_pause) {
      return NextResponse.json(
        { error: vendeurRow.message_pause || "Ce vendeur est temporairement indisponible." },
        { status: 409 }
      );
    }

    // Vérifie le stock AVANT de débiter — évite de débiter pour rien
    // si le produit est déjà épuisé (le claim atomique ci-dessous
    // reste la vraie protection contre la concurrence, ceci n'est
    // qu'un filtre rapide).
    const { count: dispo } = await supabaseAdmin
      .from("codes_coffre_fort")
      .select("id", { count: "exact", head: true })
      .eq("produit_id", produit.id)
      .eq("statut", "disponible");
    if (!dispo) {
      return NextResponse.json({ error: "Stock épuisé. Ce produit vient d'être vendu en totalité." }, { status: 409 });
    }

    const montantTotal = Number(produit.prix_base);

    const tauxVendeur = await tauxCommissionVendeur(vendeurRow?.user_id);
    const tauxCashback = await tauxCashbackAcheteur(user.id);
    const commissionAppliquee = Math.round(montantTotal * tauxVendeur);
    const cashback = Math.round(montantTotal * tauxCashback);
    const montantNetVendeur = montantTotal - commissionAppliquee;

    // Débit atomique de l'acheteur (même garde-fou anti double-dépense
    // que le flux panier classique).
    const { data: soldeApresDebit, error: erreurDebit } = await supabaseAdmin.rpc(
      "debiter_wallet_atomique",
      { p_user_id: user.id, p_montant: montantTotal }
    );
    if (erreurDebit) throw erreurDebit;
    if (soldeApresDebit === null) {
      return NextResponse.json({ error: "Solde insuffisant. Recharge ton portefeuille avant d'acheter." }, { status: 400 });
    }

    // Crée la commande, déjà "livrée" — la livraison EST l'attribution
    // du code, instantanée, pas d'étape "expédié" intermédiaire.
    const { data: commande, error: erreurCommande } = await supabaseAdmin
      .from("commandes")
      .insert({
        client_id: user.id,
        vendeur_id: produit.vendeur_id,
        produit_id: produit.id,
        quantite: 1,
        montant_total: montantTotal,
        commission_appliquee: commissionAppliquee,
        statut: "livre",
      })
      .select()
      .single();
    if (erreurCommande) throw erreurCommande;

    // Réclame le code atomiquement (SKIP LOCKED côté SQL). Si null =
    // quelqu'un d'autre a pris le dernier code entre notre vérification
    // et maintenant : on annule tout proprement (rembourse l'acheteur).
    const { data: code, error: erreurClaim } = await supabaseAdmin.rpc("reclamer_code_coffre_fort", {
      p_produit_id: produit.id,
      p_commande_id: commande.id,
    });
    if (erreurClaim) throw erreurClaim;
    if (!code) {
      await supabaseAdmin.from("commandes").update({ statut: "annule" }).eq("id", commande.id);
      await supabaseAdmin.rpc("crediter_wallet_atomique", { p_user_id: user.id, p_montant: montantTotal });
      return NextResponse.json({ error: "Stock épuisé au moment du paiement. Tu as été remboursé automatiquement." }, { status: 409 });
    }

    // Crédite le vendeur immédiatement — pas de séquestre, c'est tout
    // l'intérêt du Coffre-fort numérique.
    const { error: erreurCredit } = await supabaseAdmin.rpc("crediter_wallet_atomique", {
      p_user_id: vendeurRow.user_id,
      p_montant: montantNetVendeur,
    });
    if (erreurCredit) throw erreurCredit;

    if (cashback > 0) {
      await supabaseAdmin.rpc("crediter_wallet_atomique", { p_user_id: user.id, p_montant: cashback });
    }

    await supabaseAdmin.from("transactions_wallet").insert([
      { user_id: user.id, type: "paiement_commande", montant: montantTotal, statut: "reussi" },
      { user_id: vendeurRow.user_id, type: "paiement_commande", montant: montantNetVendeur, statut: "reussi" },
      ...(cashback > 0 ? [{ user_id: user.id, type: "cashback", montant: cashback, statut: "reussi" }] : []),
    ]);

    await notifierPlusieurs(supabaseAdmin, [
      { user_id: vendeurRow.user_id, type: "commande", texte: `Vente instantanée de "${produit.nom}" — code livré automatiquement, fonds crédités.` },
      { user_id: user.id, type: "commande", texte: `Ton code pour "${produit.nom}" est prêt. Va dans "Mes achats numériques" pour le récupérer.` },
    ]);

    // Le code n'est JAMAIS renvoyé ici — voir /api/achats-numeriques
    return NextResponse.json({ succes: true, commandeId: commande.id, montantTotal, cashback });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur inconnue" }, { status: 500 });
  }
}
