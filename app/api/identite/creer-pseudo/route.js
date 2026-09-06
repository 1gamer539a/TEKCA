import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { genererIdentifiantUnique } from "../../../../lib/identite";

const REGEX_PSEUDO = /^[a-zA-Z0-9_.]{3,20}$/;

export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { pseudo } = await req.json();
    const pseudoNettoye = (pseudo || "").trim();

    if (!REGEX_PSEUDO.test(pseudoNettoye)) {
      return NextResponse.json(
        { error: "Le pseudo doit faire 3 à 20 caractères : lettres, chiffres, points ou underscores uniquement." },
        { status: 400 }
      );
    }

    const { data: profil } = await supabaseAdmin.from("users").select("pseudo, identifiant_tekca").eq("id", user.id).single();
    if (profil?.pseudo) {
      return NextResponse.json({ error: "Tu as déjà un pseudo TEKÇA — il est définitif et ne peut plus être changé." }, { status: 400 });
    }

    const identifiant = await genererIdentifiantUnique();

    const { error } = await supabaseAdmin
      .from("users")
      .update({ pseudo: pseudoNettoye, identifiant_tekca: identifiant })
      .eq("id", user.id);

    if (error) {
      if (error.message.includes("duplicate")) {
        return NextResponse.json({ error: "Ce pseudo est déjà pris, choisis-en un autre." }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ succes: true, pseudo: pseudoNettoye, identifiant });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur inconnue" }, { status: 500 });
  }
}
