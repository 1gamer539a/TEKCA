/*
  Utilitaires de recherche texte partagés (navigateur ET serveur) : mots importants d'une recherche,
  sans accents, sans mots « vides » (pas, cher, prix, acheter…).
*/
export const MOTS_VIDES = new Set(["pas", "cher", "chere", "pour", "avec", "sans", "des", "les", "une", "the", "and", "for", "bon", "prix", "neuf", "occasion", "vend", "vendre", "cherche", "recherche", "veux", "voudrais", "achat", "acheter", "svp", "urgent"]);

export const normaliserTexte = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const motsSignificatifs = (texte, longueurMin = 3) =>
  normaliserTexte(texte).split(/[^a-z0-9]+/).filter((m) => m.length >= longueurMin && !MOTS_VIDES.has(m));
