/*
  Adresse publique d'une boutique — la VRAIE, celle qui s'ouvre.
  (Avant, le tableau de bord affichait une fausse adresse du type
  « nom-boutique.plateforme.com » qui n'a jamais existé.)

  - revendeur officiel : tekca.store/vendeur/<nom-court>
  - vendeur simple     : tekca.store/marche/vendeur/<id>
  Même règle que la recherche (components/PageRecherche.jsx).
*/
export function cheminBoutique({ niveau, sousDomaine, id }) {
  return niveau === "revendeur_officiel" && sousDomaine ? `/vendeur/${sousDomaine}` : `/marche/vendeur/${id}`;
}

export function lienBoutique(boutique) {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "https://tekca.store")
  ).replace(/\/$/, "");
  return `${base}${cheminBoutique(boutique)}`;
}
