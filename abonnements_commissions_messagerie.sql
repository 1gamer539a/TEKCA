-- ============================================================
-- ABONNEMENTS, COMMISSIONS ACHETEUR+VENDEUR, BLOCAGE DE COMPTE
-- À exécuter après tous les scripts précédents
-- ============================================================

-- ------------------------------------------------------------
-- Grille tarifaire des abonnements (Standard / Classique / Premium)
-- Table de référence en lecture publique — sert à l'affichage des
-- prix ET de source de vérité côté serveur pour éviter qu'un prix
-- soit envoyé par le client.
-- ------------------------------------------------------------
create type palier_abonnement as enum ('standard', 'classique', 'premium');

create table if not exists grille_tarifs_abonnement (
  id uuid primary key default gen_random_uuid(),
  palier palier_abonnement not null,
  duree_mois int not null check (duree_mois in (1, 3, 6, 12)),
  prix_fcfa numeric(10,2) not null,
  unique (palier, duree_mois)
);

insert into grille_tarifs_abonnement (palier, duree_mois, prix_fcfa) values
  ('standard', 1, 2500), ('standard', 3, 6750), ('standard', 6, 12000), ('standard', 12, 25000),
  ('classique', 1, 4500), ('classique', 3, 12150), ('classique', 6, 21600), ('classique', 12, 45000),
  ('premium', 1, 7500), ('premium', 3, 20250), ('premium', 6, 36000), ('premium', 12, 75000)
on conflict (palier, duree_mois) do update set prix_fcfa = excluded.prix_fcfa;

alter table grille_tarifs_abonnement enable row level security;
create policy "grille_tarifs_select_public" on grille_tarifs_abonnement for select to public using (true);
create policy "grille_tarifs_admin_write" on grille_tarifs_abonnement for all to authenticated
  using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------
-- Abonnements souscrits — ouvert à TOUT utilisateur (acheteur ou
-- vendeur, pas besoin d'avoir une boutique). Un utilisateur peut
-- avoir plusieurs lignes dans le temps (historique), mais une seule
-- doit être 'actif' à la fois — imposé par l'index unique partiel
-- ci-dessous plutôt que par une simple convention applicative.
-- ------------------------------------------------------------
create table if not exists abonnements_utilisateur (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  palier palier_abonnement not null,
  duree_mois int not null,
  prix_paye numeric(10,2) not null,
  date_debut timestamptz not null default now(),
  date_fin timestamptz not null,
  statut text not null default 'actif' check (statut in ('actif', 'expire')),
  dernier_rappel_envoye_le date,
  date_creation timestamptz not null default now()
);

create unique index if not exists idx_un_seul_abonnement_actif
  on abonnements_utilisateur (user_id)
  where statut = 'actif';

create index if not exists idx_abonnements_date_fin on abonnements_utilisateur(date_fin) where statut = 'actif';

alter table abonnements_utilisateur enable row level security;

create policy "abonnements_select_own_ou_admin"
on abonnements_utilisateur for select
to authenticated
using (user_id = auth.uid() or is_admin());

-- Pas de policy insert/update pour authenticated : la souscription
-- passe uniquement par /api/abonnements/souscrire (service_role),
-- qui vérifie le solde wallet et le prix réel avant d'écrire.

-- ------------------------------------------------------------
-- Nouvelle valeur d'enum pour tracer le paiement d'un abonnement
-- dans le wallet, comme les autres types de transaction
-- ------------------------------------------------------------
alter type type_transaction_wallet add value if not exists 'paiement_abonnement';

-- ------------------------------------------------------------
-- Barème de commission sans abonnement (mis à jour) — à titre
-- d'information/affichage ; la vraie logique de calcul vit dans
-- lib/commission.js pour ne jamais dépendre d'une valeur en base
-- qui pourrait diverger silencieusement du barème décidé.
-- ------------------------------------------------------------
update categories_taxes set taux_commission = 3 where nom_categorie = 'recharge_jeu';
update categories_taxes set taux_commission = 5 where nom_categorie = 'vetement';
update categories_taxes set taux_commission = 5 where nom_categorie = 'accessoire';
update categories_taxes set taux_commission = 10 where nom_categorie = 'abonnement_service';

-- ------------------------------------------------------------
-- Commission acheteur — nouveau champ, symétrique à
-- commission_appliquee (qui reste la commission VENDEUR)
-- ------------------------------------------------------------
alter table commandes add column if not exists commission_acheteur numeric(10,2) default 0;
alter table sequestres add column if not exists commission_acheteur numeric(10,2) default 0;

-- ------------------------------------------------------------
-- Blocage de compte (récidive de tentative de contact hors
-- plateforme dans la messagerie) — nécessite une intervention du
-- support pour débloquer, pas d'auto-déblocage.
-- ------------------------------------------------------------
alter table users add column if not exists compte_bloque boolean not null default false;
alter table users add column if not exists motif_blocage text;
alter table users add column if not exists date_blocage timestamptz;
alter table users add column if not exists tentatives_contact_externe int not null default 0;

-- ------------------------------------------------------------
-- Messagerie — écriture réservée au serveur désormais
-- (app/api/messages/envoyer), pour pouvoir flouter le contenu AVANT
-- l'insertion. La policy d'insert direct client est retirée.
-- ------------------------------------------------------------
drop policy if exists "messages_insert_participant" on messages_chat;
-- La lecture (messages_select_participant_ou_admin) et le marquage
-- "lu" (messages_update_lu_participant) restent inchangés — seule
-- l'écriture du contenu doit désormais passer par le serveur.
