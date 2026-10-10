import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { palierActif } from "../../../../lib/commission";
import { reponseErreurServeur } from "../../../../lib/erreurs";

/*
  Le vendeur peut-il publier une annonce immobilier / véhicule ? Utilisé par le
  formulaire pour afficher un message clair. La règle réelle est imposée par la
  base (migration_annonces_abonnement.sql), ceci n'est qu'une aide à l'écran.
*/
export async function GET(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    const palier = await palierActif(user.id);
    const { data: profil } = await supabaseAdmin.from("users").select("piece_identite_verifiee").eq("id", user.id).maybeSingle();
    return NextResponse.json({ abonnement: !!palier, identite: !!profil?.piece_identite_verifiee });
  } catch (e) {
    return reponseErreurServeur(e, "api/produits/eligibilite-annonce");
  }
}
