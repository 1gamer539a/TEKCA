-- ============================================================
-- ANNULATION DE COMMANDE — valeurs d'enum manquantes
-- ------------------------------------------------------------
-- Nécessaire pour app/api/commandes/[id]/annuler/route.js.
-- ALTER TYPE ... ADD VALUE ne peut pas être annulé dans la même
-- transaction que son utilisation sur certaines versions de
-- Postgres : exécute ce fichier seul, avant de tester l'annulation.
-- ============================================================

alter type statut_sequestre add value if not exists 'annule';
alter type type_transaction_wallet add value if not exists 'remboursement';
