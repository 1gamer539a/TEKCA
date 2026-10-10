/*
  MODE MAINTENANCE — interrupteur d'arrêt d'urgence de TEKÇA.
  État stocké dans la table `etat_systeme` (migration_maintenance.sql),
  modifié depuis la Salle de surveillance (onglet Maintenance) ou, en plan B,
  par une ligne SQL dans Supabase. Lu par le middleware (Edge) avec un cache
  de 5 secondes par instance.

  Sécurité : en cas d'erreur de lecture, on garde le DERNIER état connu
  (jamais d'ouverture ou de fermeture accidentelle) ; sans état connu, le
  site reste ouvert.
*/
const TTL_MS = 5000;
let cache = { t: 0, etat: { actif: false, message: null } };

export async function lireEtatMaintenance() {
  const maintenant = Date.now();
  if (maintenant - cache.t < TTL_MS) return cache.etat;
  let etat = cache.etat;
  try {
    const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const reponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/etat_systeme?id=eq.1&select=maintenance,message`, {
      headers: { apikey: cle, Authorization: `Bearer ${cle}` },
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (reponse.ok) {
      const [ligne] = await reponse.json();
      etat = { actif: !!ligne?.maintenance, message: ligne?.message || null };
    }
  } catch {
    /* on garde l'état précédent */
  }
  cache = { t: maintenant, etat };
  return etat;
}

// Toujours accessibles, même en maintenance : la page de maintenance, l'état
// public, et la notification de paiement du prestataire (pour que les
// paiements déjà effectués soient bien crédités).
const CHEMINS_TOUJOURS_OUVERTS = ["/maintenance", "/api/etat-systeme", "/api/wallet/webhook-sebpay"];
// Pages et routes de connexion : l'équipe doit pouvoir se connecter pour désactiver la maintenance.
const PREFIXES_CONNEXION = ["/auth", "/api/auth", "/api/securite/pin"];

export function cheminToujoursOuvert(chemin) {
  return CHEMINS_TOUJOURS_OUVERTS.some((c) => chemin === c || chemin.startsWith(c + "/"));
}
export function cheminConnexionOuvert(chemin) {
  return PREFIXES_CONNEXION.some((p) => chemin === p || chemin.startsWith(p + "/"));
}
export const MESSAGE_MAINTENANCE_API = "TEKÇA est en maintenance. Réessaie dans quelques instants.";
