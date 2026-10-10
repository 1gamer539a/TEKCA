-- À exécuter dans Supabase (SQL Editor) AVANT de déployer la nouvelle version.
-- Position APPROXIMATIVE d'un produit (arrondie à ~1 km par l'application),
-- utilisée uniquement pour le tri « Près de moi » dans la recherche.
-- Facultative : un produit sans position fonctionne comme avant.
alter table produits add column if not exists latitude numeric(8,5);
alter table produits add column if not exists longitude numeric(8,5);

alter table produits drop constraint if exists produits_position_valide;
alter table produits add constraint produits_position_valide check (
  (latitude is null and longitude is null)
  or (latitude between -90 and 90 and longitude between -180 and 180)
);
