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

/*
  Réglages de notification de l'utilisateur (Mon compte > Paramètres).
  Les alertes importantes (sécurité, validation/refus de produit, solde bas)
  ne sont jamais filtrées. Pas de ligne en base = tout est actif. Une
  catégorie désactivée supprime la notification ET le push.
*/
const CHAMP_PAR_TYPE = {
  commande: "notif_commandes",
  demande_expiree: "notif_commandes",
  message: "notif_messages",
  tournoi: "notif_promotions",
};
async function destinatairesAutorises(supabaseAdmin, userIds, type) {
  const champ = CHAMP_PAR_TYPE[type];
  if (!champ || userIds.length === 0) return new Set(userIds);
  try {
    const { data } = await supabaseAdmin.from("parametres_utilisateur").select("user_id").in("user_id", userIds).eq(champ, false);
    const refus = new Set((data || []).map((r) => r.user_id));
    return new Set(userIds.filter((id) => !refus.has(id)));
  } catch {
    return new Set(userIds);
  }
}
const PREFIXE = "TEKÇA — ";

function brander(texte) {
  return texte.startsWith(PREFIXE) ? texte : `${PREFIXE}${texte}`;
}

// Une seule notification.
export async function notifier(supabaseAdmin, { user_id, type, texte }) {
  if (!user_id) return { error: null }; // appelant déjà responsable de ne pas appeler sans destinataire
  if (!(await destinatairesAutorises(supabaseAdmin, [user_id], type)).has(user_id)) return { error: null }; // catégorie désactivée par l'utilisateur
  const texteBrande = brander(texte);
  const resultat = await supabaseAdmin.from("notifications").insert({ user_id, type, texte: texteBrande });
  envoyerPush(user_id, { titre: "TEKÇA", corps: texte, url: "/notifications" }); // volontairement pas attendu (await) — ne doit jamais ralentir/bloquer l'appelant
  return resultat;
}

// Plusieurs notifications d'un coup (ex: diffusion à tous les utilisateurs).
export async function notifierPlusieurs(supabaseAdmin, notifs) {
  const candidats = notifs.filter((n) => n.user_id);
  // Filtre par catégorie, un type à la fois.
  const autorises = new Set();
  for (const type of [...new Set(candidats.map((n) => n.type))]) {
    const ids = [...new Set(candidats.filter((n) => n.type === type).map((n) => n.user_id))];
    (await destinatairesAutorises(supabaseAdmin, ids, type)).forEach((id) => autorises.add(`${type}|${id}`));
  }
  const retenues = candidats.filter((n) => autorises.has(`${n.type}|${n.user_id}`));
  const lignes = retenues.map((n) => ({ ...n, texte: brander(n.texte) }));
  if (lignes.length === 0) return { error: null };
  const resultat = await supabaseAdmin.from("notifications").insert(lignes);
  retenues.forEach((n) => {
    if (n.user_id) envoyerPush(n.user_id, { titre: "TEKÇA", corps: n.texte, url: "/notifications" });
  });
  return resultat;
}
