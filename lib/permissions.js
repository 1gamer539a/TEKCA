/*
  RÔLES D'ÉQUIPE — source unique, utilisée par le serveur ET l'interface.

  Deux niveaux :
  - ADMIN PRINCIPAL (users.role = 'admin') : voit tout, y compris la
    "Vue d'ensemble" et l'onglet "Équipe" où il attribue les rôles.
  - ÉQUIPE (users.role = 'equipe') : ne voit QUE les domaines qui lui
    ont été attribués (table equipe_permissions). Aucun domaine attribué
    = aucun accès (refus par défaut).

  Un "poste" n'est qu'un raccourci d'attribution : en base on stocke les
  permissions elles-mêmes, ce qui permet aussi de les cocher une à une.
  La même liste de permissions est utilisée par les politiques RLS
  (fonction SQL a_permission) — voir migration_roles_equipe.sql.
*/

export const PERMISSIONS = [
  { id: "support", label: "Relation client", description: "Signalements, chats, avis, FAQ, agents de livraison" },
  { id: "kyc", label: "Vérification (KYC)", description: "Identités, documents et statut des vendeurs" },
  { id: "catalogue", label: "Catalogue", description: "Validation des produits en attente" },
  { id: "finance", label: "Finances", description: "Finances, commissions, retraits, séquestres, taux de change" },
  { id: "marketing", label: "Marketing & événements", description: "Bannières, codes promo, diffusion, tournois, formations, attributions" },
  { id: "technique", label: "Technique & sécurité", description: "Maintenance, journaux IA et sécurité" },
  { id: "utilisateurs", label: "Utilisateurs", description: "Liste complète des utilisateurs, fiches et relevés" },
  { id: "data", label: "Data & prévisions", description: "Vue d'ensemble globale en lecture seule : chiffres agrégés, tendances et prévisions (aucune donnée personnelle)" },
];

export const IDS_PERMISSIONS = PERMISSIONS.map((p) => p.id);

export const POSTES = {
  relation_client: { label: "Relation client", permissions: ["support"] },
  verificateur: { label: "Vérificateur KYC", permissions: ["kyc"] },
  moderateur: { label: "Modérateur catalogue", permissions: ["catalogue"] },
  comptable: { label: "Finances", permissions: ["finance"] },
  marketing: { label: "Marketing & événements", permissions: ["marketing"] },
  technique: { label: "Technique", permissions: ["technique"] },
  data: { label: "Data & prévisions", permissions: ["data"] },
  personnalise: { label: "Personnalisé", permissions: [] },
};

// Onglet de la Salle de surveillance → permission requise.
// "super" = réservé à l'admin principal.
export const PERMISSION_PAR_ONGLET = {
  apercu: "super",
  equipe: "super",
  // Mini vue d'ensemble : chiffres du/des domaine(s) du membre d'équipe.
  apercu_role: "membre",
  // Analyses globales agrégées (rôle Data) — l'admin principal les voit aussi.
  analyses: "data",
  finances: "finance",
  catalogue: "finance", // taux de commission par catégorie
  retraits: "finance",
  sequestres: "finance",
  taux: "finance",
  signalements: "support",
  chats: "support",
  livraison: "support",
  faq: "support",
  feedbacks: "support",
  kyc: "kyc",
  vendeurs: "kyc",
  produits: "catalogue",
  utilisateurs: "utilisateurs",
  maintenance: "technique",
  ia_securite: "technique",
  marketing: "marketing",
  tournois_admin: "marketing",
  formation_admin: "marketing",
  attributions: "marketing",
};

export function ongletAutorise(idOnglet, { estSuperAdmin, permissions = [] }) {
  const requise = PERMISSION_PAR_ONGLET[idOnglet];
  if (!requise) return false; // onglet inconnu : refusé par défaut
  // "membre" = onglet réservé aux membres d'équipe avec au moins un domaine
  // (l'admin principal a déjà la vue d'ensemble complète).
  if (requise === "membre") return !estSuperAdmin && permissions.some((p) => p !== "data"); // le rôle Data a sa propre page "Analyses"
  if (estSuperAdmin) return true;
  if (requise === "super") return false;
  return permissions.includes(requise);
}

export function permissionsValides(liste) {
  return Array.isArray(liste) && liste.every((p) => IDS_PERMISSIONS.includes(p));
}
