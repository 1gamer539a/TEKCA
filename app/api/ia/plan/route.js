import { NextResponse } from "next/server";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { planUtilisateur, imagesUtiliseesCeMois } from "../../../../lib/ia-plans";
import { reponseErreurServeur } from "../../../../lib/erreurs";

/*
  Dit à l'assistant (écran de chat) ce que l'abonnement de la personne débloque : niveau,
  palier et images restantes ce mois-ci. Sert uniquement à l'AFFICHAGE : chaque fonction
  payante revérifie le niveau côté serveur avant de s'exécuter.
*/
export async function GET(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    const plan = await planUtilisateur(user.id);
    const imagesUtilisees = plan.quotaImages > 0 ? await imagesUtiliseesCeMois(user.id) : 0;
    return NextResponse.json(
      { niveau: plan.niveau, palier: plan.palier, quotaImages: plan.quotaImages, imagesUtilisees },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return reponseErreurServeur(e, "app/api/ia/plan");
  }
}
