import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";

/*
  Résilier n'interrompt PAS l'abonnement en cours — la période déjà
  payée continue jusqu'à sa date_fin normale, avec tous ses
  avantages. Ça arrête uniquement le renouvellement automatique qui
  aurait dû se déclencher à l'échéance (voir /api/cron/rappels-abonnement).
*/
export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { error } = await supabaseAdmin
      .from("abonnements_utilisateur")
      .update({ renouvellement_auto: false })
      .eq("user_id", user.id)
      .eq("statut", "actif");
    if (error) throw error;

    return NextResponse.json({ succes: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur inconnue" }, { status: 500 });
  }
}
