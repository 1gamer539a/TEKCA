-- À exécuter une fois dans Supabase (SQL Editor).
-- Taux de change pour les recharges et retraits des pays hors FCFA.
-- Le prix reste TOUJOURS en FCFA dans l'application ; ce taux sert uniquement
-- à calculer le montant envoyé au prestataire de paiement dans la devise du pays.
--
-- unites_pour_1000_fcfa = combien d'unités de la devise locale valent 1 000 FCFA.
-- Exemple fictif : si 1 000 FCFA = 18,5 GHS, saisir 18.5 pour la devise GHS.
-- Tant qu'un taux n'est pas saisi, les opérations du pays concerné sont refusées
-- avec un message clair (jamais de conversion inventée).
create table if not exists taux_change (
  devise text primary key check (devise ~ '^[A-Z]{3}$'),
  unites_pour_1000_fcfa numeric(18,4) not null check (unites_pour_1000_fcfa > 0),
  date_maj timestamptz not null default now(),
  maj_par uuid references users(id) on delete set null
);

alter table taux_change enable row level security;
-- Aucune policy volontairement : seules les routes API (service_role) y accèdent.

-- Taux de départ, calculés à partir de tes exemples « 500 FCFA = … » (x 2 pour 1 000 FCFA).
-- Relancer ce script remplace les taux par ces valeurs : pour les mises à jour
-- suivantes, utilise l'onglet « Taux de change » de la Salle de surveillance.
insert into taux_change (devise, unites_pour_1000_fcfa) values
  ('GMD',  131.76),
  ('GHS',   20.16),
  ('GNF', 14285.72),
  ('KES',  250.00),
  ('NGN', 2631.58),
  ('UGX', 8333.34),
  ('CDF', 4347.82),
  ('TZS', 5000.00)
on conflict (devise) do update
  set unites_pour_1000_fcfa = excluded.unites_pour_1000_fcfa, date_maj = now();
