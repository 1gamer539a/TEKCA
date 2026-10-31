-- ============================================================
-- UNICITÉ DU NOM DE BOUTIQUE + NOM RÉSERVÉ "TEKÇA"
-- ------------------------------------------------------------
-- Double protection derrière la vérification déjà faite côté
-- formulaire (DevenirVendeur.jsx) : si ce formulaire est un jour
-- contourné (appel direct à l'API Supabase, autre client...), la
-- base elle-même refuse la ligne.
-- ============================================================

-- Un seul nom de boutique par plateforme, insensible à la casse
-- (index sur nom_boutique en minuscules plutôt qu'une contrainte
-- unique classique, qui serait sensible à la casse).
create unique index if not exists idx_vendeurs_nom_boutique_unique
  on vendeurs (lower(trim(nom_boutique)));

-- Liste des variantes les plus évidentes de "TEKÇA" (le nom de la
-- plateforme elle-même) — pas une solution anti-contournement
-- parfaite (l'accent-insensibilité fiable se fait côté JS dans
-- DevenirVendeur.jsx via slugifier), juste un filet de sécurité.
alter table vendeurs add constraint nom_boutique_non_reserve
  check (lower(trim(nom_boutique)) not in ('tekça', 'tekca', 'tek ça', 'tek ca', 'tek-ça', 'tek-ca'));
