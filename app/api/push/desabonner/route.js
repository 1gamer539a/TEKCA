import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";

export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { endpoint } = await req.json();
    let requete = supabaseAdmin.from("push_subscriptions").delete().eq("user_id", user.id);
    if (endpoint) requete = requete.eq("endpoint", endpoint);
    const { error } = await requete;
    if (error) throw error;

    return NextResponse.json({ succes: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur serveur." }, { status: 500 });
  }
}
