import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurAdmin } from "../../../../lib/auth-serveur";
import { reponseErreurServeur } from "../../../../lib/erreurs";

/*
  Remplace l'ancien appel direct depuis SalleSurveillance.jsx :
  supabase.from("users").update({ piece_identite_verifiee: true })...
  Ce champ est désormais protégé par un trigger côté base (voir
  rls_policies.sql) — seul service_role (donc cette route) peut le
  modifier, après vérification explicite du rôle admin/équipe.
*/
export async function POST(req) {
  try {
    const admin = await utilisateurAdmin(req);
    if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

    const { clientId } = await req.json();
    if (!clientId) return NextResponse.json({ error: "clientId requis." }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("users")
      .update({ piece_identite_verifiee: true })
      .eq("id", clientId);
    if (error) throw error;

    return NextResponse.json({ succes: true });
  } catch (e) {
    return reponseErreurServeur(e, "app/api/admin/verifier-identite");
  }
}
