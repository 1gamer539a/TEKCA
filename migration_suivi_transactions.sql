-- ============================================================
-- SUIVI DES RECHARGES / RETRAITS — à exécuter UNE FOIS
-- dans Supabase SQL Editor (après les 3 migrations précédentes).
-- ------------------------------------------------------------
-- Le portefeuille affiche maintenant le VRAI résultat d'une recharge
-- ou d'un retrait (confirmé par le webhook de l'opérateur) au lieu
-- d'un « initiée / envoyé avec succès » prématuré.
--   * motif_echec : motif de refus, si l'opérateur en transmet un.
--   * type de notification 'wallet' : prévient l'utilisateur du
--     résultat même s'il a fermé l'écran.
-- Sans ce script, le suivi fonctionne quand même (sans motif ni
-- notification) : rien ne se casse.
-- ============================================================

alter table public.transactions_wallet add column if not exists motif_echec text;

alter type notif_type add value if not exists 'wallet';
