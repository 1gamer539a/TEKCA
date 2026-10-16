import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { FENETRE_MINUTES, MAX_ECHECS_EMAIL_IP, MAX_ECHECS_EMAIL_TOTAL, MAX_ECHECS_IP, ipClient, emailNormalise } from "../../../../lib/limites-connexion";

/*
  Appelée AVANT chaque tentative de connexion (pas d'authentification
  possible ici, l'utilisateur n'est pas encore connecté). Bloque
  temporairement après trop d'échecs récents — voir les trois seuils
  dans lib/limites-connexion.js. Ne révèle jamais si l'email existe :
  la réponse a toujours la même forme, seul le compteur change.
*/
export async function POST(req) {
  try {
    const { email } = await req.json();
    const e = emailNormalise(email);
    if (!e) return NextResponse.json({ error: "email requis." }, { status: 400 });
    const ip = ipClient(req);
    const debutFenetre = new Date(Date.now() - FENETRE_MINUTES * 60 * 1000).toISOString();
    const compter = (filtre) =>
      filtre(
        supabaseAdmin
          .from("journal_securite")
          .select("id", { count: "exact", head: true })
          .eq("type", "connexion_echouee")
          .gte("date_creation", debutFenetre)
      );

    const [{ count: echecsEmailIp }, { count: echecsEmail }, { count: echecsIp }] = await Promise.all([
      compter((q) => q.eq("details", `email=${e};ip=${ip}`)),
      compter((q) => q.like("details", `email=${e};%`)),
      compter((q) => q.like("details", `%;ip=${ip}`)),
    ]);

    const bloque =
      (echecsEmailIp || 0) >= MAX_ECHECS_EMAIL_IP ||
      (echecsEmail || 0) >= MAX_ECHECS_EMAIL_TOTAL ||
      (echecsIp || 0) >= MAX_ECHECS_IP;
    return NextResponse.json({
      bloque,
      message: bloque ? `Trop de tentatives. Réessaie dans ${FENETRE_MINUTES} minutes.` : null,
    });
  } catch (e) {
    // En cas d'erreur technique, on ne bloque jamais la connexion —
    // le rate limiting est une protection additionnelle, pas un
    // point de défaillance pour l'accès normal au compte.
    return NextResponse.json({ bloque: false, message: null });
  }
}
