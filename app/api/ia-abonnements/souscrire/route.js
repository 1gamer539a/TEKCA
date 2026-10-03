import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { controlerActionPin } from "../../../../lib/pin-serveur";

/*
  CORRECTIF — le bouton "Passer Premium" dans IAAssistant.jsx changeait
  juste un état React local (setForfait("premium")), sans PAIEMENT,
  sans PIN, sans écriture en base : aucune trace dans `ia_abonnements`,
  donc au moindre rechargement de page le forfait revenait à "free"
  comme si de rien n'était. Et les 3 paliers (Basique/Pro/Ultra)
  faisaient tous exactement la même chose. Cette route fait le vrai
  travail : débite le wallet du bon montant, PIN déjà vérifié en amont
  côté client (voir ConfirmationPIN dans IAAssistant.jsx), enregistre
  l'abonnement avec sa vraie date d'expiration.

  Prix en dur ici plutôt que dans une table dédiée (comme
  grille_tarifs_abonnement pour l'abonnement plateforme) : seulement
  3 valeurs fixes, pas encore éditables depuis l'admin. À migrer vers
  une vraie table si un jour ces prix doivent changer sans redéploiement.
*/
const PRIX_FORFAIT = { Basique: 2000, Pro: 5000, Ultra: 10000 };

export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { nomForfait, pin } = await req.json();
    // PIN revérifié côté serveur (lib/pin-serveur.js) : le modal du
    // navigateur seul ne suffit plus pour une opération d'argent.
    const verifPin = await controlerActionPin(req, user.id, pin);
    if (!verifPin.ok) {
      return NextResponse.json({ error: verifPin.error, tentativesRestantes: verifPin.tentativesRestantes }, { status: verifPin.status });
    }
    if (!PRIX_FORFAIT[nomForfait]) {
      return NextResponse.json({ error: "Forfait invalide." }, { status: 400 });
    }
    const prix = PRIX_FORFAIT[nomForfait];

    // CORRECTIF — lecture du solde puis écriture séparée : deux clics
    // rapides pouvaient créer deux abonnements en ne payant qu'une fois.
    // Débit atomique, comme les autres routes d'argent.
    const { data: soldeApresDebit, error: erreurDebit } = await supabaseAdmin.rpc("debiter_wallet_atomique", { p_user_id: user.id, p_montant: prix });
    if (erreurDebit) throw erreurDebit;
    if (soldeApresDebit === null) {
      return NextResponse.json({ error: "Solde insuffisant. Recharge ton portefeuille avant de t'abonner." }, { status: 400 });
    }

    await supabaseAdmin.from("transactions_wallet").insert({
      user_id: user.id,
      type: "paiement_abonnement",
      montant: prix,
      statut: "reussi",
    });

    const dateDebut = new Date();
    const dateFin = new Date(dateDebut);
    dateFin.setMonth(dateFin.getMonth() + 1);

    const { data: abonnement, error } = await supabaseAdmin
      .from("ia_abonnements")
      .insert({
        user_id: user.id,
        forfait: "premium",
        nom_forfait: nomForfait,
        date_debut: dateDebut.toISOString(),
        date_fin: dateFin.toISOString(),
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ succes: true, abonnement });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur inconnue" }, { status: 500 });
  }
}
