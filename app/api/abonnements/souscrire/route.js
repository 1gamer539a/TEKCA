import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";

/*
  Le paiement de l'abonnement se fait depuis le solde du wallet TEKÇA
  (donc indirectement via Sebpay, puisque le wallet reflète les fonds
  gérés par Sebpay) — pas de nouvelle demande de paiement mobile money
  à chaque souscription. Simplification volontaire pour ne pas
  réinventer un deuxième circuit de paiement ; à revoir si tu veux
  plutôt un prélèvement Sebpay dédié par abonnement.

  Pas de renouvellement automatique : l'utilisateur doit revenir
  cliquer sur "S'abonner" à chaque échéance (voir le job de rappel
  quotidien dans /api/cron/rappels-abonnement).
*/
export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { palier, dureeMois } = await req.json();
    if (!["standard", "classique", "premium"].includes(palier)) {
      return NextResponse.json({ error: "Palier invalide." }, { status: 400 });
    }
    if (![1, 3, 6, 12].includes(dureeMois)) {
      return NextResponse.json({ error: "Durée invalide." }, { status: 400 });
    }

    // Prix depuis la grille — jamais envoyé/fait confiance par le client
    const { data: tarif } = await supabaseAdmin
      .from("grille_tarifs_abonnement")
      .select("prix_fcfa")
      .eq("palier", palier)
      .eq("duree_mois", dureeMois)
      .single();
    if (!tarif) return NextResponse.json({ error: "Tarif introuvable." }, { status: 404 });
    const prix = Number(tarif.prix_fcfa);

    const { data: wallet } = await supabaseAdmin.from("wallets").select("solde").eq("user_id", user.id).single();
    const solde = Number(wallet?.solde || 0);
    if (solde < prix) {
      return NextResponse.json({ error: "Solde insuffisant. Recharge ton portefeuille avant de t'abonner." }, { status: 400 });
    }

    // Un utilisateur ne peut avoir qu'un seul abonnement actif — s'il
    // en a déjà un, on le marque expiré avant de créer le nouveau
    // (changement de palier en cours de route, par exemple).
    await supabaseAdmin
      .from("abonnements_utilisateur")
      .update({ statut: "expire" })
      .eq("user_id", user.id)
      .eq("statut", "actif");

    await supabaseAdmin.from("wallets").update({ solde: solde - prix, date_maj: new Date().toISOString() }).eq("user_id", user.id);

    await supabaseAdmin.from("transactions_wallet").insert({
      user_id: user.id,
      type: "paiement_abonnement",
      montant: prix,
      statut: "reussi",
    });

    const dateDebut = new Date();
    const dateFin = new Date(dateDebut);
    dateFin.setMonth(dateFin.getMonth() + dureeMois);

    const { data: abonnement, error } = await supabaseAdmin
      .from("abonnements_utilisateur")
      .insert({
        user_id: user.id,
        palier,
        duree_mois: dureeMois,
        prix_paye: prix,
        date_debut: dateDebut.toISOString(),
        date_fin: dateFin.toISOString(),
        statut: "actif",
        renouvellement_auto: true,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ succes: true, abonnement });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur inconnue" }, { status: 500 });
  }
}
