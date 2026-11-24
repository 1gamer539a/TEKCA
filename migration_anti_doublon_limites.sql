-- ============================================================
-- ANTI DOUBLE-CLIC + LIMITES DE DÉBIT — à exécuter UNE FOIS
-- dans Supabase SQL Editor.
-- ------------------------------------------------------------
-- Utilisé par lib/anti-doublon.js (côté serveur) :
--   * reserver_requete(...) : refuse une requête identique (même
--     utilisateur, même route, même contenu) déjà reçue dans les
--     N dernières secondes → un double clic, un second onglet ou une
--     requête rejouée n'exécutent PAS l'action deux fois.
--   * limiter_requete(...)  : au plus N requêtes par utilisateur (ou par
--     adresse IP pour les routes sans connexion), par route, sur une
--     fenêtre de temps (anti-spam).
-- Les deux ne sont appelables que par le serveur (service_role).
-- Tant que ce script n'est pas exécuté, le code continue de
-- fonctionner (protection simplement inactive).
-- ============================================================

create table if not exists public.requetes_recentes (
  empreinte text primary key,
  user_id uuid,
  route text,
  date_creation timestamptz not null default now()
);
create index if not exists idx_requetes_recentes_date on public.requetes_recentes(date_creation);
alter table public.requetes_recentes enable row level security;
revoke all on public.requetes_recentes from anon, authenticated;

-- `cle` = identifiant de l'utilisateur OU adresse IP (routes sans connexion).
create table if not exists public.limites_requetes (
  id bigserial primary key,
  cle text not null,
  route text not null,
  date_creation timestamptz not null default now()
);
create index if not exists idx_limites_requetes on public.limites_requetes(cle, route, date_creation);
alter table public.limites_requetes enable row level security;
revoke all on public.limites_requetes from anon, authenticated;

create or replace function public.reserver_requete(
  p_empreinte text, p_user uuid, p_route text, p_fenetre_secondes int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  -- Ménage léger : en moyenne 1 appel sur 50 supprime les lignes de plus d'un jour.
  if random() < 0.02 then
    delete from public.requetes_recentes where date_creation < now() - interval '1 day';
  end if;

  -- Atomique : si l'empreinte existe et est encore "fraîche", rien n'est écrit
  -- et la fonction renvoie false (= doublon). Sinon elle est (re)réservée.
  insert into public.requetes_recentes as r (empreinte, user_id, route, date_creation)
  values (p_empreinte, p_user, p_route, now())
  on conflict (empreinte) do update
    set date_creation = now()
    where r.date_creation < now() - make_interval(secs => p_fenetre_secondes)
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

create or replace function public.limiter_requete(
  p_cle text, p_route text, p_max int, p_fenetre_secondes int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nb int;
begin
  if random() < 0.02 then
    delete from public.limites_requetes where date_creation < now() - interval '1 day';
  end if;

  select count(*) into v_nb
  from public.limites_requetes
  where cle = p_cle and route = p_route
    and date_creation > now() - make_interval(secs => p_fenetre_secondes);

  if v_nb >= p_max then
    return false;
  end if;

  insert into public.limites_requetes (cle, route) values (p_cle, p_route);
  return true;
end;
$$;

revoke all on function public.reserver_requete(text, uuid, text, int) from public, anon, authenticated;
revoke all on function public.limiter_requete(text, text, int, int) from public, anon, authenticated;
grant execute on function public.reserver_requete(text, uuid, text, int) to service_role;
grant execute on function public.limiter_requete(text, text, int, int) to service_role;

-- Garde-fou supplémentaire contre le double clic sur les abonnements :
-- un seul abonnement "actif" par utilisateur, garanti par la base.
-- (Si cette commande échoue parce que des doublons existent déjà, passe
--  les anciens en 'expire' puis relance-la.)
create unique index if not exists uniq_abonnement_actif_par_user
  on public.abonnements_utilisateur(user_id)
  where statut = 'actif';
