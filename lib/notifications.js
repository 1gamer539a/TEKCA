/*
  Point de passage UNIQUE pour créer une notification in-app —
  préfère toujours ceci à un `.from("notifications").insert(...)`
  direct, pour que CHAQUE notification affichée porte le nom de
  TEKÇA (comme le ferait une vraie notification push), et pour ne
  jamais avoir à corriger le même détail à N endroits différents.

  Déclenche aussi un vrai push navigateur/système (voir
  lib/push-serveur.js et public/sw.js) — chaque appelant existant
  en bénéficie automatiquement, rien à changer ailleurs.
*/
import { envoyerPush } from "./push-serveur";

const PREFIXE = "TEKÇA — ";

function brander(texte) {
  return texte.startsWith(PREFIXE) ? texte : `${PREFIXE}${texte}`;
}

// Une seule notification.
export async function notifier(supabaseAdmin, { user_id, type, texte }) {
  if (!user_id) return { error: null }; // appelant déjà responsable de ne pas appeler sans destinataire
  const texteBrande = brander(texte);
  const resultat = await supabaseAdmin.from("notifications").insert({ user_id, type, texte: texteBrande });
  envoyerPush(user_id, { titre: "TEKÇA", corps: texte, url: "/notifications" }); // volontairement pas attendu (await) — ne doit jamais ralentir/bloquer l'appelant
  return resultat;
}

// Plusieurs notifications d'un coup (ex: diffusion à tous les utilisateurs).
export async function notifierPlusieurs(supabaseAdmin, notifs) {
  const lignes = notifs.filter((n) => n.user_id).map((n) => ({ ...n, texte: brander(n.texte) }));
  if (lignes.length === 0) return { error: null };
  const resultat = await supabaseAdmin.from("notifications").insert(lignes);
  notifs.forEach((n) => {
    if (n.user_id) envoyerPush(n.user_id, { titre: "TEKÇA", corps: n.texte, url: "/notifications" });
  });
  return resultat;
}
