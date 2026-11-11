/*
  Cohérence catégorie / livraison pour la mise en ligne d'un produit.

  - Catégories NUMÉRIQUES (Coffre-fort) : livraison instantanée uniquement,
    pas de zone de couverture, pas de preuve de possession.
  - Catégories PHYSIQUES : remise à domicile et/ou en main propre,
    jamais « instantané ».
  - immobilier et vehicule : annonces « contact uniquement » (aucun mode de
    remise, aucun paiement par TEKÇA), voir migration_annonces_abonnement.sql.

  Même règle côté base de données : migration_coherence_categories.sql.
*/
export const CATEGORIES_NUMERIQUES = ["recharge_jeu", "abonnement_service", "ebook", "template"];
export const CATEGORIES_PHYSIQUES = ["accessoire", "vetement", "mode_beaute", "jouet_enfant", "console_gaming", "high_tech", "meuble_deco"];
// Annonces « contact uniquement » : pas de paiement TEKÇA, abonnement payant + identité vérifiée.
export const CATEGORIES_ANNONCE_SEULE = ["immobilier", "vehicule"];
export const TOUS_LES_MODES = ["domicile", "main_propre", "instantane"];

export function estNumerique(categorie) {
  return CATEGORIES_NUMERIQUES.includes(categorie);
}
export function estAnnonceSeule(categorie) {
  return CATEGORIES_ANNONCE_SEULE.includes(categorie);
}
export function estPhysique(categorie) {
  return CATEGORIES_PHYSIQUES.includes(categorie);
}
// Modes de remise proposés pour une catégorie.
export function modesAutorises(categorie) {
  if (estNumerique(categorie)) return ["instantane"];
  if (estPhysique(categorie)) return ["domicile", "main_propre"];
  if (estAnnonceSeule(categorie)) return []; // pas de livraison TEKÇA pour une annonce
  return TOUS_LES_MODES;
}
