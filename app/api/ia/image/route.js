import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { refuserDoublon, limiterDebit } from "../../../../lib/anti-doublon";
import { planUtilisateur, imagesUtiliseesCeMois, reponsePlanRequis } from "../../../../lib/ia-plans";
import { genererImage } from "../../../../lib/ia-fournisseur";
import { reponseErreurServeur } from "../../../../lib/erreurs";

// Une image peut prendre 10 à 30 s : on laisse le temps à la fonction.
export const maxDuration = 60;

/*
  Génération d'image par l'assistant — RÉSERVÉE AUX ABONNÉS (Basic 2 500 FCFA/mois et plus),
  avec un quota mensuel par palier (lib/ia-plans.js) : chaque image coûte de l'argent.
  Le quota n'est débité qu'APRÈS une image réellement reçue.
*/
export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    const doublon = await refuserDoublon(req, user, { fenetre: 20 });
    if (doublon) return doublon;
    const tropDeRequetes = await limiterDebit(user, "ia/image", 6, 600);
    if (tropDeRequetes) return tropDeRequetes;

    const plan = await planUtilisateur(user.id);
    if (plan.niveau < 1) return reponsePlanRequis(1);

    const utilisees = await imagesUtiliseesCeMois(user.id);
    if (utilisees >= plan.quotaImages) {
      return NextResponse.json({ error: "Tu as utilisé toutes tes images de ce mois.", code: "quota_images" }, { status: 429 });
    }

    const { description } = await req.json();
    const texte = String(description || "").trim();
    if (texte.length < 3 || texte.length > 400) {
      return NextResponse.json({ error: "Décris l'image en quelques mots (3 à 400 caractères)." }, { status: 400 });
    }

    const prompt =
      `Crée une illustration soignée, adaptée à une plateforme de e-commerce et de gaming : ${texte}. ` +
      `Pas de texte écrit dans l'image, pas de personne réelle identifiable, pas de marque protégée, contenu tout public.`;

    let image;
    try {
      image = await genererImage({ prompt });
    } catch (e) {
      console.error("Assistant IA (image) :", e.code, e.detail || "");
      const message =
        e.code === "IA_IMAGE_VIDE"
          ? "Cette demande n'a pas pu être traitée. Essaie de la reformuler autrement."
          : "La génération d'images est indisponible pour le moment. Réessaie plus tard.";
      return NextResponse.json({ error: message, code: e.code }, { status: e.code === "IA_IMAGE_VIDE" ? 422 : 503 });
    }

    // Débité seulement maintenant (image reçue) ; l'échec d'écriture ne retire pas l'image.
    try {
      await supabaseAdmin.from("ia_generations").insert({ user_id: user.id, type_generation: `image:${texte.slice(0, 80)}` });
    } catch (e) {
      console.error("ia_generations :", e);
    }

    return NextResponse.json({
      image: `data:${image.mimeType};base64,${image.base64}`,
      imagesRestantes: Math.max(0, plan.quotaImages - utilisees - 1),
    });
  } catch (e) {
    return reponseErreurServeur(e, "app/api/ia/image");
  }
}
