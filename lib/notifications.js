/*
  Point de passage UNIQUE pour créer une notification in-app —
  préfère toujours ceci à un `.from("notifications").insert(...)`
  direct, pour que CHAQUE notification affichée porte le nom de
  TEKÇA (comme le ferait une vraie notification push), et pour ne
  jamais avoir à corriger le même détail à N endroits différents.

  Pas de vraie infra SMS/push (FCM, OneSignal...) branchée sur ce
  projet — voir le commentaire dans app/api/admin/diffusion/route.js.
  Ceci ne couvre donc que les notifications in-app (table
  `notifications`, celles que Notifications.jsx affiche).
*/
const PREFIXE = "TEKÇA — ";

function brander(texte) {
  return texte.startsWith(PREFIXE) ? texte : `${PREFIXE}${texte}`;
}

// Une seule notification.
export async function notifier(supabaseAdmin, { user_id, type, texte }) {
  if (!user_id) return { error: null }; // appelant déjà responsable de ne pas appeler sans destinataire
  return supabaseAdmin.from("notifications").insert({ user_id, type, texte: brander(texte) });
}

// Plusieurs notifications d'un coup (ex: diffusion à tous les utilisateurs).
export async function notifierPlusieurs(supabaseAdmin, notifs) {
  const lignes = notifs.filter((n) => n.user_id).map((n) => ({ ...n, texte: brander(n.texte) }));
  if (lignes.length === 0) return { error: null };
  return supabaseAdmin.from("notifications").insert(lignes);
}
