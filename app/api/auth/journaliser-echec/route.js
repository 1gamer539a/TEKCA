import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { FENETRE_MINUTES, MAX_ECHECS_IP, ipClient, emailNormalise } from "../../../../lib/limites-connexion";

/*
  Appelée après un échec de supabase.auth.signInWithPassword() côté
  client, pour nourrir le rate limiting de /api/auth/verifier-limite.
  Publique par nécessité (l'utilisateur n'est pas connecté) : elle ne
  fait qu'ajouter une ligne de log, aucune donnée sensible retournée.

  Anti-abus : une même IP ne peut plus écrire qu'un nombre limité de
  lignes par fenêtre (MAX_ECHECS_IP). Elle ne peut donc pas, seule,
  fabriquer assez de faux échecs pour verrouiller le compte d'un
  autre utilisateur (seuil par email : voir lib/limites-connexion.js).
*/
export async function POST(req) {
  try {
    const { email } = await req.json();
    const e = emailNormalise(email);
    if (!e) return NextResponse.json({ succes: false }, { status: 400 });
    const ip = ipClient(req);

    const debutFenetre = new Date(Date.now() - FENETRE_MINUTES * 60 * 1000).toISOString();
    const { count: echecsIp } = await supabaseAdmin
      .from("journal_securite")
      .select("id", { count: "exact", head: true })
      .eq("type", "connexion_echouee")
      .gte("date_creation", debutFenetre)
      .like("details", `%;ip=${ip}`);
    if ((echecsIp || 0) >= MAX_ECHECS_IP) return NextResponse.json({ succes: true }); // déjà bloquée, on n'écrit plus

    // Résout l'user_id si le compte existe, uniquement pour faciliter
    // la lecture du journal côté équipe — n'affecte jamais la réponse
    // renvoyée au client (pas de canal d'énumération).
    const { data: profil } = await supabaseAdmin.from("users").select("id").eq("email", e).single();
    await supabaseAdmin.from("journal_securite").insert({
      user_id: profil?.id || null,
      type: "connexion_echouee",
      details: `email=${e};ip=${ip}`,
    });
    return NextResponse.json({ succes: true });
  } catch (err) {
    return NextResponse.json({ succes: false });
  }
}
