-- ============================================================
-- RÔLES D'ÉQUIPE — à exécuter UNE FOIS dans Supabase SQL Editor
-- ------------------------------------------------------------
-- Avant : tout membre 'equipe' voyait TOUT (finances, identités,
-- utilisateurs…), car les règles RLS utilisaient is_admin() = admin
-- OU equipe. Maintenant :
--   * admin  (users.role = 'admin')  = ADMIN PRINCIPAL : voit tout.
--   * equipe (users.role = 'equipe') = ne voit QUE les domaines qui
--     lui sont attribués dans equipe_permissions. Aucun domaine =
--     aucun accès.
-- Les domaines : support, kyc, catalogue, finance, marketing,
-- technique, utilisateurs, data (voir lib/permissions.js).
-- Le domaine 'data' ne donne accès à AUCUNE table : il n'ouvre que la
-- fonction stats_data() (chiffres agrégés, sans donnée personnelle).
--
-- Le contrôle est fait ICI, au niveau de la base (RLS) : cacher un
-- onglet dans l'interface ne suffirait pas, car l'interface lit les
-- tables directement depuis le navigateur.
--
-- ATTENTION : les membres 'equipe' existants perdent leur accès
-- jusqu'à ce que l'admin principal leur attribue un rôle (onglet
-- "Équipe" de la Salle de surveillance). C'est voulu (refus par
-- défaut). Pour conserver temporairement l'ancien accès total, voir
-- le bloc optionnel tout en bas.
-- ============================================================

-- 1) Journal : deux nouveaux types d'événements
alter type type_evenement_securite add value if not exists 'equipe_attribution';
alter type type_evenement_securite add value if not exists 'equipe_revocation';

-- 2) Table des permissions (écrite UNIQUEMENT par le serveur)
create table if not exists public.equipe_permissions (
  user_id uuid primary key references public.users(id) on delete cascade,
  poste text,
  permissions text[] not null default '{}',
  attribue_par uuid references public.users(id) on delete set null,
  date_creation timestamptz not null default now(),
  date_maj timestamptz not null default now(),
  constraint equipe_permissions_valeurs
    check (permissions <@ array['support','kyc','catalogue','finance','marketing','technique','utilisateurs','data']::text[])
);

-- Si la table existait déjà (migration relancée), on met la contrainte à jour.
alter table public.equipe_permissions drop constraint if exists equipe_permissions_valeurs;
alter table public.equipe_permissions add constraint equipe_permissions_valeurs
  check (permissions <@ array['support','kyc','catalogue','finance','marketing','technique','utilisateurs','data']::text[]);

alter table public.equipe_permissions enable row level security;
revoke all on public.equipe_permissions from anon, authenticated;
grant select on public.equipe_permissions to authenticated;

-- 3) Fonctions utilitaires (SECURITY DEFINER : pas de récursion RLS)
create or replace function public.est_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'admin');
$$;

