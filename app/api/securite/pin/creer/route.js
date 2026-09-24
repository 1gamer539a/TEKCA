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
    //
    // CORRECTIF 2 — .single() plantait avec "Cannot coerce the result
    // to a single JSON object" si la fiche public.users n'existait pas
    // encore (trigger on_auth_user_created de auth_setup.sql pas
    // encore exécuté côté base, ou pas encore passé). maybeSingle()
    // renvoie null au lieu de lever une erreur, et on répare en créant
    // la fiche manquante à la volée plutôt que de planter.
    const { data: profilExistant, error: erreurProfil } = await supabaseAdmin
      .from("users")
      .select("code_pin_hash")
      .eq("id", user.id)
      .maybeSingle();
    if (erreurProfil) throw erreurProfil;

    if (!profilExistant) {
      const { error: erreurCreationProfil } = await supabaseAdmin
        .from("users")
        .insert({ id: user.id, nom: user.user_metadata?.nom || user.email?.split("@")[0], email: user.email, role: "client" })
        .select()
        .maybeSingle();
      // "duplicate key" possible si le trigger a fini par créer la
      // ligne entre-temps (course bénigne) — pas une vraie erreur ici.
      if (erreurCreationProfil && erreurCreationProfil.code !== "23505") throw erreurCreationProfil;
    } else if (profilExistant.code_pin_hash) {
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
