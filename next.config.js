/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
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
