import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../../lib/supabaseAdmin";
import { utilisateurAdmin } from "../../../../../lib/auth-serveur";

/*
  CORRECTIF — "Valider"/"Refuser" un produit appelait directement
  supabase.from("produits").update(...) depuis le navigateur avec la
  session normale de l'admin. Mais un trigger (proteger_statut_produit,
  rls_policies.sql) bloque tout changement de statut_validation sauf
  venant de service_role — la mise à jour échouait donc en silence à
  chaque clic (l'admin voyait la carte disparaître localement, mais
  rien n'était réellement écrit, donc le produit n'apparaissait jamais
  sur Le Marché). Cette route utilise supabaseAdmin (service_role),
  qui passe le trigger normalement.
*/
export async function POST(req) {
  try {
    const admin = await utilisateurAdmin(req);
    if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

    const { produitId, valide } = await req.json();
    if (!produitId) return NextResponse.json({ error: "Produit requis." }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("produits")
      .update({ statut_validation: valide ? "valide" : "refuse" })
      .eq("id", produitId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur serveur." }, { status: 500 });
  }
}
