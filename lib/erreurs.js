import { NextResponse } from "next/server";

/*
  Réponse d'erreur serveur SANS détail technique.

  Avant, beaucoup de routes renvoyaient telle quelle `e.message` : noms de
  tables ou de colonnes, textes d'erreur du prestataire de paiement, noms de
  variables d'environnement… autant de pistes pour une personne mal
  intentionnée. Maintenant l'utilisateur voit un message neutre, et le détail
  complet reste dans les journaux du serveur (Vercel > Logs), préfixé par la
  route concernée.

  Exception : une erreur marquée `publique` (voir lib/identite.js) est un
  message écrit pour l'utilisateur et reste affichée.
*/
export const MESSAGE_ERREUR_GENERIQUE = "Une erreur est survenue. Réessaie dans un instant.";

export function reponseErreurServeur(e, contexte, statut = 500) {
  console.error(`[${contexte}]`, e);
  const message = e && e.publique && typeof e.message === "string" ? e.message : MESSAGE_ERREUR_GENERIQUE;
  return NextResponse.json({ error: message }, { status: statut });
}
