import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../../lib/auth-serveur";

/*
  Appelée quand le client clique "Colis reçu" (confirmation manuelle),
  ou par un job planifié après le délai de 48h (libération automatique).
  Dans les deux cas, la logique de libération est identique : l'argent
  séquestré (montant_produit - commission) part sur le wallet du
  vendeur, les frais de Protection Acheteur restent acquis à la
  plateforme.
*/
export async function POST(req, { params }) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const commandeId = params.id;

    const { data: commande } = await supabaseAdmin
      .from("commandes")
      .select("id, client_id, vendeur_id, montant_total, commission_appliquee, statut")
      .eq("id", commandeId)
      .single();
    if (!commande) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    if (commande.client_id !== user.id) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

    const { data: sequestre } = await supabaseAdmin
      .from("sequestres")
      .select("id, montant_produit, statut, confirme_par_client")
      .eq("commande_id", commandeId)
      .single();
    if (!sequestre) return NextResponse.json({ error: "Séquestre introuvable." }, { status: 404 });
    if (sequestre.statut !== "retenu") {
      return NextResponse.json({ error: "Cette commande a déjà été traitée." }, { status: 400 });
    }

    const montantVendeur = Number(sequestre.montant_produit) - Number(commande.commission_appliquee || 0);

    // Crédite le vendeur
    const { data: vendeurRow } = await supabaseAdmin.from("vendeurs").select("user_id, nb_ventes").eq("id", commande.vendeur_id).single();
    if (vendeurRow?.user_id) {
      const { data: walletVendeur } = await supabaseAdmin.from("wallets").select("solde").eq("user_id", vendeurRow.user_id).single();
      const soldeVendeur = Number(walletVendeur?.solde || 0);

      if (walletVendeur) {
        await supabaseAdmin
          .from("wallets")
          .update({ solde: soldeVendeur + montantVendeur, date_maj: new Date().toISOString() })
          .eq("user_id", vendeurRow.user_id);
      } else {
        await supabaseAdmin.from("wallets").insert({ user_id: vendeurRow.user_id, solde: montantVendeur });
      }

      await supabaseAdmin.from("transactions_wallet").insert({
        user_id: vendeurRow.user_id,
        type: "recharge",
        montant: montantVendeur,
        statut: "reussi",
      });

      await supabaseAdmin
        .from("vendeurs")
        .update({ nb_ventes: (vendeurRow.nb_ventes || 0) + 1 })
        .eq("id", commande.vendeur_id);
    }

    // Met à jour le séquestre et la commande
    await supabaseAdmin
      .from("sequestres")
      .update({ statut: "libere_manuel", confirme_par_client: true, date_liberation: new Date().toISOString() })
      .eq("id", sequestre.id);

    await supabaseAdmin.from("commandes").update({ statut: "livre" }).eq("id", commandeId);

    return NextResponse.json({ succes: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur inconnue" }, { status: 500 });
  }
}
