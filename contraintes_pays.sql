-- ============================================================
-- LIMITE PAYS = COUVERTURE SEBPAY
-- À exécuter après schema.sql
-- ============================================================
-- L'inscription vendeur (components/DevenirVendeur.jsx) insère
-- directement depuis le client (pas de route serveur intermédiaire).
-- Le menu déroulant limite les choix côté UI, mais rien n'empêchait
-- techniquement l'insertion d'un pays hors liste en contournant le
-- formulaire. Cette contrainte le bloque au niveau base, quelle que
-- soit la voie d'insertion.
--
-- Liste basée sur les captures d'écran réelles du sélecteur de pays
-- Sebpay (28/08/2026) — Togo confirmé, Tchad exclu (absent du
-- sélecteur malgré sa présence sur le site marketing). À revérifier
-- si Sebpay étend sa couverture. Miroir de lib/pays.js.
-- ============================================================

alter table vendeurs
  add constraint vendeurs_pays_couvert_sebpay
  check (pays in ('CG','CM','GA','CD','CI','SN','BJ','TG','BF','ML','NE','GN','GW','GM','GH','KE','NG','UG','TZ'));

alter table produits
  add constraint produits_pays_couvert_sebpay
  check (pays in ('CG','CM','GA','CD','CI','SN','BJ','TG','BF','ML','NE','GN','GW','GM','GH','KE','NG','UG','TZ'));
