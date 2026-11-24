import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../../lib/supabaseAdmin";
import { utilisateurAdmin } from "../../../../../lib/auth-serveur";
import { notifier } from "../../../../../lib/notifications";
import { reponseErreurServeur } from "../../../../../lib/erreurs";
import { refuserDoublon } from "../../../../../lib/anti-doublon";

/*
  Marquer un signalement comme RÉSOLU (ou le rouvrir) depuis la Salle de surveillance.
  Avant, il n'y avait aucun moyen d'affirmer « ce problème est réglé » : on pouvait seulement
  répondre au client. Le statut passe à « resolu », on garde qui l'a fait (traite_par) et le client
  est prévenu par notification (il peut toujours répondre dans « Mes réclamations »).
*/
export async function POST(req) {
  try {
    const admin = await utilisateurAdmin(req, "support");
    if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
    const doublon = await refuserDoublon(req, admin, { fenetre: 5 });
    if (doublon) return doublon;

    const { signalementId, action } = await req.json();
    if (!signalementId || !["resoudre", "rouvrir"].includes(action)) {
      return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
    }

    const { data: signalement, error: erreurLecture } = await supabaseAdmin
      .from("contacts_support")
      .select("id, client_id, statut")
      .eq("id", signalementId)
      .maybeSingle();
    if (erreurLecture) throw erreurLecture;
    if (!signalement) return NextResponse.json({ error: "Signalement introuvable." }, { status: 404 });

    const nouveauStatut = action === "resoudre" ? "resolu" : "en_cours";
    if (signalement.statut === nouveauStatut) return NextResponse.json({ ok: true, statut: nouveauStatut });

    const { error: erreurMaj } = await supabaseAdmin
      .from("contacts_support")
      .update({ statut: nouveauStatut, traite_par: admin.id })
      .eq("id", signalementId);
    if (erreurMaj) throw erreurMaj;

    if (action === "resoudre") {
      await notifier(supabaseAdmin, {
        user_id: signalement.client_id,
        type: "message",
        texte: "Ton signalement a été marqué comme résolu par l'équipe TEKÇA. S'il reste un problème, réponds simplement dans « Mes réclamations ».",
      });
    }

    return NextResponse.json({ ok: true, statut: nouveauStatut });
  } catch (e) {
    return reponseErreurServeur(e, "app/api/admin/signalements/resoudre");
  }
}
