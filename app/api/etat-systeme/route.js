import { NextResponse } from "next/server";
import supabaseAdmin from "../../../lib/supabaseAdmin";
import { utilisateurAdmin } from "../../../lib/auth-serveur";

/*
  État PUBLIC du mode maintenance (accessible même pendant la maintenance).
  `equipe` vaut true pour un admin / membre de l'équipe connecté : l'appli
  ne le redirige alors pas vers la page de maintenance.
*/
export async function GET(req) {
  const en_tete = { "Cache-Control": "no-store" };
  try {
    const { data } = await supabaseAdmin.from("etat_systeme").select("maintenance, message").eq("id", 1).maybeSingle();
    const equipe = !!(await utilisateurAdmin(req).catch(() => null));
    return NextResponse.json({ maintenance: !!data?.maintenance, message: data?.message || null, equipe }, { headers: en_tete });
  } catch {
    return NextResponse.json({ maintenance: false, message: null, equipe: false }, { headers: en_tete });
  }
}
