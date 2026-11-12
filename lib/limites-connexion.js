/*
  Utilitaires partagés par /api/auth/verifier-limite et
  /api/auth/journaliser-echec.

  Limitation anti brute-force sur 3 axes :
  - email + IP : 5 échecs / 15 min (bloque l'attaquant sans toucher la
    victime, qui se connecte depuis une autre IP)
  - email seul : 30 échecs / 15 min (freine une attaque répartie sur
    beaucoup d'IP, sans qu'une seule IP puisse verrouiller un compte)
  - IP seule   : 20 échecs / 15 min (balayage de plusieurs emails)
*/
export const FENETRE_MINUTES = 15;
export const MAX_ECHECS_EMAIL_IP = 5;
export const MAX_ECHECS_EMAIL_TOTAL = 30;
export const MAX_ECHECS_IP = 20;

export function ipClient(req) {
  const brute =
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "";
  return /^[0-9a-fA-F:.]{3,45}$/.test(brute) ? brute : "inconnue";
}

// Retourne l'email normalisé, ou null s'il est invalide / contient des
// caractères spéciaux de motif (%, *, \, virgule, parenthèses, espaces).
export function emailNormalise(email) {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  if (!e || e.length > 254 || /[%*\\,()\s]/.test(e)) return null;
  return e;
}
