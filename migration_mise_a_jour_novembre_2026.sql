-- ============================================================
-- TEKÇA — migration du 10/11/2026
-- À exécuter UNE FOIS dans Supabase (SQL Editor). Sans danger si
-- relancée : tout est idempotent (create or replace / if not exists).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Nouvelles limites de produits par palier
--    Gratuit 20 · Basic 100 · Pro 500 · Premium illimité
--    (remplace la version 10 / 50 / 200 du trigger)
-- ------------------------------------------------------------
create or replace function public.limiter_produits_par_palier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_palier palier_abonnement;
  v_limite int;
  v_nb_produits int;
begin
  select user_id into v_user_id from vendeurs where id = new.vendeur_id;

  select palier into v_palier
  from abonnements_utilisateur
  where user_id = v_user_id and statut = 'actif' and date_fin >= now()
  order by date_fin desc
  limit 1;

  v_limite := case v_palier
    when 'premium' then null -- illimité
    when 'pro' then 500
    when 'basic' then 100
    else 20 -- gratuit (pas d'abonnement actif)
  end;

  if v_limite is not null then
    select count(*) into v_nb_produits
    from produits
    where vendeur_id = new.vendeur_id and statut_validation != 'refuse';

    if v_nb_produits >= v_limite then
      raise exception 'Limite de % produits atteinte pour ton palier actuel. Supprime une annonce existante ou passe à un palier supérieur.', v_limite;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_limiter_produits_par_palier on produits;
create trigger trg_limiter_produits_par_palier
before insert on produits
for each row execute function public.limiter_produits_par_palier();

-- ------------------------------------------------------------
-- 2) Informations personnelles : colonnes pays / adresse / photo
--    Cause la plus probable de « Erreur lors de l'enregistrement »
--    quand un utilisateur modifie son profil : ces colonnes
--    n'existaient pas encore dans la base.
-- ------------------------------------------------------------
alter table users add column if not exists pays_residence text;
alter table users add column if not exists adresse_livraison text;
alter table users add column if not exists avatar_url text;

-- ------------------------------------------------------------
-- 3) Journal des suppressions de produits par l'admin
--    Qui a supprimé, quand, quel produit / quelle boutique, pourquoi.
--    Les lignes ne dépendent d'aucune clé étrangère vers `produits`
--    (elles doivent survivre à la suppression du produit). Seul le
--    serveur (service_role) écrit ; les admins peuvent lire.
-- ------------------------------------------------------------
create table if not exists journal_suppressions_produits (
  id uuid primary key default gen_random_uuid(),
  produit_id uuid not null,
  produit_nom text not null,
  vendeur_id uuid,
  vendeur_user_id uuid,
  nom_boutique text,
  supprime_par uuid references users(id) on delete set null,
  supprime_par_nom text,
  motif text not null check (char_length(btrim(motif)) >= 5),
  resultat text not null default 'supprime' check (resultat in ('supprime', 'retire')),
  date_suppression timestamptz not null default now()
);

create index if not exists idx_journal_suppressions_date on journal_suppressions_produits(date_suppression desc);

alter table journal_suppressions_produits enable row level security;

drop policy if exists "journal_suppressions_lecture_admin" on journal_suppressions_produits;
create policy "journal_suppressions_lecture_admin"
on journal_suppressions_produits for select
to authenticated
using (is_admin());
