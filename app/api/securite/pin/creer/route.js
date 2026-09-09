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

    // CORRECTIF — cette route servait aussi bien à créer qu'à
    // écraser un PIN existant, sans jamais redemander l'ancien : un
    // utilisateur (ou quiconque avec une session volée) pouvait
    // remplacer le PIN de sécurité en un seul appel. Elle ne sert
    // maintenant qu'à la création initiale ; le changement passe par
    // /api/securite/pin/modifier, qui exige l'ancien code.
    const { data: profilExistant, error: erreurProfil } = await supabaseAdmin
      .from("users")
      .select("code_pin_hash")
      .eq("id", user.id)
      .single();
    if (erreurProfil) throw erreurProfil;
    if (profilExistant?.code_pin_hash) {
      return NextResponse.json(
        { error: "Un code PIN existe déjà pour ce compte. Utilise le changement de PIN pour le modifier." },
        { status: 409 }
      );
    }

    const hachage = hacherPin(pin);
    const { error } = await supabaseAdmin.from("users").update({ code_pin_hash: hachage }).eq("id", user.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur serveur." }, { status: 500 });
  }
}
