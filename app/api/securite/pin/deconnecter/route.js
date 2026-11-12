import { NextResponse } from "next/server";

/*
  Appelée juste avant/après supabase.auth.signOut() côté client (voir
  ProfilParametres.jsx). Sans ça, le cookie "tekca_pin_ok" posé par
  /api/securite/pin/verifier resterait valide si le navigateur n'est
  jamais fermé, et une reconnexion avec un AUTRE compte sur le même
  appareil n'aurait pas à ressaisir de PIN avant le premier
  chargement protégé — d'où cet effacement explicite, en plus de
  l'absence de maxAge sur le cookie.
*/
export async function POST() {
  const reponse = NextResponse.json({ ok: true });
  reponse.cookies.set("tekca_pin_ok", "", { httpOnly: true, path: "/", maxAge: 0 });
  return reponse;
}
