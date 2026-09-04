-- ============================================================
-- REFONTE DES ABONNEMENTS TEKÇA (4 paliers) + CASHBACK + LIMITE DE
-- PRODUITS + FRAIS DE TRANSFERT + VENTES FLASH
-- À exécuter après tous les scripts précédents
-- ============================================================

-- ------------------------------------------------------------
-- Renommage des paliers — même mécanisme, nouveaux noms/prix/taux.
-- ALTER TYPE ... RENAME VALUE relabelle aussi les lignes existantes,
-- pas besoin de migrer les données une par une.
-- 'standard' -> 'basic', 'classique' -> 'pro', 'premium' inchangé.
-- ------------------------------------------------------------
alter type palier_abonnement rename value 'standard' to 'basic';
alter type palier_abonnement rename value 'classique' to 'pro';

-- ------------------------------------------------------------
-- Nouvelle grille tarifaire — mêmes réductions de durée qu'avant
-- (3 mois -10%, 6 mois -20%, 12 mois = 10 mois payés), appliquées
-- aux nouveaux prix de base : Basic 2 500 / Pro 6 000 / Premium 15 000
-- ------------------------------------------------------------
delete from grille_tarifs_abonnement;
insert into grille_tarifs_abonnement (palier, duree_mois, prix_fcfa) values
  ('basic', 1, 2500), ('basic', 3, 6750), ('basic', 6, 12000), ('basic', 12, 25000),
  ('pro', 1, 6000), ('pro', 3, 16200), ('pro', 6, 28800), ('pro', 12, 60000),
  ('premium', 1, 15000), ('premium', 3, 40500), ('premium', 6, 72000), ('premium', 12, 150000);

-- ------------------------------------------------------------
-- Nouvelle valeur d'enum pour tracer le cashback dans le wallet,
-- comme les autres types de transaction
-- ------------------------------------------------------------
alter type type_transaction_wallet add value if not exists 'cashback';

-- ------------------------------------------------------------
-- Cashback acheteur — uniquement Premium (5%), crédité sur le
-- wallet, prélevé sur la commission TEKÇA (jamais sur ce que
-- touche le vendeur). Tracé sur la commande pour l'historique.
-- ------------------------------------------------------------
alter table commandes add column if not exists cashback_credite numeric(10,2) default 0;

-- ------------------------------------------------------------
-- Limite de produits par palier — imposée en base, pas seulement
-- côté formulaire (FormulaireProduit.jsx insère directement depuis
-- le client). Un produit refusé ne compte pas dans le quota (jamais
-- réellement publié) ; un produit supprimé libère sa place.
-- ------------------------------------------------------------
create or replace function public.limiter_produits_par_palier()
returns trigger
language plpgsql
security definer
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
    when 'pro' then 200
    when 'basic' then 50
    else 10 -- gratuit (pas d'abonnement actif)
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
-- Frais de transfert P2P — dégressifs selon le palier de
-- l'EXPÉDITEUR (Premium 1%, Pro 3%, Basic 5%, Gratuit 7%). Marge
-- TEKÇA pure, jamais déduite du montant reçu par le destinataire.
-- ------------------------------------------------------------
alter table transactions_wallet add column if not exists frais numeric(10,2) default 0;

-- ------------------------------------------------------------
-- Ventes flash — visibles par tous à partir de date_debut_public,
-- mais visibles 12h plus tôt par les abonnés Premium uniquement
-- (date_debut_public - 12h). La logique de visibilité vit dans
-- app/api/ventes-flash/actives (jamais uniquement côté client).
-- ------------------------------------------------------------
create table if not exists ventes_flash (
  id uuid primary key default gen_random_uuid(),
  produit_id uuid not null references produits(id) on delete cascade,
  vendeur_id uuid not null references vendeurs(id) on delete cascade,
  prix_flash numeric(10,2) not null,
  date_debut_public timestamptz not null,
  date_fin timestamptz not null,
  date_creation timestamptz not null default now(),
  check (date_fin > date_debut_public)
);

alter table ventes_flash enable row level security;

-- Lecture publique de la ligne elle-même (prix, dates) — la
-- visibilité "achetable maintenant ou pas encore" est calculée côté
-- serveur dans la route, pas filtrée par RLS (une policy RLS ne
-- peut pas facilement dépendre à la fois de now() ET du palier de
-- l'utilisateur courant de façon lisible/maintenable ici).
create policy "ventes_flash_select_public" on ventes_flash for select to public using (true);

create policy "ventes_flash_gestion_own_ou_admin"
on ventes_flash for all
to authenticated
using (est_proprietaire_vendeur(vendeur_id) or is_admin())
with check (est_proprietaire_vendeur(vendeur_id) or is_admin());

create index if not exists idx_ventes_flash_dates on ventes_flash(date_debut_public, date_fin);
