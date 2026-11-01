-- ============================================================
-- IDENTITÉ NUMÉRIQUE TEKÇA (ID + pseudo) + RENOUVELLEMENT AUTO
-- À exécuter après tous les scripts précédents
-- ============================================================

-- ------------------------------------------------------------
-- Identité numérique — remplace le numéro de téléphone pour tous
-- les transferts internes. Le numéro de téléphone (users.telephone)
-- redevient strictement privé : il ne sert plus qu'à recharger et
-- retirer via Sebpay, plus jamais à identifier quelqu'un pour lui
-- envoyer de l'argent.
-- ------------------------------------------------------------
alter table users add column if not exists pseudo text unique;
alter table users add column if not exists identifiant_tekca text unique;

create index if not exists idx_users_identifiant_tekca on users(identifiant_tekca);

-- ------------------------------------------------------------
-- Définitif : ni l'utilisateur, ni l'équipe support, ni un futur
-- appel service_role ne peut modifier un pseudo ou un identifiant
-- une fois posé. Volontairement SANS exception pour service_role —
-- contrairement aux autres triggers de protection de ce projet, la
-- consigne ici est "même pas nous". Seule la création initiale
-- (null -> valeur) reste autorisée, faite une fois par
-- /api/identite/creer-pseudo.
-- ------------------------------------------------------------
create or replace function public.proteger_identite_tekca()
returns trigger
language plpgsql
as $$
begin
  if old.pseudo is not null and new.pseudo is distinct from old.pseudo then
    raise exception 'Le pseudo TEKÇA est définitif — il ne peut jamais être modifié, même par le support.';
  end if;
  if old.identifiant_tekca is not null and new.identifiant_tekca is distinct from old.identifiant_tekca then
    raise exception 'L''identifiant TEKÇA est définitif — il ne peut jamais être modifié, même par le support.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_identite_tekca on users;
create trigger trg_proteger_identite_tekca
before update on users
for each row execute function public.proteger_identite_tekca();

-- ------------------------------------------------------------
-- Renouvellement automatique des abonnements
-- ------------------------------------------------------------
-- true par défaut : si l'utilisateur ne résilie pas explicitement,
-- l'abonnement se renouvelle tout seul à l'échéance SI le wallet a
-- le solde suffisant. Sinon, l'abonnement expire simplement, sans
-- nouvelle tentative les jours suivants. La résiliation
-- (renouvellement_auto = false) n'arrête que le PROCHAIN
-- renouvellement — la période déjà payée va jusqu'à date_fin.
alter table abonnements_utilisateur add column if not exists renouvellement_auto boolean not null default true;
