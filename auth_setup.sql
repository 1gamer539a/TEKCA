-- ============================================================
-- AUTHENTIFICATION — trigger de création de profil + support du
-- rate limiting de connexion
-- À exécuter APRÈS schema.sql et rls_policies.sql
-- ============================================================

-- ------------------------------------------------------------
-- Création automatique de la ligne public.users à l'inscription
-- Supabase Auth (table interne auth.users) est la SEULE source de
-- vérité pour l'email et le mot de passe : le mot de passe est
-- haché par Supabase Auth (bcrypt) et n'est jamais lu ni stocké par
-- notre code. La colonne users.mot_de_passe_hash du schéma original
-- est donc laissée inutilisée/legacy — ne jamais y écrire de mot de
-- passe en clair ni la réutiliser pour une vérification maison.
--
-- Ce trigger tourne en SECURITY DEFINER, donc il n'a pas besoin
-- d'une session déjà active : il s'exécute même si la confirmation
-- email est requise avant la première connexion.
-- ------------------------------------------------------------
create or replace function public.gerer_nouvel_utilisateur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, nom, email, telephone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nom', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'telephone',
    'client'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.gerer_nouvel_utilisateur();

-- ------------------------------------------------------------
-- Index pour que la vérification de rate limiting (comptage des
-- tentatives de connexion échouées récentes) reste rapide même
-- quand journal_securite grossit.
-- ------------------------------------------------------------
create index if not exists idx_journal_securite_type_date
on journal_securite(type, date_creation);

-- ------------------------------------------------------------
-- Note sur la durée de session (TTL) :
-- Supabase Auth émet des access tokens JWT de courte durée (1h par
-- défaut) avec rotation automatique du refresh token. Cette durée se
-- configure dans le Dashboard Supabase → Authentication → Settings →
-- "Access token expiry" / "Refresh token rotation" — ce n'est pas un
-- réglage applicatif. Réduis-la si besoin (ex: 30 min) pour un
-- wallet financier comme celui-ci. La déconnexion explicite
-- (supabase.auth.signOut(), câblée dans ProfilParametres.jsx) révoque
-- le refresh token côté serveur Supabase, donc une session déconnectée
-- ne peut pas être rejouée.
-- ------------------------------------------------------------
