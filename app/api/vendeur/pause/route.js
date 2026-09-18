import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";

export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { enPause, messagePause } = await req.json();

    const { data: vendeur, error: erreurVendeur } = await supabaseAdmin
      .from("vendeurs")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (erreurVendeur || !vendeur) return NextResponse.json({ error: "Aucune boutique associée à ce compte." }, { status: 404 });

    const { error } = await supabaseAdmin
      .from("vendeurs")
      .update({ en_pause: !!enPause, message_pause: enPause ? (messagePause || null) : null })
      .eq("id", vendeur.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur serveur." }, { status: 500 });
  }
}
