import { supabase } from "./supabase";

/*
  « CONNEXION REQUISE » — expliquer au lieu de laisser croire à un bug.

  Quand une personne non connectée touche un bouton qui exige un compte (ajouter au panier,
  écrire à un vendeur…), on affiche une fenêtre claire : pourquoi, et deux boutons
  (Se connecter / Créer un compte). Après la connexion, elle revient là où elle était.
  Le serveur et la base refusent de toute façon les actions sans compte : ce n'est qu'un guide.
*/
export const EVENEMENT_CONNEXION = "tekca:connexion-requise";
export const RAISONS_CONNEXION = [
  "defaut", "panier", "messages", "compte", "portefeuille", "commandes", "favoris",
  "notifications", "vendre", "reclamations", "feedback", "dashboard", "ia",
];

// Lecture LOCALE de la session (aucun appel réseau) : fonctionne aussi hors connexion.
export async function estConnecte() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  } catch {
    return false;
  }
}

export function urlConnexion({ suite, raison, mode } = {}) {
  const p = new URLSearchParams();
  if (suite && suite.startsWith("/") && !suite.startsWith("//")) p.set("suite", suite);
  if (RAISONS_CONNEXION.includes(raison)) p.set("raison", raison);
  if (mode === "inscription") p.set("mode", "inscription");
  const texte = p.toString();
  return `/auth${texte ? `?${texte}` : ""}`;
}

export function demanderConnexion(raison = "defaut", suite) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(EVENEMENT_CONNEXION, { detail: { raison, suite: suite || `${window.location.pathname}${window.location.search}` } })
  );
}

// Lance `action` si la personne est connectée ; sinon affiche l'invitation. Renvoie true si l'action a été lancée.
export async function exigerConnexion(raison, suite, action) {
  if (await estConnecte()) {
    action?.();
    return true;
  }
  demanderConnexion(raison, suite);
  return false;
}
