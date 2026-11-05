export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/", "/admin", "/dashboard", "/compte", "/portefeuille", "/messages",
          "/commandes", "/favoris", "/notifications", "/securite", "/auth",
          "/panier", "/reclamations", "/feedback", "/verification-identite",
        ],
      },
    ],
    sitemap: "https://tekca.store/sitemap.xml",
  };
}
