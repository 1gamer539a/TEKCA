import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";

/*
  Appelée AVANT chaque tentative de connexion (pas d'authentification
  possible ici, l'utilisateur n'est pas encore connecté). Bloque
  temporairement après trop d'échecs récents, sur deux axes :
  - par email ciblé (protège un compte précis contre le brute force)
  - par IP (ralentit un balayage automatisé sur plusieurs emails)

  Ne révèle jamais si l'email existe ou non — la réponse a exactement
  la même forme dans tous les cas, seul le compteur d'échecs change.
*/
const FENETRE_MINUTES = 15;
const MAX_ECHECS_EMAIL = 5;
const MAX_ECHECS_IP = 20;

export async function POST(req) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "email requis." }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "inconnue";
    const debutFenetre = new Date(Date.now() - FENETRE_MINUTES * 60 * 1000).toISOString();
    const emailNormalise = email.trim().toLowerCase();

    const { count: echecsEmail } = await supabaseAdmin
      .from("journal_securite")
      .select("id", { count: "exact", head: true })
      .eq("type", "connexion_echouee")
      .gte("date_creation", debutFenetre)
      .ilike("details", `%email=${emailNormalise}%`);

    const { count: echecsIp } = await supabaseAdmin
      .from("journal_securite")
      .select("id", { count: "exact", head: true })
      .eq("type", "connexion_echouee")
      .gte("date_creation", debutFenetre)
      .ilike("details", `%ip=${ip}%`);

    const bloque = (echecsEmail || 0) >= MAX_ECHECS_EMAIL || (echecsIp || 0) >= MAX_ECHECS_IP;

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
