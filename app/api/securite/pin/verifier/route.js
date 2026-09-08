import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../../lib/auth-serveur";
import { verifierPin } from "../../../../../lib/pin";

const FENETRE_MINUTES = 15;
const MAX_ECHECS = 5;

export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    // Limitation anti brute-force — même logique que pour la
    // connexion (voir /api/auth/verifier-limite) : 5 échecs / 15 min
    // bloquent temporairement, propre à ce compte.
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

    const { pin } = await req.json();
    if (!pin) return NextResponse.json({ error: "Code PIN requis." }, { status: 400 });

    const { data: profil, error: erreurProfil } = await supabaseAdmin
      .from("users")
      .select("code_pin_hash")
      .eq("id", user.id)
      .single();
    if (erreurProfil) throw erreurProfil;

    if (!profil?.code_pin_hash) {
      return NextResponse.json({ error: "Aucun code PIN configuré pour ce compte." }, { status: 400 });
    }

    const valide = verifierPin(pin, profil.code_pin_hash);

    if (!valide) {
      await supabaseAdmin.from("journal_securite").insert({ user_id: user.id, type: "pin_echoue", details: "code_pin_incorrect" });
      const tentativesRestantes = MAX_ECHECS - (echecsRecents || 0) - 1;
      return NextResponse.json({ error: "Code incorrect.", tentativesRestantes }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur serveur." }, { status: 500 });
  }
}
