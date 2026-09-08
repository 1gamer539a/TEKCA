import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";

/*
  Appelée après un échec de supabase.auth.signInWithPassword() côté
  client, pour nourrir le rate limiting de /api/auth/verifier-limite.
  N'importe qui peut appeler cette route (elle est publique par
  nécessité, l'utilisateur n'est pas connecté), mais elle ne fait
  qu'ajouter une ligne de log — aucune lecture, aucune donnée
  sensible retournée.
*/
export async function POST(req) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ succes: false }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "inconnue";
    const emailNormalise = email.trim().toLowerCase();

    // Résout l'user_id si le compte existe, uniquement pour faciliter
    // la lecture du journal côté équipe — n'affecte jamais la réponse
    // renvoyée au client, donc ça ne crée pas de canal d'énumération.
    const { data: profil } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", emailNormalise)
      .single();

    await supabaseAdmin.from("journal_securite").insert({
      user_id: profil?.id || null,
      type: "connexion_echouee",
      details: `email=${emailNormalise};ip=${ip}`,
    });

    return NextResponse.json({ succes: true });
  } catch (e) {
    return NextResponse.json({ succes: false });
  }
}
