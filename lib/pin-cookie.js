/*
  Cookie "PIN vérifié" SIGNÉ (HMAC-SHA256), avec verrouillage par inactivité.

  Format v2 : "v2.<userId>.<délaiMin>.<expiration>.<signature>"
  - lié à l'utilisateur, impossible à fabriquer sans le secret serveur ;
  - expire <délaiMin> minutes après la DERNIÈRE requête : le middleware le
    renouvelle à chaque requête tant que l'utilisateur est actif, et le
    PIN est redemandé après une pause plus longue que le délai choisi
    dans Mon compte > Paramètres.

  Utilise Web Crypto : fonctionne dans le middleware (Edge) et les routes API.
  Secret : PIN_COOKIE_SECRET (recommandé) ou, à défaut,
  SUPABASE_SERVICE_ROLE_KEY.
*/
export const NOM_COOKIE_PIN = "tekca_pin_ok";
export const DELAI_PIN_DEFAUT_MIN = 5;
const DELAIS_VALIDES = [1, 5, 15, 30, 60];

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

// Réglage de l'utilisateur (0 = à chaque ouverture, sinon minutes) → délai
// d'inactivité effectif du cookie. "À chaque ouverture" est complété côté
// navigateur par components/GardePIN.jsx ; le cookie garde un filet de 30 min.
export function delaiEffectifMinutes(reglage) {
  const m = Number(reglage);
  if (m === 0) return 30;
  return DELAIS_VALIDES.includes(m) ? m : DELAI_PIN_DEFAUT_MIN;
}

export function optionsCookiePin() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" };
}

export async function creerValeurCookiePin(userId, delaiMin = DELAI_PIN_DEFAUT_MIN) {
  if (!secret()) throw new Error("PIN_COOKIE_SECRET (ou SUPABASE_SERVICE_ROLE_KEY) manquant côté serveur.");
  const base = `v2.${userId}.${delaiMin}.${Date.now() + delaiMin * 60 * 1000}`;
  return `${base}.${await hmacHex(base)}`;
}

// Retourne { valide, delaiMin }.
export async function lirePinCookie(valeur, userId) {
  try {
    if (!valeur || !userId || !secret()) return { valide: false };
    const p = valeur.split(".");
    if (p.length !== 5 || p[0] !== "v2" || p[1] !== userId) return { valide: false };
    const delai = Number(p[2]);
    const exp = Number(p[3]);
    if (!DELAIS_VALIDES.includes(delai) || !Number.isFinite(exp) || exp < Date.now()) return { valide: false };
    const ok = egalConstant(p[4], await hmacHex(`v2.${userId}.${p[2]}.${p[3]}`));
    return ok ? { valide: true, delaiMin: delai } : { valide: false };
  } catch {
    return { valide: false };
  }
}

export async function cookiePinValide(valeur, userId) {
  return (await lirePinCookie(valeur, userId)).valide;
}
