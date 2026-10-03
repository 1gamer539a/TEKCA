-- ============================================================
-- PIN — nouveau type d'événement pour tracer les tentatives ratées
-- ------------------------------------------------------------
-- Réutilise journal_securite (déjà utilisé pour connexion_echouee)
-- pour limiter les tentatives de code PIN de la même façon que pour
-- la connexion : 5 échecs / 15 minutes bloquent temporairement.
-- ============================================================
alter type type_evenement_securite add value if not exists 'pin_echoue';
