/** @type {import('next').NextConfig} */
/*
  En-têtes de sécurité appliqués à toutes les pages.
  - La Content-Security-Policy (avec nonces) n'est PAS ici : elle change à chaque requête,
    donc elle est posée par middleware.js (règle dans lib/csp.js, mode via CSP_MODE).
  - frame-ancestors 'none' + X-Frame-Options : empêche d'afficher TEKÇA dans une iframe
    (clickjacking).
*/
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=()" },
        ],
      },
      {
        // sw.js doit toujours être re-vérifié par le navigateur — sans
        // ça, une mise à jour du Service Worker (nouvelle logique de
        // notification, etc.) pourrait mettre des jours à atteindre
        // les utilisateurs à cause du cache CDN de Vercel.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
};

module.exports = nextConfig;
