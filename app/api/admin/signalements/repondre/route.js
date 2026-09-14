import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../../lib/supabaseAdmin";
import { utilisateurAdmin } from "../../../../../lib/auth-serveur";

/*
  CORRECTIF — le bouton "Répondre" dans la Salle de surveillance
  n'avait aucun onClick : impossible de répondre à un signalement
  depuis l'admin. La réponse s'écrit maintenant dans messages_support
  (fil partagé avec le client, voir migration_fil_support.sql) au
  lieu d'une simple notification à sens unique — le client peut la
  voir dans "Mes réclamations" et y répondre à son tour.
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

    const { error: erreurMessage } = await supabaseAdmin.from("messages_support").insert({
      contact_id: signalementId,
      expediteur_id: admin.id,
      contenu: reponse.trim(),
    });
    if (erreurMessage) throw erreurMessage;

    const { error: erreurNotif } = await supabaseAdmin.from("notifications").insert({
      user_id: signalement.client_id,
      type: "message",
      texte: `Réponse de l'équipe TEKÇA à ta réclamation — va voir dans "Mes réclamations".`,
    });
    if (erreurNotif) throw erreurNotif;

    const { error: erreurMaj } = await supabaseAdmin
      .from("contacts_support")
      .update({ statut: "en_cours", traite_par: admin.id })
      .eq("id", signalementId);
    if (erreurMaj) throw erreurMaj;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur serveur." }, { status: 500 });
  }
}
