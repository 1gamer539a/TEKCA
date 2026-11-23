import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { controlerActionPin } from "../../../../lib/pin-serveur";
import { reponseErreurServeur } from "../../../../lib/erreurs";
import { refuserDoublon, limiterDebit } from "../../../../lib/anti-doublon";

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
    const tropDeRequetes = await limiterDebit(user, "abonnements/souscrire", 10, 600);
    if (tropDeRequetes) return tropDeRequetes;
    const doublon = await refuserDoublon(req, user, { fenetre: 8 });
    if (doublon) return doublon;

    const { palier, dureeMois, pin } = await req.json();
    // PIN revérifié côté serveur (lib/pin-serveur.js) : le modal du
    // navigateur seul ne suffit plus pour une opération d'argent.
    const verifPin = await controlerActionPin(req, user.id, pin);
    if (!verifPin.ok) {
      return NextResponse.json({ error: verifPin.error, tentativesRestantes: verifPin.tentativesRestantes }, { status: verifPin.status });
    }
    if (!["basic", "pro", "premium"].includes(palier)) {
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

    // CORRECTIF DOUBLE CLIC — avant : lecture du solde puis écriture séparée.
    // Deux requêtes simultanées lisaient le même solde, créaient chacune un
    // abonnement et ne débitaient qu'une fois. Le débit est maintenant
    // atomique (même méthode que les autres routes d'argent) : il réussit
    // une seule fois ou renvoie NULL si le solde est insuffisant.
    const { data: soldeApresDebit, error: erreurDebit } = await supabaseAdmin.rpc("debiter_wallet_atomique", { p_user_id: user.id, p_montant: prix });
    if (erreurDebit) throw erreurDebit;
    if (soldeApresDebit === null) {
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
    return reponseErreurServeur(e, "app/api/abonnements/souscrire");
  }
}
