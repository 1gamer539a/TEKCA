-- À exécuter une fois dans Supabase (SQL Editor).
-- Réglages personnels de chaque utilisateur : verrouillage du PIN,
-- PIN par action, notifications. Sans cette table, l'application
-- fonctionne avec les valeurs par défaut (PIN redemandé après 5 min
-- d'inactivité, PIN pour chaque action, toutes les notifications actives)
-- mais les réglages ne peuvent pas être enregistrés.
create table if not exists parametres_utilisateur (
  user_id uuid primary key references users(id) on delete cascade,
  -- 0 = à chaque ouverture de l'application ; sinon minutes d'inactivité
  pin_delai_minutes int not null default 5 check (pin_delai_minutes in (0, 1, 5, 15, 30, 60)),
  pin_pour_actions boolean not null default true,
  notif_commandes boolean not null default true,
  notif_messages boolean not null default true,
  notif_promotions boolean not null default true,
  date_maj timestamptz not null default now()
);

alter table parametres_utilisateur enable row level security;
-- Aucune policy volontairement : seules nos routes API (service_role) y accèdent.
