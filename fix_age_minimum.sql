-- ============================================================
-- DATE DE NAISSANCE OBLIGATOIRE (âge minimum 14 ans)
-- ------------------------------------------------------------
-- Capturée dans le même écran que la création du pseudo (étape
-- obligatoire pour TOUT nouveau compte, email comme Google/Facebook/
-- Apple — voir CreationPseudo.jsx et /api/identite/creer-pseudo).
-- Colonne nullable au niveau base (pour ne pas casser d'éventuels
-- comptes de test déjà créés sans cette info) ; le middleware bloque
-- déjà l'accès au reste du site tant que pseudo + date_naissance ne
-- sont pas renseignés, donc en pratique tout NOUVEAU compte en aura
-- toujours une.
-- ============================================================
alter table users add column if not exists date_naissance date;

alter table users add constraint users_age_minimum
  check (date_naissance is null or date_naissance <= (current_date - interval '14 years'));
