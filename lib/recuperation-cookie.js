/*
  Cookie "récupération de mot de passe" SIGNÉ (HMAC-SHA256).

  Posé par /auth/callback UNIQUEMENT après qu'un lien de réinitialisation reçu
  par email a été validé. La route /api/auth/nouveau-mot-de-passe l'exige :
  ainsi, quelqu'un qui aurait volé une session ouverte ne peut pas changer le
  mot de passe sans l'ancien (il lui faudrait aussi l'accès à l'email).

  Format : "v1.<userId>.<expiration en secondes>.<signature>" — lié à
  l'utilisateur, valable 15 minutes, impossible à fabriquer sans le secret
  serveur (PIN_COOKIE_SECRET, ou à défaut SUPABASE_SERVICE_ROLE_KEY).
*/
export const NOM_COOKIE_RECUPERATION = "tekca_recuperation";
const DUREE_SECONDES = 15 * 60;

function secret() {
  return process.env.PIN_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

async function hmacHex(message) {
  const enc = new TextEncoder();
  const cle = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cle, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function egalConstant(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function optionsCookieRecuperation() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: DUREE_SECONDES };
}

export async function creerValeurRecuperation(userId) {
  const expiration = Math.floor(Date.now() / 1000) + DUREE_SECONDES;
  const base = `v1.${userId}.${expiration}`;
  return `${base}.${await hmacHex(base)}`;
}

export async function recuperationValide(valeur, userId) {
  if (!valeur || !secret()) return false;
  const parties = valeur.split(".");
  if (parties.length !== 4 || parties[0] !== "v1" || parties[1] !== userId) return false;
  if (Number(parties[2]) < Math.floor(Date.now() / 1000)) return false;
  return egalConstant(parties[3], await hmacHex(`v1.${parties[1]}.${parties[2]}`));
}
