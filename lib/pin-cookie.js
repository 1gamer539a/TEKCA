/*
  Cookie "PIN vérifié" SIGNÉ (HMAC-SHA256).

  AVANT : le cookie tekca_pin_ok valait simplement "1" — n'importe qui
  pouvait le fabriquer à la main et passer le contrôle du middleware.
  MAINTENANT : la valeur est "v1.<userId>.<expiration>.<signature>".
  Elle est liée à l'utilisateur, expire côté serveur et ne peut être
  produite que par un serveur qui connaît le secret.

  Utilise Web Crypto (crypto.subtle) : fonctionne à la fois dans le
  middleware (runtime Edge) et dans les routes API (Node).

  Secret : PIN_COOKIE_SECRET (recommandé, à ajouter dans Vercel) ; à
  défaut SUPABASE_SERVICE_ROLE_KEY, déjà présente côté serveur.
*/
export const NOM_COOKIE_PIN = "tekca_pin_ok";
const DUREE_MS = 12 * 60 * 60 * 1000; // 12 h

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

export async function creerValeurCookiePin(userId) {
  if (!secret()) throw new Error("PIN_COOKIE_SECRET (ou SUPABASE_SERVICE_ROLE_KEY) manquant côté serveur.");
  const base = `v1.${userId}.${Date.now() + DUREE_MS}`;
  return `${base}.${await hmacHex(base)}`;
}

export async function cookiePinValide(valeur, userId) {
  try {
    if (!valeur || !userId || !secret()) return false;
    const p = valeur.split(".");
    if (p.length !== 4 || p[0] !== "v1" || p[1] !== userId) return false;
    const exp = Number(p[2]);
    if (!Number.isFinite(exp) || exp < Date.now()) return false;
    return egalConstant(p[3], await hmacHex(`v1.${userId}.${p[2]}`));
  } catch {
    return false;
  }
}
