import { NextResponse } from "next/server";
import { utilisateurConnecte } from "../../../../../lib/auth-serveur";
import { controlerPin } from "../../../../../lib/pin-serveur";
import { creerValeurCookiePin, NOM_COOKIE_PIN } from "../../../../../lib/pin-cookie";

/*
  Vérifie le PIN (logique partagée dans lib/pin-serveur.js) puis pose
  le cookie "PIN vérifié" httpOnly, désormais SIGNÉ et lié à
  l'utilisateur (voir lib/pin-cookie.js) : il ne peut plus être
  fabriqué à la main. Retiré à la déconnexion
  (/api/securite/pin/deconnecter).
*/
export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { pin } = await req.json();
    const resultat = await controlerPin(user.id, pin);
    if (!resultat.ok) {
      const corps = { error: resultat.error };
      if (resultat.tentativesRestantes !== undefined) corps.tentativesRestantes = resultat.tentativesRestantes;
      return NextResponse.json(corps, { status: resultat.status });
    }

    const reponse = NextResponse.json({ ok: true });
    reponse.cookies.set(NOM_COOKIE_PIN, await creerValeurCookiePin(user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return reponse;
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur serveur." }, { status: 500 });
  }
}
