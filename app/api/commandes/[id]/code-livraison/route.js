import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../../lib/auth-serveur";

/*
  Renvoie le code à 6 chiffres à l'acheteur UNIQUEMENT (jamais au
  vendeur — voir code_livraison.sql pour l'absence volontaire de
  policy RLS). À afficher dans le suivi de commande ; l'acheteur le
  communique en personne au vendeur à la remise du colis.
*/
export async function GET(req, { params }) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const commandeId = params.id;

    const { data: commande } = await supabaseAdmin
      .from("commandes")
      .select("id, client_id")
      .eq("id", commandeId)
      .single();
    if (!commande) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    if (commande.client_id !== user.id) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

    const { data: codeLivraison } = await supabaseAdmin
      .from("codes_livraison")
      .select("code, bloque, date_validation")
      .eq("commande_id", commandeId)
      .single();
    if (!codeLivraison) {
      return NextResponse.json({ error: "Pas de code de livraison pour cette commande." }, { status: 404 });
    }

    return NextResponse.json({
      code: codeLivraison.code,
      bloque: codeLivraison.bloque,
      dejaValide: !!codeLivraison.date_validation,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur inconnue" }, { status: 500 });
  }
}
