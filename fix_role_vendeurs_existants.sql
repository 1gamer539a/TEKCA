-- ============================================================
-- CORRECTIF PONCTUEL — à exécuter une fois dans Supabase SQL Editor
-- ============================================================
-- Les comptes vendeurs créés AVANT le correctif qui met users.role à
-- "vendeur" sont restés bloqués sur role="client" — "Mon compte" ne
-- pouvait donc jamais leur proposer le tableau de bord. Ceci
-- resynchronise une bonne fois les comptes déjà existants ; les
-- nouveaux vendeurs n'en ont plus besoin, le code le fait maintenant
-- tout seul à l'inscription.

-- Le champ "role" est protégé par un trigger (même mécanisme que pour
-- promouvoir un compte admin) — à désactiver le temps de cette seule
-- correction, sans quoi la requête sera rejetée.
alter table users disable trigger trg_proteger_champs_sensibles_users;

update users
set role = 'vendeur'
where id in (select user_id from vendeurs where statut in ('valide', 'en_attente'))
and role = 'client';

alter table users enable trigger trg_proteger_champs_sensibles_users;