create or replace function public.a_une_permission(ps text[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
    or exists (
      select 1
      from public.users u
      join public.equipe_permissions e on e.user_id = u.id
      where u.id = auth.uid() and u.role = 'equipe' and e.permissions && ps
    );
$$;

create or replace function public.a_permission(p text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.a_une_permission(array[p]);
$$;


-- 4 bis) Statistiques pour le rôle DATA : uniquement des chiffres agrégés
--    (aucun nom, email, téléphone ni solde individuel). Le rôle data n'a
--    accès à aucune table : il passe par cette fonction, qui vérifie la
--    permission elle-même.
create or replace function public.stats_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_totaux jsonb;
  v_mensuel jsonb;
  v_pays jsonb := '[]'::jsonb;
  v_statut jsonb;
  v_categorie jsonb := '[]'::jsonb;
begin
  if not public.a_permission('data') then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'utilisateurs',      (select count(*) from public.users),
    'vendeurs_valides',  (select count(*) from public.vendeurs where statut = 'valide'),
    'commandes',         (select count(*) from public.commandes),
    'commandes_livrees', (select count(*) from public.commandes where statut = 'livre'),
    'ca_livre',          (select coalesce(sum(montant_total), 0) from public.commandes where statut = 'livre'),
    'commissions',       (select coalesce(sum(commission_appliquee), 0) from public.commandes where statut = 'livre'),
    'fonds_sequestres',  (select coalesce(sum(coalesce(montant_produit, 0) + coalesce(frais_protection_acheteur, 0)), 0) from public.sequestres where statut = 'retenu'),
    'fonds_wallets',     (select coalesce(sum(solde), 0) from public.wallets)
  ) into v_totaux;

  select coalesce(jsonb_agg(jsonb_build_object(
           'mois', to_char(m.mois, 'YYYY-MM'),
           'commandes', coalesce(c.nb, 0),
           'ca', coalesce(c.ca, 0),
           'commissions', coalesce(c.com, 0),
           'inscriptions', coalesce(u.nb, 0)
         ) order by m.mois), '[]'::jsonb)
  into v_mensuel
  from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') as m(mois)
  left join (
    select date_trunc('month', date_creation) as mois,
           count(*) as nb,
           sum(montant_total) filter (where statut = 'livre') as ca,
           sum(commission_appliquee) filter (where statut = 'livre') as com
    from public.commandes group by 1
  ) c on c.mois = m.mois
  left join (
    select date_trunc('month', date_creation) as mois, count(*) as nb
    from public.users group by 1
  ) u on u.mois = m.mois;

  select coalesce(jsonb_agg(jsonb_build_object('statut', t.statut, 'commandes', t.nb) order by t.nb desc), '[]'::jsonb)
  into v_statut
  from (select statut::text as statut, count(*) as nb from public.commandes group by 1) t;

  -- Les deux répartitions ci-dessous sont "bonus" : si une colonne manque, elles restent
  -- vides au lieu de faire échouer toute la page d'analyses.
  begin
    select coalesce(jsonb_agg(jsonb_build_object('pays', t.pays, 'utilisateurs', t.nb) order by t.nb desc), '[]'::jsonb)
    into v_pays
    from (select coalesce(pays_residence, '?') as pays, count(*) as nb from public.users group by 1 order by 2 desc limit 10) t;
  exception when others then
    v_pays := '[]'::jsonb;
  end;

  begin
    select coalesce(jsonb_agg(jsonb_build_object('categorie', t.nom, 'commandes', t.nb) order by t.nb desc), '[]'::jsonb)
    into v_categorie
    from (
      select ct.nom_categorie as nom, count(*) as nb
      from public.commandes c
      join public.produits p on p.id = c.produit_id
      join public.categories_taxes ct on ct.id = p.categorie_id
      group by 1 order by 2 desc limit 8
    ) t;
  exception when others then
    v_categorie := '[]'::jsonb;
  end;

  return jsonb_build_object(
    'genere_le', now(),
    'totaux', v_totaux,
    'mensuel', v_mensuel,
    'par_pays', v_pays,
    'par_statut', v_statut,
    'par_categorie', v_categorie
  );
end;
$$;

revoke all on function public.stats_data() from public, anon;
grant execute on function public.stats_data() to authenticated;

drop policy if exists "equipe_permissions_lecture" on public.equipe_permissions;
create policy "equipe_permissions_lecture"
on public.equipe_permissions for select
to authenticated
using (user_id = auth.uid() or public.est_super_admin());

-- 4) is_admin() devient STRICT (admin principal uniquement) : toute
--    règle oubliée ci-dessous se ferme au lieu de rester ouverte.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.est_super_admin();
$$;

