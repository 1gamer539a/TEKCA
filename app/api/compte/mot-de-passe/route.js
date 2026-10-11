import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { controlerPin } from "../../../../lib/pin-serveur";

/*
  Modification du mot de passe (Mon compte > Paramètres).
  Exige : session valide + ANCIEN mot de passe + code PIN (revérifié côté
  serveur). Les autres appareils sont déconnectés après le changement.
  Les comptes Google / Facebook / Apple n'ont pas de mot de passe TEKÇA.
*/
export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    if (user.app_metadata?.provider !== "email" || !user.email) {
      return NextResponse.json({ error: "Ce compte n'a pas de mot de passe." }, { status: 400 });
    }

    const corps = await req.json();
    const ancien = corps.ancienMotDePasse ?? corps.ancien;
    const nouveau = corps.nouveauMotDePasse ?? corps.nouveau;
    const pin = corps.pin;
    if (typeof ancien !== "string" || typeof nouveau !== "string" || nouveau.length < 8 || nouveau.length > 128) {
      return NextResponse.json({ error: "Le nouveau mot de passe doit contenir au moins 8 caractères." }, { status: 400 });
    }
    if (ancien === nouveau) {
      return NextResponse.json({ error: "Le nouveau mot de passe doit être différent de l'ancien." }, { status: 400 });
    }

    const verifPin = await controlerPin(user.id, pin);
    if (!verifPin.ok) return NextResponse.json({ error: verifPin.error, tentativesRestantes: verifPin.tentativesRestantes }, { status: verifPin.status });

    // Vérifie l'ancien mot de passe avec un client jetable (aucune session existante touchée).
    const verif = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: erreurAncien } = await verif.auth.signInWithPassword({ email: user.email, password: ancien });
    if (erreurAncien) return NextResponse.json({ error: "Ancien mot de passe incorrect.", code: "ancien_incorrect" }, { status: 400 });

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: nouveau });
    if (error) return NextResponse.json({ error: error.message || "Modification impossible." }, { status: 400 });

    const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
    if (token) await supabaseAdmin.auth.admin.signOut(token, "others").catch(() => {});
    return NextResponse.json({ succes: true });
  } catch (e) {
    console.error("Changement de mot de passe :", e);
    return NextResponse.json({ error: "Modification impossible. Réessaie plus tard." }, { status: 500 });
  }
}
