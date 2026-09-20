import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { tauxCommissionVendeur, tauxCashbackAcheteur } from "../../../../lib/commission";
import { genererCodeAlphanumerique } from "../../../../lib/codes";
import { notifier } from "../../../../lib/notifications";

const TAUX_PROTECTION_ACHETEUR = 0.05; // 5%, façon Vinted
const DELAI_CONFIRMATION_HEURES = 48;

export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { produitId, varianteId, quantite = 1, adresse, ville, idJoueur } = await req.json();
    if (!produitId) return NextResponse.json({ error: "Produit requis." }, { status: 400 });

    // 1. Charge le produit et son vendeur — jamais faire confiance au prix envoyé par le client
    const { data: produit, error: erreurProduit } = await supabaseAdmin
      .from("produits")
      .select("id, nom, prix_base, vendeur_id, categorie_id, type, mode_commande, stock_global")
      .eq("id", produitId)
      .eq("statut_validation", "valide")
      .single();
    if (erreurProduit || !produit) {
      return NextResponse.json({ error: "Produit introuvable ou non disponible." }, { status: 404 });
    }

    let prixUnitaire = Number(produit.prix_base);
    if (varianteId) {
      const { data: variante } = await supabaseAdmin
        .from("variantes_produits")
        .select("prix, stock")
        .eq("id", varianteId)
        .single();
      if (variante?.prix) prixUnitaire = Number(variante.prix);
    }

    // 1bis. Vérifie ET réserve le stock de façon atomique — AVANT tout
    // débit du portefeuille, pour ne jamais prélever l'acheteur sur un
    // produit qui n'est en fait plus disponible. Ne s'applique que si
    // ce produit suit effectivement un stock (variante choisie, ou
    // stock_global non nul — les recharges/coffre-fort n'ont ni l'un
    // ni l'autre et ne sont donc jamais bloqués ici).
    if (varianteId) {
      const { data: stockRestant, error: erreurStock } = await supabaseAdmin.rpc("decrementer_stock_variante", {
        p_variante_id: varianteId,
        p_quantite: quantite,
      });
      if (erreurStock) throw erreurStock;
      if (stockRestant === null) {
        return NextResponse.json({ error: "Stock insuffisant pour cette taille/couleur." }, { status: 409 });
      }
    } else if (produit.stock_global !== null) {
      const { data: stockRestant, error: erreurStock } = await supabaseAdmin.rpc("decrementer_stock_global", {
        p_produit_id: produit.id,
        p_quantite: quantite,
      });
      if (erreurStock) throw erreurStock;
      if (stockRestant === null) {
        return NextResponse.json({ error: "Stock insuffisant." }, { status: 409 });
      }
    }

    // Fonction de remise en stock — appelée si une étape suivante
    // échoue (vendeur en pause, solde insuffisant...), pour ne jamais
    // laisser un stock "consommé" par une commande qui n'a en fait
    // jamais abouti.
    const restituerStock = async () => {
      if (varianteId) {
        await supabaseAdmin.rpc("incrementer_stock_variante", { p_variante_id: varianteId, p_quantite: quantite });
      } else if (produit.stock_global !== null) {
        await supabaseAdmin.rpc("incrementer_stock_global", { p_produit_id: produit.id, p_quantite: quantite });
      }
    };

    const { data: vendeurRow } = await supabaseAdmin.from("vendeurs").select("user_id, en_pause, message_pause").eq("id", produit.vendeur_id).single();

    // CORRECTIF — un vendeur en pause ("Fermé temporairement") ne
    // doit plus recevoir de nouvelles commandes tant qu'il ne peut
    // pas livrer — vérifié ici côté serveur (pas seulement masqué
    // dans l'UI, sans quoi un appel direct à cette route contournerait
    // le blocage).
    if (vendeurRow?.en_pause) {
      await restituerStock();
      return NextResponse.json(
        { error: vendeurRow.message_pause || "Ce vendeur est temporairement indisponible et ne reçoit pas de commande pour le moment." },
        { status: 409 }
      );
    }

    const montantProduit = prixUnitaire * quantite;
    const fraisProtection = Math.round(montantProduit * TAUX_PROTECTION_ACHETEUR);
    const montantTotal = montantProduit + fraisProtection;

    // 2. Commission vendeur (selon son palier d'abonnement) + cashback
    // acheteur (Premium uniquement, 5%, prélevé sur la commission
    // TEKÇA — jamais déduit de ce que touche le vendeur).
    const tauxVendeur = await tauxCommissionVendeur(vendeurRow?.user_id);
    const tauxCashback = await tauxCashbackAcheteur(user.id);
    const commissionAppliquee = Math.round(montantProduit * tauxVendeur);
    const cashback = Math.round(montantProduit * tauxCashback);

    // 3-4. Débit atomique du montant de la commande — lecture ET
    // vérification du solde dans la même requête SQL, empêche deux
    // commandes simultanées de tous les deux passer la vérification
    // de solde (race condition). Null = solde insuffisant.
    const { data: soldeApresDebit, error: erreurDebit } = await supabaseAdmin.rpc(
      "debiter_wallet_atomique",
      { p_user_id: user.id, p_montant: montantTotal }
    );
    if (erreurDebit) throw erreurDebit;
    if (soldeApresDebit === null) {
      await restituerStock();
      return NextResponse.json({ error: "Solde insuffisant. Recharge ton portefeuille avant de commander." }, { status: 400 });
    }
    // Cashback crédité séparément, toujours atomique
    if (cashback > 0) {
      const { error: erreurCredit } = await supabaseAdmin.rpc("crediter_wallet_atomique", {
        p_user_id: user.id,
        p_montant: cashback,
      });
      if (erreurCredit) throw erreurCredit;
    }

    // 5. Crée la commande
    const { data: commande, error: erreurCommande } = await supabaseAdmin
      .from("commandes")
      .insert({
        client_id: user.id,
        vendeur_id: produit.vendeur_id,
        produit_id: produit.id,
        variante_id: varianteId || null,
        quantite,
        montant_total: montantTotal,
        commission_appliquee: commissionAppliquee,
        cashback_credite: cashback,
        statut: "paye",
        id_joueur: idJoueur || null,
      })
      .select()
      .single();
    if (erreurCommande) throw erreurCommande;

    // 6. Trace la transaction wallet (paiement de commande + cashback si applicable)
    await supabaseAdmin.from("transactions_wallet").insert({
      user_id: user.id,
      type: "paiement_commande",
      montant: montantTotal,
      statut: "reussi",
    });
    if (cashback > 0) {
      await supabaseAdmin.from("transactions_wallet").insert({
        user_id: user.id,
        type: "cashback",
        montant: cashback,
        statut: "reussi",
      });
    }

    // 7. Crée le séquestre — l'argent reste bloqué jusqu'à confirmation de réception
    const dateLimite = new Date(Date.now() + DELAI_CONFIRMATION_HEURES * 3600 * 1000);
    await supabaseAdmin.from("sequestres").insert({
      commande_id: commande.id,
      montant_produit: montantProduit,
      frais_protection_acheteur: fraisProtection,
      statut: "retenu",
      date_limite_confirmation: dateLimite.toISOString(),
    });

    // 7bis. Produit physique (vêtement/accessoire) — génère le code de
    // confirmation à 6 caractères (lettres + chiffres) que l'acheteur
    // communiquera au vendeur en main propre à la réception. Voir
    // code_livraison.sql.
    let codeLivraison = null;
    if (["vetement", "accessoire"].includes(produit.type)) {
      codeLivraison = genererCodeAlphanumerique(6); // ex: "K7P2XR" — lettres + chiffres
      await supabaseAdmin.from("codes_livraison").insert({
        commande_id: commande.id,
        code: codeLivraison,
      });
    }

    // 8. Notifie le vendeur
    if (vendeurRow?.user_id) {
      await notifier(supabaseAdmin, {
        user_id: vendeurRow.user_id,
        type: "commande",
        texte: `Nouvelle commande reçue pour "${produit.nom}".`,
      });
    }

    return NextResponse.json({ succes: true, commandeId: commande.id, montantTotal, cashback, codeLivraison });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur inconnue" }, { status: 500 });
  }
}
