/*
  Double authentification (2FA, TOTP via Supabase Auth MFA).
  Un jeton de session a un niveau "aal1" (mot de passe / OAuth) ou "aal2"
  (après saisie du code à 6 chiffres). Si l'utilisateur a activé la 2FA
  (facteur "verified"), seul un jeton aal2 est accepté : dans le middleware
  pour les pages, dans utilisateurConnecte() pour les routes API.
*/
export function niveauDuJeton(jeton) {
  try {
    const partie = (jeton || "").split(".")[1];
    if (!partie) return null;
    const json = atob(partie.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(partie.length / 4) * 4, "="));
    return JSON.parse(json).aal || null;
  } catch {
    return null;
  }
}

export function aUnFacteurVerifie(user) {
  return Array.isArray(user?.factors) && user.factors.some((f) => f.status === "verified");
}

// true = l'utilisateur a la 2FA activée mais ce jeton n'a pas passé le 2e facteur.
export function deuxFacteursManquants(user, jeton) {
  return aUnFacteurVerifie(user) && niveauDuJeton(jeton) !== "aal2";
}
