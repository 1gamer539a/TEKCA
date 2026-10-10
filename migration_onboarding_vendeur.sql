-- ============================================================
-- MIGRATION — à exécuter dans Supabase SQL Editor
-- (fait suite aux migrations précédentes)
-- ============================================================
-- Nouveau tunnel d'inscription vendeur en 3 étapes : quartier
-- (complète la ville déjà présente), bio indexée pour la recherche,
-- catégorie principale (réutilise l'enum type_produit existant —
-- pas de nouvelle taxonomie parallèle, pour rester cohérent avec ce
-- qui filtre déjà Le Marché), et modes de remise par défaut
-- (pré-remplissent le formulaire de publication produit, qui garde
-- la possibilité de les changer annonce par annonce).

alter table vendeurs add column if not exists quartier text;
alter table vendeurs add column if not exists bio text;
alter table vendeurs add column if not exists categorie_principale type_produit;
alter table vendeurs add column if not exists modes_remise_defaut text[] not null default '{}';

alter table vendeurs drop constraint if exists bio_longueur_max;
alter table vendeurs add constraint bio_longueur_max check (bio is null or char_length(bio) <= 200);
