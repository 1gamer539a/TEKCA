import { supabase } from "./supabase";

/*
  PRÉCHARGEMENT PENDANT L'ÉCRAN DE DÉMARRAGE (components/EcranDemarrage.jsx)

  Pendant que le logo et « Bienvenue sur TEKÇA » s'animent, on prépare déjà :
  - la session (connecté ou non) ;
  - le profil minimal (nom, pseudo, rôle) ;
  - le préchargement des pages principales, pour que la première navigation soit immédiate
    (et la Salle de surveillance pour un membre d'équipe).
  On ne stocke JAMAIS de données financières ici (ni solde, ni transactions) : seulement
  de quoi accueillir la personne. Vidé à la déconnexion (voir EnregistrerServiceWorker).
*/
export const CLE_PRECHARGE = "tekca_precharge";

export function lirePrechargement() {
  try {
    return JSON.parse(sessionStorage.getItem(CLE_PRECHARGE) || "null");
  } catch {
    return null;
  }
}

export function viderPrechargement() {
  try {
    sessionStorage.removeItem(CLE_PRECHARGE);
  } catch {}
}

// Ne rejette jamais : au pire, le démarrage se termine avec une session vide.
export async function preparerSession(router) {
  const dernier = lirePrechargement();
  // Hors connexion : on garde ce qu'on savait déjà, sans rien demander au réseau.
  if (typeof navigator !== "undefined" && navigator.onLine === false) return dernier || { connecte: false };

  const resultat = { connecte: false, t: Date.now() };
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      resultat.connecte = true;
      resultat.userId = user.id;
      const { data: profil } = await supabase.from("users").select("nom, pseudo, role").eq("id", user.id).maybeSingle();
      if (profil) {
        resultat.nom = profil.nom || null;
        resultat.pseudo = profil.pseudo || null;
        resultat.role = profil.role || null;
      }
      try {
        ["/marche", "/panier", "/messages", "/compte"].forEach((p) => router?.prefetch?.(p));
        if (["admin", "equipe"].includes(resultat.role)) router?.prefetch?.("/admin");
      } catch {}
    }
  } catch {
    // réseau lent ou session expirée : on continue avec un résultat « non connecté »
  }

  try {
    sessionStorage.setItem(CLE_PRECHARGE, JSON.stringify(resultat));
    window.dispatchEvent(new CustomEvent("tekca:precharge", { detail: resultat }));
  } catch {}
  return resultat;
}
