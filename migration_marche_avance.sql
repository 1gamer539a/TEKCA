-- ============================================================
-- MIGRATION — à exécuter dans Supabase SQL Editor
-- (fait suite à migration_pin_journal_securite.sql)
-- ============================================================

-- 1) Présence / disponibilité vendeur
-- "en_ligne" n'est pas stocké tel quel : c'est calculé côté
-- application à partir de derniere_activite (ex. "en ligne" si vu il
-- y a moins de 5 min) — évite un état à synchroniser en plus.
alter table vendeurs add column if not exists derniere_activite timestamptz;
alter table vendeurs add column if not exists en_pause boolean not null default false;
alter table vendeurs add column if not exists message_pause text;

-- 2) Modes de remise & zone de couverture (par produit — un vendeur
-- peut livrer différemment selon l'article : un jeu digital n'a pas
-- besoin de "main propre").
alter table produits add column if not exists modes_remise text[] not null default '{}';
alter table produits add column if not exists zone_couverture text;

-- 3) Signalement de boutique / produit — PAS BESOIN d'une nouvelle
-- table : `contacts_support` (motif_contact incluant 'vendeur') fait
-- déjà exactement ça, avec en plus le gel automatique du wallet visé
-- (voir /api/signalements/creer/route.js, déjà en place). Le bouton
-- "Signaler le vendeur" appelle cette route existante.

-- 4) Expiration des demandes vendeur en attente — évite de renotifier
-- l'équipe à chaque exécution du cron une fois l'alerte déjà envoyée.
alter table vendeurs add column if not exists alerte_expiration_envoyee boolean not null default false;

-- 5) Nouveau type de notification pour l'expiration d'une demande
-- vendeur (le signalement, lui, réutilise le type 'message' déjà
-- existant — voir /api/signalements/creer/route.js).
alter type notif_type add value if not exists 'demande_expiree';
