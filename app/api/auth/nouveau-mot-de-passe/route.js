import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { limiterDebit } from "../../../../lib/anti-doublon";
import { reponseErreurServeur } from "../../../../lib/erreurs";
import { NOM_COOKIE_RECUPERATION, recuperationValide } from "../../../../lib/recuperation-cookie";

/*
  Définit le nouveau mot de passe après un lien « mot de passe oublié ».

  Exige TOUT ceci :
  - une session valide (celle ouverte par le lien reçu par email) ;
  - le cookie signé de récupération posé par /auth/callback (preuve que le lien
    a bien été utilisé, et non une simple session volée) ;
  - si le compte a la double authentification (2FA) : utilisateurConnecte
    refuse une session sans code à 6 chiffres — un email seul ne suffit donc
    jamais à contourner la 2FA.
  Ensuite, TOUTES les sessions du compte sont fermées : l'utilisateur doit se
  reconnecter avec son nouveau mot de passe.
*/
export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) {
      return NextResponse.json({ error: "Session invalide ou expirée. Demande un nouveau lien.", code: "session" }, { status: 401 });
    }
    const tropDeRequetes = await limiterDebit(user, "auth/nouveau-mot-de-passe", 5, 600);
    if (tropDeRequetes) return tropDeRequetes;

    const jar = await cookies();
    if (!(await recuperationValide(jar.get(NOM_COOKIE_RECUPERATION)?.value, user.id))) {
      return NextResponse.json({ error: "Ce lien a expiré. Demande un nouveau lien depuis la page de connexion.", code: "lien_expire" }, { status: 403 });
    }

    if (user.app_metadata?.provider !== "email") {
      return NextResponse.json({ error: "Ce compte se connecte avec Google, Facebook ou Apple : il n'a pas de mot de passe TEKÇA.", code: "sans_mot_de_passe" }, { status: 400 });
    }

    const { nouveauMotDePasse } = await req.json();
    if (typeof nouveauMotDePasse !== "string" || nouveauMotDePasse.length < 8 || nouveauMotDePasse.length > 128) {
      return NextResponse.json({ error: "Le mot de passe doit contenir au moins 8 caractères.", code: "court" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: nouveauMotDePasse });
    if (error) throw error;

    // Ferme toutes les sessions du compte (tous les appareils).
    const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
    try {
      await supabaseAdmin.auth.admin.signOut(token, "global");
    } catch (e) {
      console.error("fermeture des sessions :", e);
    }

    const reponse = NextResponse.json({ succes: true });
    reponse.cookies.set(NOM_COOKIE_RECUPERATION, "", { path: "/", maxAge: 0 });
    return reponse;
  } catch (e) {
    return reponseErreurServeur(e, "app/api/auth/nouveau-mot-de-passe");
  }
}
