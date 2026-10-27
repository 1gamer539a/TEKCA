/*
  CONTENT-SECURITY-POLICY À NONCES — générée à chaque requête par middleware.js.

  Un "nonce" est un code aléatoire à usage unique, propre à chaque affichage de
  page. Seuls les scripts qui portent ce code sont exécutés : un script glissé
  par un pirate dans une page n'a pas le code, donc le navigateur le refuse.
  (Contrairement à 'unsafe-inline' qui autorisait n'importe quel script.)

  - 'strict-dynamic' : un script autorisé par nonce peut en charger d'autres
    (c'est ainsi que Next.js charge ses fichiers).
  - Les STYLES gardent 'unsafe-inline' : React écrit des styles en ligne
    partout (style={{...}}) et un nonce ne peut pas les couvrir. Un style
    injecté est bien moins dangereux qu'un script injecté.

  Fonctionne sur le runtime "Edge" du middleware (pas de module Node).
*/
export function creerNonce() {
  const octets = new Uint8Array(16);
  crypto.getRandomValues(octets);
  let texte = "";
  octets.forEach((o) => { texte += String.fromCharCode(o); });
  return btoa(texte);
}

export function modeCsp() {
  const m = (process.env.CSP_MODE || "report-only").toLowerCase();
  return ["enforce", "report-only", "off"].includes(m) ? m : "report-only";
}

export function nomEnteteCsp(mode) {
  return mode === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
}

export function construireCsp(nonce) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseWs = supabaseUrl.replace(/^https:/, "wss:");
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https: ${supabaseUrl}`.trim(),
    `connect-src 'self' ${supabaseUrl} ${supabaseWs} https://*.supabase.co wss://*.supabase.co`.replace(/\s+/g, " ").trim(),
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
