-- ============================================================
-- TEKÇA — migration 2 / 3 — à exécuter EN PREMIER, SEULE
-- (Supabase : une ajout de valeur d'enum doit être validé avant d'être utilisé
--  par la migration 3, donc ces deux lignes se lancent séparément, d'abord.)
-- Sans danger si relancée.
-- ============================================================

-- Nouvelle catégorie « Téléphones » (séparée de High-Tech)
alter type type_produit add value if not exists 'telephone';

-- Nouveau type de notification : alerte de recherche du Marché
alter type notif_type add value if not exists 'alerte_recherche';
