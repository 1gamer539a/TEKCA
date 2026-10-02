-- ============================================================
-- ATTRIBUTION UTILISATEUR + FEEDBACK
-- ------------------------------------------------------------
-- Deux fonctionnalités indépendantes, réunies dans une seule
-- migration car livrées ensemble :
--   1. user_attributions — enquête "comment as-tu connu TEKÇA ?"
--      affichée tant que l'utilisateur n'a pas répondu.
--   2. user_feedbacks — formulaire libre de retours (suggestion,
--      amélioration, bug), avec suivi de statut côté admin.
--
-- À exécuter après schema.sql, rls_policies.sql et auth_setup.sql
-- (réutilise la fonction is_admin() définie dans rls_policies.sql).
-- ============================================================

-- ------------------------------------------------------------
-- 1. ATTRIBUTION UTILISATEUR
-- ------------------------------------------------------------
create type canal_attribution as enum (
  'bouche_a_oreille', 'reseaux_sociaux', 'recherche_google', 'evenement', 'autre'
);

create table if not exists user_attributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  channel canal_attribution not null,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_attributions_user on user_attributions(user_id);

alter table user_attributions enable row level security;

create policy "user_attributions_select_own_ou_admin"
on user_attributions for select
to authenticated
using (user_id = auth.uid() or is_admin());

create policy "user_attributions_insert_own"
on user_attributions for insert
to authenticated
with check (user_id = auth.uid());

-- Volontairement AUCUNE policy update/delete : une réponse d'enquête
-- est définitive (ni le client ni l'admin ne peuvent la modifier) —
-- évite toute falsification a posteriori des statistiques d'acquisition.

-- ------------------------------------------------------------
-- 2. FEEDBACK UTILISATEUR
-- ------------------------------------------------------------
create type type_feedback as enum ('suggestion', 'amelioration', 'bug', 'autre');
create type priorite_feedback as enum ('faible', 'moyen', 'eleve');
create type statut_feedback as enum ('nouveau', 'en_cours', 'resolu', 'archive');

create table if not exists user_feedbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type type_feedback not null,
  priority priorite_feedback not null default 'moyen',
  message text not null,
  status statut_feedback not null default 'nouveau',
  created_at timestamptz not null default now()
);

create index if not exists idx_user_feedbacks_status on user_feedbacks(status);
create index if not exists idx_user_feedbacks_user on user_feedbacks(user_id);

alter table user_feedbacks enable row level security;

create policy "user_feedbacks_select_own_ou_admin"
on user_feedbacks for select
to authenticated
using (user_id = auth.uid() or is_admin());

create policy "user_feedbacks_insert_own"
on user_feedbacks for insert
to authenticated
with check (user_id = auth.uid());

-- Seul l'admin change le statut (nouveau -> en_cours -> resolu / archive) ;
-- le message et le type restent en lecture seule après envoi pour tout
-- le monde (même règle de non-modification que contacts_support).
create policy "user_feedbacks_update_admin"
on user_feedbacks for update
to authenticated
using (is_admin())
with check (is_admin());
