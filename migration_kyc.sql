-- ============================================================
-- MIGRATION — à exécuter dans Supabase SQL Editor
-- (fait suite aux migrations précédentes)
-- ============================================================
-- Les demandes de vérification d'identité (KYC) utilisaient le motif
-- générique 'autre', les mélangeant avec les vraies réclamations dans
-- l'onglet Signalements de l'admin — impossible de les traiter à
-- part. Nouveau motif dédié pour un onglet KYC séparé.

alter type motif_contact add value if not exists 'verification_identite';
