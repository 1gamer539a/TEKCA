import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../../lib/auth-serveur";
import { hacherPin } from "../../../../../lib/pin";

export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { pin } = await req.json();
    if (!pin || !/^\d{4,6}$/.test(pin)) {
      return NextResponse.json({ error: "Le code PIN doit contenir 4 à 6 chiffres." }, { status: 400 });
    }

    const hachage = hacherPin(pin);
    const { error } = await supabaseAdmin.from("users").update({ code_pin_hash: hachage }).eq("id", user.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur serveur." }, { status: 500 });
  }
}
