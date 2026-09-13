import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurAdmin } from "../../../../lib/auth-serveur";

/*
  CORRECTIF — "Diffuser un message" n'écrivait qu'une ligne dans
  campagnes_notification (un historique de campagne, sans user_id),
  jamais dans `notifications` — la seule table que les utilisateurs
  voient réellement (voir Notifications.jsx). Résultat : le message
  n'atteignait jamais personne, quel que soit le canal choisi.

  Canal "push" : livré comme notification in-app à tous les
  utilisateurs (pas de vraie infra push/FCM dans ce projet — c'est le
  seul canal de diffusion réellement possible aujourd'hui).
  Canaux "sms" / "whatsapp" : aucun fournisseur SMS/WhatsApp n'est
  intégré dans ce projet — la campagne est journalisée mais PAS
  réellement envoyée. Le dire clairement plutôt que de faire croire
  qu'un SMS part alors qu'aucun n'existe.
*/
export async function POST(req) {
  try {
    const admin = await utilisateurAdmin(req);
    if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

    const { titre, message, canal } = await req.json();
    if (!titre?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "Titre et message requis." }, { status: 400 });
    }

    const { error: erreurCampagne } = await supabaseAdmin
      .from("campagnes_notification")
      .insert({ titre, message, canal, envoye_par: admin.id });
    if (erreurCampagne) throw erreurCampagne;

    if (canal !== "push") {
      return NextResponse.json({
        ok: true,
        avertissement: `Campagne enregistrée, mais aucun fournisseur ${canal.toUpperCase()} n'est branché sur ce projet — rien n'a été envoyé pour de vrai.`,
      });
    }

    const { data: utilisateurs, error: erreurUsers } = await supabaseAdmin.from("users").select("id");
    if (erreurUsers) throw erreurUsers;

    if (utilisateurs?.length) {
      const lignes = utilisateurs.map((u) => ({ user_id: u.id, type: "message", texte: `${titre} — ${message}` }));
      const { error: erreurNotifs } = await supabaseAdmin.from("notifications").insert(lignes);
      if (erreurNotifs) throw erreurNotifs;
    }

    return NextResponse.json({ ok: true, destinataires: utilisateurs?.length || 0 });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur serveur." }, { status: 500 });
  }
}
