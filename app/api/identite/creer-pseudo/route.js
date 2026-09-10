import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { genererIdentifiantUnique } from "../../../../lib/identite";

const REGEX_PSEUDO = /^[a-zA-Z0-9_.]{3,20}$/;
const AGE_MINIMUM = 14;

function calculerAge(dateNaissanceStr) {
  const naissance = new Date(dateNaissanceStr);
  const aujourdHui = new Date();
  let age = aujourdHui.getFullYear() - naissance.getFullYear();
  const moisPasse = aujourdHui.getMonth() - naissance.getMonth();
  if (moisPasse < 0 || (moisPasse === 0 && aujourdHui.getDate() < naissance.getDate())) age--;
  return age;
}

export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { pseudo, dateNaissance } = await req.json();
    const pseudoNettoye = (pseudo || "").trim();

    if (!REGEX_PSEUDO.test(pseudoNettoye)) {
      return NextResponse.json(
        { error: "Le pseudo doit faire 3 à 20 caractères : lettres, chiffres, points ou underscores uniquement." },
        { status: 400 }
      );
    }

    // CORRECTIF — date de naissance désormais obligatoire pour tout
    // nouveau compte (âge minimum 14 ans, voir fix_age_minimum.sql).
    if (!dateNaissance || isNaN(new Date(dateNaissance).getTime())) {
      return NextResponse.json({ error: "Date de naissance requise." }, { status: 400 });
    }
    const age = calculerAge(dateNaissance);
    if (age < AGE_MINIMUM) {
      return NextResponse.json({ error: `TEKÇA est accessible à partir de ${AGE_MINIMUM} ans.` }, { status: 400 });
    }

    const { data: profil } = await supabaseAdmin.from("users").select("pseudo, identifiant_tekca").eq("id", user.id).single();
    if (profil?.pseudo) {
      return NextResponse.json({ error: "Tu as déjà un pseudo TEKÇA — il est définitif et ne peut plus être changé." }, { status: 400 });
    }

    const identifiant = await genererIdentifiantUnique();

    const { error } = await supabaseAdmin
      .from("users")
      .update({ pseudo: pseudoNettoye, identifiant_tekca: identifiant, date_naissance: dateNaissance })
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
