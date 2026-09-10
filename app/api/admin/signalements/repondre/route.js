import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../../lib/supabaseAdmin";
import { utilisateurAdmin } from "../../../../../lib/auth-serveur";

/*
  CORRECTIF — le bouton "Répondre" dans la Salle de surveillance
  n'avait aucun onClick : impossible de répondre à un signalement
  depuis l'admin. Comme `contacts_support` n'a pas de colonne dédiée
  au texte de réponse, on envoie la réponse comme une notification
  classique au client (réutilise `notifications`, déjà affiché dans
  son app) plutôt que d'ajouter une nouvelle colonne/table pour ça.
*/
export async function POST(req) {
  try {
    const admin = await utilisateurAdmin(req);
    if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

    const { signalementId, reponse } = await req.json();
    if (!signalementId || !reponse?.trim()) {
      return NextResponse.json({ error: "Réponse vide." }, { status: 400 });
    }

    const { data: signalement, error: erreurSignalement } = await supabaseAdmin
      .from("contacts_support")
      .select("id, client_id")
      .eq("id", signalementId)
      .single();
    if (erreurSignalement || !signalement) return NextResponse.json({ error: "Signalement introuvable." }, { status: 404 });

    const { error: erreurNotif } = await supabaseAdmin.from("notifications").insert({
      user_id: signalement.client_id,
      type: "message",
      texte: `Réponse de l'équipe TEKÇA : ${reponse.trim()}`,
    });
    if (erreurNotif) throw erreurNotif;

    const { error: erreurMaj } = await supabaseAdmin
      .from("contacts_support")
      .update({ statut: "resolu", traite_par: admin.id })
      .eq("id", signalementId);
    if (erreurMaj) throw erreurMaj;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur serveur." }, { status: 500 });
  }
}
