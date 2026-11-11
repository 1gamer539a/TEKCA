-- ============================================================
-- CORRECTIF — page "Analyses" : « droit manquant ou migration non exécutée »
-- À coller et exécuter UNE FOIS dans Supabase SQL Editor.
-- ------------------------------------------------------------
-- Cause : la fonction stats_data() cherchait la colonne users.pays, qui
-- n'existe pas (la colonne s'appelle pays_residence). Toute la page échouait
-- à cause de cette seule colonne. Corrigé, et les répartitions « bonus »
-- (pays, catégories) ne peuvent plus faire échouer le reste.
-- Ne modifie AUCUNE donnée.
-- ============================================================

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

-- Rafraîchit le cache de l'API pour qu'elle voie la fonction tout de suite.
notify pgrst, 'reload schema';