-- 5) Réécriture des règles RLS qui utilisaient is_admin() : chaque
--    table est rattachée aux domaines qui ont besoin d'y accéder.
--    (Relançable sans risque : après le premier passage, plus aucune
--    règle ne contient is_admin().)
do $$
declare
  r record;
  carte jsonb := '{
    "contacts_support":        ["support","kyc"],
    "messages_support":        ["support","kyc"],
    "messages_chat":           ["support"],
    "conversations":           ["support"],
    "user_feedbacks":          ["support"],
    "faq":                     ["support"],
    "agents_livraison":        ["support"],
    "vendeurs":                ["kyc","support","catalogue","finance"],
    "produits":                ["catalogue","support","finance"],
    "produits_digitaux":       ["catalogue","support"],
    "variantes_produits":      ["catalogue"],
    "projets_reference":       ["catalogue"],
    "commandes":               ["finance","support"],
    "wallets":                 ["finance"],
    "transactions_wallet":     ["finance"],
    "wallets_recharge":        ["finance"],
    "depots_wallet":           ["finance"],
    "demandes_retrait":        ["finance"],
    "sequestres":              ["finance"],
    "abonnements_utilisateur": ["finance"],
    "ia_abonnements":          ["finance"],
    "grille_tarifs_abonnement":["finance"],
    "categories_taxes":        ["finance"],
    "boosts":                  ["finance","marketing"],
    "boosts_compte":           ["finance","marketing"],
    "comptes_promus":          ["finance","marketing"],
    "ventes_flash":            ["marketing"],
    "bannieres_accueil":       ["marketing"],
    "codes_promo":             ["marketing"],
    "campagnes_notification":  ["marketing"],
    "tournois":                ["marketing"],
    "inscriptions_tournoi":    ["marketing"],
    "resultats_tournoi":       ["marketing"],
    "modules_formation":       ["marketing"],
    "user_attributions":       ["marketing"],
    "journal_securite":        ["technique"],
    "logs_ia":                 ["technique"],
    "ia_generations":          ["technique"],
    "users":                   ["support","kyc","finance","utilisateurs"]
  }'::jsonb;
  -- Écriture : plus restreinte que la lecture pour les tables partagées entre
  -- plusieurs rôles (ex. le support peut LIRE un vendeur, pas le modifier).
  ecriture jsonb := '{
    "vendeurs":          ["kyc"],
    "produits":          ["catalogue"],
    "produits_digitaux": ["catalogue"],
    "comptes_promus":    ["marketing"]
  }'::jsonb;
  perms text[];
  expr text;
  q text;
  wc text;
begin
  for r in
    select * from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~ 'is_admin\(\)' or coalesce(with_check, '') ~ 'is_admin\(\)')
  loop
    if (carte -> r.tablename) is not null and not (r.tablename = 'users' and r.cmd <> 'SELECT') then
      if r.cmd <> 'SELECT' and (ecriture -> r.tablename) is not null then
        select array_agg(x) into perms from jsonb_array_elements_text(ecriture -> r.tablename) as x;
      else
        select array_agg(x) into perms from jsonb_array_elements_text(carte -> r.tablename) as x;
      end if;
      expr := format('public.a_une_permission(%L::text[])', perms);
    else
      -- table non listée, ou écriture sur users : admin principal seulement
      expr := 'public.est_super_admin()';
    end if;

    q  := case when r.qual       is null then null else regexp_replace(r.qual,       '(public\.)?is_admin\(\)', expr, 'g') end;
    wc := case when r.with_check is null then null else regexp_replace(r.with_check, '(public\.)?is_admin\(\)', expr, 'g') end;

    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    execute format(
      'create policy %I on %I.%I as %s for %s to %s%s%s',
      r.policyname, r.schemaname, r.tablename,
      lower(r.permissive), r.cmd,
      array_to_string(r.roles, ', '),
      case when q  is not null then ' using (' || q  || ')' else '' end,
      case when wc is not null then ' with check (' || wc || ')' else '' end
    );
  end loop;
end $$;

-- 6) Fil de support : ces deux règles testaient le rôle directement
--    (sans is_admin()), donc elles n'étaient pas couvertes ci-dessus.
drop policy if exists "messages_support_lecture" on messages_support;
create policy "messages_support_lecture"
on messages_support for select
using (
  exists (
    select 1 from contacts_support cs
    where cs.id = messages_support.contact_id
    and (cs.client_id = auth.uid() or public.a_une_permission(array['support','kyc']))
  )
);

drop policy if exists "messages_support_ecriture" on messages_support;
create policy "messages_support_ecriture"
on messages_support for insert
with check (
  auth.uid() = expediteur_id
  and exists (
    select 1 from contacts_support cs
    where cs.id = messages_support.contact_id
    and (cs.client_id = auth.uid() or public.a_une_permission(array['support','kyc']))
  )
);

-- ------------------------------------------------------------
-- VÉRIFICATION (à lancer après) : doit renvoyer 0 ligne.
--   select tablename, policyname from pg_policies
--   where schemaname='public' and (qual ~ 'is_admin' or with_check ~ 'is_admin');
--
-- OPTIONNEL — garder l'ancien accès total pour les 'equipe'
-- existants le temps d'attribuer les vrais rôles (à retirer ensuite
-- depuis l'onglet Équipe) :
--   insert into equipe_permissions (user_id, poste, permissions)
--   select id, 'personnalise',
--          array['support','kyc','catalogue','finance','marketing','technique','utilisateurs']
--   from users where role = 'equipe'
--   on conflict (user_id) do nothing;
-- ------------------------------------------------------------
