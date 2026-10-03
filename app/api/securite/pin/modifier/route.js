import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../../lib/auth-serveur";
import { hacherPin, verifierPin } from "../../../../../lib/pin";

const FENETRE_MINUTES = 15;
const MAX_ECHECS = 5;

/*
  Changer son PIN exige de prouver qu'on connaît l'ancien — sans ça,
  n'importe qui avec une session ouverte (téléphone déverrouillé
  laissé sans surveillance, session volée) pourrait remplacer le PIN
  de sécurité et verrouiller le vrai propriétaire du compte hors de
  ses propres paiements. Même limitation anti brute-force que pour
  /api/securite/pin/verifier.
*/
export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const debutFenetre = new Date(Date.now() - FENETRE_MINUTES * 60 * 1000).toISOString();
    const { count: echecsRecents } = await supabaseAdmin
      .from("journal_securite")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("type", "pin_echoue")
      .gte("date_creation", debutFenetre);

    if ((echecsRecents || 0) >= MAX_ECHECS) {
      return NextResponse.json(
        { error: `Trop de tentatives. Réessaie dans ${FENETRE_MINUTES} minutes.` },
        { status: 429 }
      );
    }

    const { ancienPin, nouveauPin } = await req.json();
    if (!ancienPin || !nouveauPin) {
      return NextResponse.json({ error: "Ancien et nouveau code PIN requis." }, { status: 400 });
    }
    if (!/^\d{4,6}$/.test(nouveauPin)) {
      return NextResponse.json({ error: "Le nouveau code PIN doit contenir 4 à 6 chiffres." }, { status: 400 });
    }

    const { data: profil, error: erreurProfil } = await supabaseAdmin
      .from("users")
      .select("code_pin_hash")
      .eq("id", user.id)
      .single();
    if (erreurProfil) throw erreurProfil;

    if (!profil?.code_pin_hash) {
      return NextResponse.json({ error: "Aucun code PIN configuré pour ce compte." }, { status: 400 });
    }

    if (!verifierPin(ancienPin, profil.code_pin_hash)) {
      await supabaseAdmin.from("journal_securite").insert({ user_id: user.id, type: "pin_echoue", details: "ancien_code_pin_incorrect" });
      const tentativesRestantes = MAX_ECHECS - (echecsRecents || 0) - 1;
      return NextResponse.json({ error: "Ancien code incorrect.", tentativesRestantes }, { status: 400 });
    }

    const nouveauHachage = hacherPin(nouveauPin);
    const { error } = await supabaseAdmin.from("users").update({ code_pin_hash: nouveauHachage }).eq("id", user.id);
    if (error) throw error;

    await supabaseAdmin.from("journal_securite").insert({ user_id: user.id, type: "pin_modifie", details: "changement_reussi" });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur serveur." }, { status: 500 });
  }
}
