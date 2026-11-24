-- ============================================================
-- TEKÇA — migration 3 / 3 — à exécuter APRÈS migration_2_categorie_telephone.sql
-- Sans danger si relancée (idempotente).
-- Contient : catégorie Téléphones (commission), cohérence livraison, marques,
-- réglage de notification, alertes de recherche du Marché.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Catégorie Téléphones : même commission que High-Tech (7 %)
-- ------------------------------------------------------------
insert into categories_taxes (nom_categorie, taux_commission, montant_abonnement) values
  ('telephone', 7, 0)
on conflict (nom_categorie) do nothing;

-- ------------------------------------------------------------
-- 2) Cohérence catégorie / livraison : « telephone » est un produit physique
--    (même règle que migration_coherence_categories.sql, avec telephone en plus)
-- ------------------------------------------------------------
alter table produits drop constraint if exists produits_modes_remise_coherents;
alter table produits add constraint produits_modes_remise_coherents check (
  case
    when type in ('recharge_jeu','abonnement_service','ebook','template')
      then modes_remise <@ array['instantane']::text[]
    when type in ('accessoire','vetement','mode_beaute','jouet_enfant','console_gaming','high_tech','telephone','meuble_deco')
      then modes_remise <@ array['domicile','main_propre']::text[]
    else true
  end
);

-- ------------------------------------------------------------
-- 3) Marque du produit (téléphones, high-tech, consoles, véhicules)
--    marque = clé de la liste connue (ex. 'apple', 'tecno') ou 'autre'
--    marque_autre = nom saisi quand la marque n'est pas dans la liste
-- ------------------------------------------------------------
alter table produits add column if not exists marque text;
alter table produits add column if not exists marque_autre text;

alter table produits drop constraint if exists produits_marque_longueur;
alter table produits add constraint produits_marque_longueur check (
  (marque is null or char_length(marque) <= 40) and (marque_autre is null or char_length(marque_autre) <= 40)
);

create index if not exists idx_produits_type_marque on produits(type, marque);

-- ------------------------------------------------------------
-- 4) Réglage de notification : alertes de recherche (actif par défaut)
-- ------------------------------------------------------------
alter table parametres_utilisateur add column if not exists notif_alertes_recherche boolean not null default true;

-- ------------------------------------------------------------
-- 5) Alertes de recherche du Marché
--    Ce que l'acheteur cherche (texte, catégorie, marque, budget, pays) est gardé 60 jours ;
--    quand un produit correspondant est validé, il est prévenu. Seul le serveur écrit ;
--    chaque utilisateur peut lire et supprimer SES recherches.
-- ------------------------------------------------------------
create table if not exists recherches_marche (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  texte text check (texte is null or char_length(texte) <= 120),
  categorie text,
  marque text,
  prix_min numeric,
  prix_max numeric,
  pays text,
  ville text,
  date_creation timestamptz not null default now(),
  date_maj timestamptz not null default now(),
  date_expiration timestamptz not null default (now() + interval '60 days')
);

create index if not exists idx_recherches_marche_user on recherches_marche(user_id, date_maj desc);
create index if not exists idx_recherches_marche_categorie on recherches_marche(categorie, date_expiration);

alter table recherches_marche enable row level security;

drop policy if exists "recherches_marche_lecture_proprietaire" on recherches_marche;
create policy "recherches_marche_lecture_proprietaire"
on recherches_marche for select to authenticated using (user_id = auth.uid());

drop policy if exists "recherches_marche_suppression_proprietaire" on recherches_marche;
create policy "recherches_marche_suppression_proprietaire"
on recherches_marche for delete to authenticated using (user_id = auth.uid());

-- Une seule alerte envoyée par recherche et par produit ; sert aussi au plafond quotidien.
create table if not exists alertes_recherche_envoyees (
  recherche_id uuid not null references recherches_marche(id) on delete cascade,
  produit_id uuid not null references produits(id) on delete cascade,
  user_id uuid not null,
  date_envoi timestamptz not null default now(),
  primary key (recherche_id, produit_id)
);

create index if not exists idx_alertes_envoyees_user_date on alertes_recherche_envoyees(user_id, date_envoi desc);

alter table alertes_recherche_envoyees enable row level security;
-- Aucune policy volontairement : seul le serveur (service_role) y accède.

-- ------------------------------------------------------------
-- 6) FACULTATIF — produits « High-Tech » déjà publiés qui sont en réalité des téléphones
--    (avant cette mise à jour, les téléphones étaient dans High-Tech).
--    NE PAS lancer à l'aveugle : d'abord l'aperçu, puis décide.
-- ------------------------------------------------------------
-- Aperçu (lecture seule) :
-- select id, nom, prix_base from produits
-- where type = 'high_tech'
--   and nom ~* '(iphone|galaxy|samsung|tecno|infinix|redmi|itel|oppo|vivo|realme|huawei|motorola|nokia|smartphone|téléphone|telephone)';
--
-- Reclasser ces produits en Téléphones (décommente seulement si l'aperçu est juste) :
-- update produits
-- set type = 'telephone',
--     categorie_id = (select id from categories_taxes where nom_categorie = 'telephone')
-- where type = 'high_tech'
--   and nom ~* '(iphone|galaxy|samsung|tecno|infinix|redmi|itel|oppo|vivo|realme|huawei|motorola|nokia|smartphone|téléphone|telephone)';
