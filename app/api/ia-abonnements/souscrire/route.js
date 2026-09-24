import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";

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

    const { nomForfait } = await req.json();
    if (!PRIX_FORFAIT[nomForfait]) {
      return NextResponse.json({ error: "Forfait invalide." }, { status: 400 });
    }
    const prix = PRIX_FORFAIT[nomForfait];

    const { data: wallet } = await supabaseAdmin.from("wallets").select("solde").eq("user_id", user.id).single();
    const solde = Number(wallet?.solde || 0);
    if (solde < prix) {
      return NextResponse.json({ error: "Solde insuffisant. Recharge ton portefeuille avant de t'abonner." }, { status: 400 });
    }

    await supabaseAdmin.from("wallets").update({ solde: solde - prix, date_maj: new Date().toISOString() }).eq("user_id", user.id);

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
