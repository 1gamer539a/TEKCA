-- À exécuter dans le SQL Editor de Supabase, AVANT de déployer.
-- État du mode maintenance (une seule ligne). Lecture publique (c'est juste
-- « en maintenance oui/non » + un message) ; écriture réservée au serveur.
create table if not exists etat_systeme (
  id int primary key default 1 check (id = 1),
  maintenance boolean not null default false,
  message text,
  active_depuis timestamptz,
  active_par uuid references users(id) on delete set null,
  date_maj timestamptz not null default now()
);
insert into etat_systeme (id) values (1) on conflict (id) do nothing;

alter table etat_systeme enable row level security;
drop policy if exists etat_systeme_lecture_publique on etat_systeme;
create policy etat_systeme_lecture_publique on etat_systeme for select to anon, authenticated using (true);

-- ============================================================
-- PLAN B — si l'espace admin n'est pas accessible :
--   ARRÊTER TEKÇA :  update etat_systeme set maintenance = true,  active_depuis = now(), date_maj = now() where id = 1;
--   REMETTRE EN SERVICE : update etat_systeme set maintenance = false, date_maj = now() where id = 1;
-- (prend effet en quelques secondes, sans redéploiement)
-- ============================================================
