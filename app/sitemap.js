const BASE = "https://tekca.store";

// Pages publiques et stables. Les fiches produit (/produit/[id]) pourront
// être ajoutées ici plus tard en lisant la base.
const PAGES = [
  { chemin: "", priorite: 1 },
  { chemin: "/a-propos", priorite: 0.9 },
  { chemin: "/marche", priorite: 0.8 },
  { chemin: "/categories", priorite: 0.8 },
  { chemin: "/abonnements", priorite: 0.7 },
  { chemin: "/tournois", priorite: 0.7 },
  { chemin: "/formation/createurs", priorite: 0.6 },
  { chemin: "/formation/entrepreneurs", priorite: 0.6 },
  { chemin: "/marketing-digital", priorite: 0.6 },
  { chemin: "/ventes-flash", priorite: 0.6 },
  { chemin: "/contact", priorite: 0.4 },
  { chemin: "/cgu", priorite: 0.3 },
  { chemin: "/confidentialite", priorite: 0.3 },
  { chemin: "/mentions-legales", priorite: 0.3 },
];

export default function sitemap() {
  const maintenant = new Date();
  return PAGES.map((p) => ({ url: `${BASE}${p.chemin}`, lastModified: maintenant, priority: p.priorite }));
}
