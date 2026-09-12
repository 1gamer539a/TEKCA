-- ================================================================
-- FICHIER FUSIONNÉ — TOUTES LES MIGRATIONS TEKÇA, DANS L'ORDRE
-- Généré automatiquement — chaque script d'origine est signalé
-- par un séparateur. Tout est idempotent (if not exists), donc
-- sans danger à ré-exécuter même si une partie a déjà tourné.
-- Si une erreur apparaît, elle indique un numéro de ligne : cherche
-- le séparateur '==== fichier' juste au-dessus pour savoir lequel.
-- ================================================================


-- ================================================================
-- ==== fichier: schema.sql ====
-- ================================================================
-- ============================================================
-- SCHEMA PLATEFORME GAMING — Marketplace (Phase 1)
-- Postgres / Supabase
-- ============================================================

create type user_role as enum ('client', 'vendeur', 'admin', 'equipe');
create type vendeur_niveau as enum ('revendeur_officiel', 'vendeur_simple');
create type vendeur_statut as enum ('en_attente', 'valide', 'suspendu', 'refuse');
create type produit_statut as enum ('en_attente', 'valide', 'refuse');
create type remuneration_type as enum ('commission', 'abonnement', 'hybride');
create type prestataire_paiement as enum ('sebpay', 'cinetpay', 'autre');
create type type_produit as enum ('recharge_jeu', 'vetement', 'accessoire', 'abonnement_service');
create type mode_commande as enum ('panier', 'whatsapp', 'devis', 'catalogue');
create type commande_statut as enum ('en_attente', 'paye', 'expedie', 'livre', 'annule');

-- ============================================================
-- UTILISATEURS — compte unique pour toute la plateforme
-- ============================================================
create table users (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  telephone text unique,
  email text unique,
  mot_de_passe_hash text,                        -- nullable si connexion via Google/Facebook
  code_pin_hash text,                             -- PIN 4-6 chiffres, hashé
  google_id text unique,
  facebook_id text unique,
  ville text,
  captcha_verifie boolean not null default false,
  telephone_verifie boolean not null default false,
  piece_identite_verifiee boolean not null default false,  -- requise au-delà d'un seuil de ventes
  role user_role not null default 'client',
  date_creation timestamptz not null default now()
);

-- ============================================================
-- VENDEURS — extension du user si role = vendeur
-- ============================================================
create table vendeurs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  nom_boutique text not null,
  sous_domaine text unique,                      -- optionnel pour vendeur_simple (marché informel)
  niveau vendeur_niveau not null,                 -- modifiable via demande de changement (pas figé)
  statut vendeur_statut not null default 'en_attente',
  date_demande timestamptz not null default now(),
  date_validation timestamptz,                    -- délai 72h pour revendeur_officiel ; quasi instantané pour vendeur_simple
  mode_remuneration remuneration_type,
  prestataire_paiement prestataire_paiement,
  identifiants_paiement jsonb,
  ville text,                                     -- affiché publiquement pour vendeur_simple
  pays text not null default 'CG',                -- code pays (CG = Congo Brazzaville) — parmi les 19 pays SeePay
  visible_publiquement boolean not null default true,
  note_moyenne numeric(2,1) default 0,
  nb_avis int default 0,
  nb_ventes int default 0,
  temps_reponse_moyen_minutes int,
  date_creation timestamptz not null default now()
);

-- ============================================================
-- CATEGORIES / TAXES — chaque catégorie a son propre taux
-- (un vendeur peut vendre dans plusieurs catégories à la fois)
-- ============================================================
create table categories_taxes (
  id uuid primary key default gen_random_uuid(),
  nom_categorie text not null unique,           -- vêtements / PC / PlayStation / accessoires / abonnement / recharge
  taux_commission numeric(5,2) default 0,       -- en %
  montant_abonnement numeric(10,2) default 0    -- si applicable
);

-- ============================================================
-- PRODUITS
-- ============================================================
create table produits (
  id uuid primary key default gen_random_uuid(),
  vendeur_id uuid not null references vendeurs(id) on delete cascade,
  categorie_id uuid not null references categories_taxes(id),
  type type_produit not null,
  nom text not null,
  description text,
  prix_base numeric(10,2) not null,
  jeu_lie text,                                  -- Free Fire / PUBG / GTA / null
  mode_commande mode_commande not null default 'panier',
  statut_validation produit_statut not null default 'en_attente',  -- indépendant du statut vendeur
  preuve_url text,                               -- photo réelle / facture, obligatoire à la demande
  stock_global int,                              -- utilisé seulement si pas de variantes
  images text[],
  pays text not null default 'CG',                -- pays où l'article est vendu (hérite du vendeur par défaut)
  date_creation timestamptz not null default now()
  -- Note applicative : un vendeur avec niveau = 'vendeur_simple' ne peut créer
  -- que des produits de type 'accessoire' ou 'vetement' (biens physiques) —
  -- contrainte vérifiée côté backend avant insert, pas en SQL pur.
  -- Note applicative : les biens physiques (accessoire, vetement)
  -- sont autorisés dans les 19 pays couverts par contraintes_pays.sql
  -- — plus limités au Congo depuis l'ouverture du Marché à tous les
  -- pays SebPay. Vérifié côté backend.
);

-- ============================================================
-- VARIANTES PRODUITS — tailles / couleurs (ex: vêtements)
-- ============================================================
create table variantes_produits (
  id uuid primary key default gen_random_uuid(),
  produit_id uuid not null references produits(id) on delete cascade,
  taille text,
  couleur text,
  prix numeric(10,2),                            -- surcharge du prix_base si besoin
  stock int not null default 0,
  sku text unique
);

-- ============================================================
-- COMMANDES — toujours mono-vendeur
-- ============================================================
create table commandes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references users(id),
  vendeur_id uuid not null references vendeurs(id),
  variante_id uuid references variantes_produits(id),
  produit_id uuid not null references produits(id),
  quantite int not null default 1,
  montant_total numeric(10,2) not null,
  commission_appliquee numeric(10,2) default 0,
  statut commande_statut not null default 'en_attente',
  id_joueur text,                                -- pour les recharges de jeu
  pseudo_verifie text,                            -- résultat de la vérification d'ID
  date_creation timestamptz not null default now()
);

-- ============================================================
-- AVIS — obligatoires pour construire la confiance
-- ============================================================
create table avis (
  id uuid primary key default gen_random_uuid(),
  vendeur_id uuid not null references vendeurs(id) on delete cascade,
  client_id uuid not null references users(id),
  commande_id uuid not null references commandes(id),
  note int not null check (note between 1 and 5),
  commentaire text,
  date_creation timestamptz not null default now()
);

-- ============================================================
-- CHAT INTERNE — messagerie par vendeur (remplace WhatsApp pour les tiers)
-- ============================================================
create table conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references users(id),
  vendeur_id uuid not null references vendeurs(id),
  ia_autorisee boolean not null default false,   -- opt-in du vendeur pour l'IA
  date_creation timestamptz not null default now()
);

create table messages_chat (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  expediteur_id uuid not null references users(id),
  contenu text not null,
  envoye_par_ia boolean not null default false,
  lu boolean not null default false,
  date_creation timestamptz not null default now()
);

-- ============================================================
-- WALLETS RECHARGES — solde prépayé par vendeur et par jeu
-- (le vendeur dépose à l'avance, chaque vente décrémente le solde
--  automatiquement ; la plateforme elle-même peut aussi être son
--  propre "vendeur" fournisseur via un compte vendeur interne)
-- ============================================================
create type livraison_recharge as enum ('instantanee_api', 'differee_arriere_plan');

create table wallets_recharge (
  id uuid primary key default gen_random_uuid(),
  vendeur_id uuid not null references vendeurs(id) on delete cascade,
  jeu text not null,                             -- Free Fire / PUBG / GTA / etc.
  solde numeric(12,2) not null default 0,        -- en unité monétaire (FCFA)
  seuil_alerte numeric(12,2) default 5000,       -- alerte si le solde passe sous ce seuil
  date_maj timestamptz not null default now(),
  unique (vendeur_id, jeu)
);

create table depots_wallet (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references wallets_recharge(id) on delete cascade,
  montant numeric(12,2) not null,
  prestataire_paiement prestataire_paiement not null,
  date_creation timestamptz not null default now()
);

-- Chaque commande de type recharge_jeu décrémente le wallet correspondant
alter table commandes add column wallet_id uuid references wallets_recharge(id);
alter table commandes add column mode_livraison livraison_recharge;
alter table commandes add column livre_le timestamptz;

-- ============================================================
-- IA — suivi des générations pour la limite free/premium
-- ============================================================
create type ia_forfait as enum ('free', 'premium');

create table ia_abonnements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  forfait ia_forfait not null default 'free',
  nom_forfait text,                              -- ex: Basique / Pro / Ultra si premium
  date_debut timestamptz not null default now(),
  date_fin timestamptz
);

create table ia_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  type_generation text not null,                 -- sensibilite_ff / code_gta / autre
  date_creation timestamptz not null default now()
);

-- Index utile pour compter les générations du jour (limite 3/jour en free)
create index idx_ia_generations_user_date on ia_generations(user_id, date_creation);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create type notif_type as enum ('commande', 'message', 'produit_valide', 'produit_refuse', 'wallet_bas', 'tournoi');

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type notif_type not null,
  texte text not null,
  lu boolean not null default false,
  date_creation timestamptz not null default now()
);

create index idx_notifications_user on notifications(user_id, lu);

-- ============================================================
-- SEQUESTRE DES FONDS — inspiré du modèle Vinted
-- L'argent du client est retenu jusqu'à confirmation de réception
-- ou libération automatique après délai.
-- ============================================================
create type statut_sequestre as enum ('retenu', 'libere_manuel', 'libere_auto', 'litige');

create table sequestres (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references commandes(id) on delete cascade,
  montant_produit numeric(10,2) not null,
  frais_protection_acheteur numeric(10,2) not null,   -- % du prix, payé en plus par le client
  statut statut_sequestre not null default 'retenu',
  date_paiement timestamptz not null default now(),
  date_limite_confirmation timestamptz not null,       -- date_paiement + délai (ex: 2 jours après livraison)
  date_liberation timestamptz,
  confirme_par_client boolean not null default false
);

alter table commandes add column produit_conforme boolean;   -- renseigné en cas de litige de conformité
alter table commandes add column penalite_vendeur numeric(10,2);  -- taxe supplémentaire si non-conformité

-- ============================================================
-- BOOSTS & MISE EN AVANT — nouvelles sources de revenus (façon Vinted)
-- ============================================================
create type type_boost as enum ('boost_article', 'boost_boutique', 'publicite_banniere');

create table boosts (
  id uuid primary key default gen_random_uuid(),
  vendeur_id uuid not null references vendeurs(id) on delete cascade,
  produit_id uuid references produits(id),        -- null si c'est un boost de toute la boutique
  type type_boost not null,
  montant_paye numeric(10,2) not null,
  date_debut timestamptz not null default now(),
  date_fin timestamptz not null
);

-- ============================================================
-- PROMOTION DE COMPTES — annuaire + mise en avant payante
-- (TikTok, Instagram, YouTube, etc.)
-- ============================================================
create type reseau_social as enum ('tiktok', 'instagram', 'youtube', 'autre');

create table comptes_promus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  nom_compte text not null,
  reseau reseau_social not null,
  url_compte text not null,
  niche text,
  nb_abonnes int,
  statut_validation produit_statut not null default 'en_attente',
  date_creation timestamptz not null default now()
);

create table boosts_compte (
  id uuid primary key default gen_random_uuid(),
  compte_promu_id uuid not null references comptes_promus(id) on delete cascade,
  montant_paye numeric(10,2) not null,
  date_debut timestamptz not null default now(),
  date_fin timestamptz not null
);

-- ============================================================
-- FORMATION — deux parcours totalement séparés : Créateurs de
-- contenu (léger, rapide) et Entrepreneurs (académie sérieuse,
-- dirigée par le fondateur avec preuve de projets réels)
-- ============================================================
create type parcours_formation as enum ('createurs', 'entrepreneurs');
create type type_module as enum ('video', 'live', 'pdf');

create table modules_formation (
  id uuid primary key default gen_random_uuid(),
  parcours parcours_formation not null,
  titre text not null,
  description text,
  type type_module not null,
  duree text,
  url_contenu text,
  gratuit boolean not null default false,
  ordre int default 0,
  date_creation timestamptz not null default now()
);

-- Projets vitrine affichés sur la page Formation Entrepreneurs
-- (preuve de crédibilité du mentor)
create table projets_reference (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  description text,
  ordre int default 0
);

-- ============================================================
-- MARKETING DIGITAL — section à part, vente de produits digitaux
-- (livres, ebooks, templates, formations vidéo)
-- ============================================================
create type type_produit_digital as enum ('ebook', 'template', 'livre_physique', 'formation_video');

create table produits_digitaux (
  id uuid primary key default gen_random_uuid(),
  vendeur_id uuid not null references vendeurs(id) on delete cascade,
  titre text not null,
  type type_produit_digital not null,
  prix numeric(10,2) not null,
  fichier_url text,                                 -- null si livre_physique (livraison requise)
  statut_validation produit_statut not null default 'en_attente',
  date_creation timestamptz not null default now()
);

-- ============================================================
-- TOURNOIS — configurables au cas par cas (cash prize ou non,
-- inscription libre / payante / sur invitation)
-- ============================================================
create type type_recompense as enum ('cash_prize', 'nature_points', 'aucune');
create type mode_inscription as enum ('libre', 'payante', 'invitation');
create type statut_tournoi as enum ('a_venir', 'inscriptions_ouvertes', 'en_cours', 'termine', 'annule');
create type statut_inscription_joueur as enum ('en_attente', 'valide', 'refuse');

create table tournois (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  jeu text not null,
  description text,
  image_bannière text,
  type_recompense type_recompense not null,
  montant_cash_prize numeric(10,2),               -- si type_recompense = cash_prize
  description_recompense text,                     -- si nature_points
  mode_inscription mode_inscription not null,
  frais_inscription numeric(10,2) default 0,        -- si mode_inscription = payante
  nb_places_max int,
  statut statut_tournoi not null default 'a_venir',
  date_debut timestamptz not null,
  date_fin timestamptz,
  organise_par uuid references users(id),           -- membre équipe qui a créé le tournoi
  date_creation timestamptz not null default now()
);

create table inscriptions_tournoi (
  id uuid primary key default gen_random_uuid(),
  tournoi_id uuid not null references tournois(id) on delete cascade,
  joueur_id uuid not null references users(id),
  pseudo_jeu text not null,
  statut statut_inscription_joueur not null default 'en_attente',  -- auto-validé si mode = libre
  paiement_confirme boolean not null default false,  -- si mode = payante
  date_inscription timestamptz not null default now(),
  unique (tournoi_id, joueur_id)
);

create table resultats_tournoi (
  id uuid primary key default gen_random_uuid(),
  tournoi_id uuid not null references tournois(id) on delete cascade,
  joueur_id uuid not null references users(id),
  classement int not null,
  gain numeric(10,2),
  date_creation timestamptz not null default now()
);

-- ============================================================
-- FAVORIS — articles sauvegardés par un client
-- ============================================================
create table favoris (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  produit_id uuid not null references produits(id) on delete cascade,
  date_creation timestamptz not null default now(),
  unique (user_id, produit_id)
);

-- ============================================================
-- CONTACTS SUPPORT — canal "Nous contacter", séparé du chat vendeur
-- (arrive uniquement chez l'équipe plateforme, jamais chez un vendeur)
-- ============================================================
create type motif_contact as enum ('litige', 'paiement', 'vendeur', 'autre');
create type statut_contact as enum ('ouvert', 'en_cours', 'resolu');

create table contacts_support (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references users(id),
  motif motif_contact not null,
  message text not null,
  commande_id uuid references commandes(id),
  vendeur_concerne_id uuid references vendeurs(id),
  statut statut_contact not null default 'ouvert',
  traite_par uuid references users(id),          -- membre de l'équipe qui a répondu
  date_creation timestamptz not null default now()
);

-- ============================================================
-- DONNEES DE DEPART — catégories de base
-- ============================================================
insert into categories_taxes (nom_categorie, taux_commission, montant_abonnement) values
  ('recharge_jeu', 5, 0),
  ('accessoire', 8, 5000),
  ('vetement', 6, 0),
  ('abonnement_service', 5, 0);

-- ============================================================
-- SUPABASE STORAGE — buckets pour les photos produits et les preuves
-- ============================================================
insert into storage.buckets (id, name, public)
values ('produits', 'produits', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('preuves', 'preuves', false)  -- privé : seule l'équipe doit voir les preuves
on conflict (id) do nothing;

create policy "Un utilisateur connecté peut uploader ses photos produit"
on storage.objects for insert
to authenticated
with check (bucket_id = 'produits');

create policy "Les photos produit sont visibles publiquement"
on storage.objects for select
to public
using (bucket_id = 'produits');

create policy "Un utilisateur connecté peut uploader ses preuves"
on storage.objects for insert
to authenticated
with check (bucket_id = 'preuves');

-- ============================================================
-- RETRAITS VENDEURS (payouts) — Airtel Money / MTN Mobile Money
-- ============================================================
create type moyen_retrait as enum ('airtel_money', 'mtn_mobile_money', 'sebpay', 'autre');
create type statut_retrait as enum ('demande', 'valide', 'refuse', 'verse');

create table demandes_retrait (
  id uuid primary key default gen_random_uuid(),
  vendeur_id uuid not null references vendeurs(id) on delete cascade,
  montant numeric(12,2) not null,
  moyen moyen_retrait not null,
  numero_destinataire text not null,
  statut statut_retrait not null default 'demande',
  traite_par uuid references users(id),
  date_demande timestamptz not null default now(),
  date_traitement timestamptz
);

-- ============================================================
-- BADGES DE VERIFICATION VENDEUR
-- ============================================================
alter table vendeurs add column badge text; -- 'vendeur_agree' | 'guilde_officielle' | null

-- ============================================================
-- LOGS IA — pour analyse des besoins fréquents / détection de dérives
-- ============================================================
create table logs_ia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  requete text not null,
  reponse text,
  date_creation timestamptz not null default now()
);

-- ============================================================
-- JOURNAL DE SECURITE — tentatives de connexion suspectes, reset PIN
-- ============================================================
create type type_evenement_securite as enum ('connexion_echouee', 'pin_reinitialise', 'connexion_suspecte');

create table journal_securite (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  type type_evenement_securite not null,
  details text,
  date_creation timestamptz not null default now()
);

-- ============================================================
-- BANNIERES / CAROUSEL ACCUEIL — éditable depuis l'admin
-- ============================================================
create table bannieres_accueil (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  sous_titre text,
  image_url text,
  lien text,
  ordre int default 0,
  active boolean not null default true,
  date_creation timestamptz not null default now()
);

-- ============================================================
-- CODES PROMO
-- ============================================================
create table codes_promo (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  reduction_pourcentage numeric(5,2),
  reduction_montant numeric(10,2),
  categorie_id uuid references categories_taxes(id), -- null = toute la plateforme
  date_expiration timestamptz,
  nb_utilisations_max int,
  nb_utilisations int default 0,
  active boolean not null default true,
  date_creation timestamptz not null default now()
);

-- ============================================================
-- NOTIFICATIONS GROUPEES (push/SMS/WhatsApp envoyées par l'admin)
-- ============================================================
create table campagnes_notification (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  message text not null,
  canal text not null, -- 'push' | 'sms' | 'whatsapp'
  envoye_par uuid references users(id),
  date_envoi timestamptz not null default now()
);

-- ============================================================
-- FAQ / BASE DE CONNAISSANCES — éditable depuis l'admin
-- ============================================================
create table faq (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  reponse text not null,
  categorie text,
  ordre int default 0,
  date_creation timestamptz not null default now()
);

-- ============================================================
-- LIVRAISON — agents/livreurs et assignation
-- ============================================================
create table agents_livraison (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  telephone text,
  ville text not null,
  actif boolean not null default true
);

alter table commandes add column agent_livraison_id uuid references agents_livraison(id);

-- ============================================================
-- WALLET GENERAL — un portefeuille par utilisateur (client, vendeur,
-- tout le monde), distinct des wallets_recharge (qui sont spécifiques
-- aux vendeurs pour les recharges de jeu)
-- ============================================================
create table wallets (
  user_id uuid primary key references users(id) on delete cascade,
  solde numeric(12,2) not null default 0,
  is_frozen boolean not null default false,       -- gel automatique dès signalement reçu
  freeze_reason text,
  date_maj timestamptz not null default now()
);

create type type_transaction_wallet as enum ('recharge', 'retrait', 'transfert_envoye', 'transfert_recu', 'paiement_commande', 'ajustement_admin');
create type statut_transaction_wallet as enum ('en_attente', 'reussi', 'echoue');
create type moyen_retrait_wallet as enum ('airtel_money', 'mtn_mobile_money', 'sebpay', 'autre');

create table transactions_wallet (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  type type_transaction_wallet not null,
  montant numeric(12,2) not null,
  destinataire_id uuid references users(id),      -- pour les transferts internes
  moyen moyen_retrait_wallet,                       -- pour recharge/retrait externe
  numero_destinataire text,                         -- numéro mobile money pour le retrait
  reference_sebpay text,                            -- id de transaction côté Sebpay
  statut statut_transaction_wallet not null default 'en_attente',
  date_creation timestamptz not null default now()
);

create index idx_transactions_wallet_user on transactions_wallet(user_id, date_creation);

-- ============================================================
-- COMPLÉMENTS PROFIL — obligatoires à l'inscription
-- ============================================================
alter table users add column adresse_ville text;
alter table users add column telephone_whatsapp text;
-- `telephone` existant reste le numéro utilisé pour les transactions
-- (peut être identique à telephone_whatsapp)

-- Seuil : retrait >= 15 000 FCFA nécessite piece_identite_verifiee = true
-- (vérifié côté application avant l'appel à l'API Sebpay, pas en SQL pur)


-- ================================================================
-- ==== fichier: rls_policies.sql ====
-- ================================================================
-- ============================================================
-- POLITIQUES RLS — PLATEFORME GAMING
-- À exécuter dans l'éditeur SQL de Supabase, APRÈS schema.sql
-- ============================================================
-- Pourquoi ce fichier existe :
-- La clé "anon" Supabase est publique par construction (elle est dans
-- le bundle JS envoyé au navigateur). Sans RLS, quiconque inspecte le
-- code ou le réseau peut appeler Supabase directement et lire/modifier
-- N'IMPORTE QUELLE ligne de N'IMPORTE QUELLE table — soldes de wallet,
-- statut de vérification d'identité, etc. Les routes serveur (qui
-- utilisent supabaseAdmin / la clé service_role) ne sont PAS
-- concernées par RLS : elles continuent de tout voir, comme avant.
-- ============================================================

-- ------------------------------------------------------------
-- Fonction utilitaire : est-ce un admin/équipe ?
-- SECURITY DEFINER pour éviter la récursion RLS quand cette
-- fonction est appelée depuis une policy sur la table users elle-même.
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role in ('admin', 'equipe')
  );
$$;

-- ------------------------------------------------------------
-- Fonction utilitaire : l'utilisateur connecté est-il le
-- propriétaire (via vendeurs.user_id) d'un vendeur_id donné ?
-- ------------------------------------------------------------
create or replace function public.est_proprietaire_vendeur(v_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.vendeurs
    where id = v_id and user_id = auth.uid()
  );
$$;

-- ============================================================
-- USERS
-- ============================================================
alter table users enable row level security;

create policy "users_select_own_or_admin"
on users for select
to authenticated
using (id = auth.uid() or is_admin());

create policy "users_insert_own"
on users for insert
to authenticated
with check (id = auth.uid());

create policy "users_update_own_or_admin"
on users for update
to authenticated
using (id = auth.uid() or is_admin())
with check (id = auth.uid() or is_admin());

-- Empêche un utilisateur normal de s'auto-attribuer un rôle admin ou
-- de se marquer "identité vérifiée" via une simple requête UPDATE —
-- RLS seule ne fait pas de contrôle par colonne, donc on verrouille
-- ces champs avec un trigger. service_role (routes serveur) n'est PAS
-- affecté par ce trigger que si on ne l'exempte pas explicitement ;
-- ici on l'exempte via auth.role() = 'service_role'.
create or replace function public.proteger_champs_sensibles_users()
returns trigger
language plpgsql
security definer
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Modification du rôle non autorisée.';
  end if;
  if new.piece_identite_verifiee is distinct from old.piece_identite_verifiee then
    raise exception 'Modification de la vérification d''identité non autorisée.';
  end if;
  if new.captcha_verifie is distinct from old.captcha_verifie then
    raise exception 'Modification du statut captcha non autorisée.';
  end if;
  if new.telephone_verifie is distinct from old.telephone_verifie then
    raise exception 'Modification du statut de vérification téléphone non autorisée.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_champs_sensibles_users on users;
create trigger trg_proteger_champs_sensibles_users
before update on users
for each row execute function public.proteger_champs_sensibles_users();

-- ============================================================
-- VENDEURS
-- ============================================================
alter table vendeurs enable row level security;

create policy "vendeurs_select_public_valides"
on vendeurs for select
to public
using (statut = 'valide' and visible_publiquement = true);

create policy "vendeurs_select_own_or_admin"
on vendeurs for select
to authenticated
using (user_id = auth.uid() or is_admin());

create policy "vendeurs_insert_own"
on vendeurs for insert
to authenticated
with check (user_id = auth.uid());

create policy "vendeurs_update_own_or_admin"
on vendeurs for update
to authenticated
using (user_id = auth.uid() or is_admin())
with check (user_id = auth.uid() or is_admin());

-- Le statut de validation (en_attente/valide/suspendu/refuse) ne doit
-- pas pouvoir être auto-attribué par le vendeur — seul service_role
-- (route admin serveur) peut le changer.
create or replace function public.proteger_statut_vendeur()
returns trigger
language plpgsql
security definer
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.statut is distinct from old.statut then
    raise exception 'Modification du statut vendeur non autorisée.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_statut_vendeur on vendeurs;
create trigger trg_proteger_statut_vendeur
before update on vendeurs
for each row execute function public.proteger_statut_vendeur();

-- ============================================================
-- PRODUITS
-- ============================================================
alter table produits enable row level security;

create policy "produits_select_public_valides"
on produits for select
to public
using (statut_validation = 'valide');

create policy "produits_select_own_ou_admin"
on produits for select
to authenticated
using (est_proprietaire_vendeur(vendeur_id) or is_admin());

create policy "produits_insert_own"
on produits for insert
to authenticated
with check (est_proprietaire_vendeur(vendeur_id));

create policy "produits_update_own_ou_admin"
on produits for update
to authenticated
using (est_proprietaire_vendeur(vendeur_id) or is_admin())
with check (est_proprietaire_vendeur(vendeur_id) or is_admin());

create policy "produits_delete_own_ou_admin"
on produits for delete
to authenticated
using (est_proprietaire_vendeur(vendeur_id) or is_admin());

-- Un vendeur ne peut pas se valider lui-même
create or replace function public.proteger_statut_produit()
returns trigger
language plpgsql
security definer
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.statut_validation is distinct from old.statut_validation then
    raise exception 'Modification du statut de validation non autorisée.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_statut_produit on produits;
create trigger trg_proteger_statut_produit
before update on produits
for each row execute function public.proteger_statut_produit();

-- ============================================================
-- VARIANTES PRODUITS
-- ============================================================
alter table variantes_produits enable row level security;

create policy "variantes_select_public"
on variantes_produits for select
to public
using (
  exists (select 1 from produits p where p.id = produit_id and p.statut_validation = 'valide')
);

create policy "variantes_gestion_own_ou_admin"
on variantes_produits for all
to authenticated
using (
  exists (
    select 1 from produits p
    where p.id = produit_id and (est_proprietaire_vendeur(p.vendeur_id) or is_admin())
  )
)
with check (
  exists (
    select 1 from produits p
    where p.id = produit_id and (est_proprietaire_vendeur(p.vendeur_id) or is_admin())
  )
);

-- ============================================================
-- COMMANDES — écriture réservée au serveur (supabaseAdmin),
-- lecture ouverte au client concerné et au vendeur concerné
-- ============================================================
alter table commandes enable row level security;

create policy "commandes_select_client_vendeur_admin"
on commandes for select
to authenticated
using (client_id = auth.uid() or est_proprietaire_vendeur(vendeur_id) or is_admin());

-- Pas de policy insert/update/delete pour "authenticated" : toute
-- création/modification de commande passe par /api/commandes/* côté
-- serveur (service_role), qui contourne RLS. C'est voulu — les
-- montants et statuts ne doivent jamais être écrits depuis le client.

-- ============================================================
-- AVIS
-- ============================================================
alter table avis enable row level security;

create policy "avis_select_public"
on avis for select
to public
using (true);

create policy "avis_insert_own_commande"
on avis for insert
to authenticated
with check (
  client_id = auth.uid()
  and exists (
    select 1 from commandes c
    where c.id = commande_id and c.client_id = auth.uid() and c.statut = 'livre'
  )
);

-- ============================================================
-- CONVERSATIONS & MESSAGES_CHAT
-- ============================================================
alter table conversations enable row level security;

create policy "conversations_select_participant_ou_admin"
on conversations for select
to authenticated
using (client_id = auth.uid() or est_proprietaire_vendeur(vendeur_id) or is_admin());

create policy "conversations_insert_client"
on conversations for insert
to authenticated
with check (client_id = auth.uid());

alter table messages_chat enable row level security;

create policy "messages_select_participant_ou_admin"
on messages_chat for select
to authenticated
using (
  exists (
    select 1 from conversations c
    where c.id = conversation_id
      and (c.client_id = auth.uid() or est_proprietaire_vendeur(c.vendeur_id) or is_admin())
  )
);

create policy "messages_insert_participant"
on messages_chat for insert
to authenticated
with check (
  expediteur_id = auth.uid()
  and exists (
    select 1 from conversations c
    where c.id = conversation_id
      and (c.client_id = auth.uid() or est_proprietaire_vendeur(c.vendeur_id))
  )
);

create policy "messages_update_lu_participant"
on messages_chat for update
to authenticated
using (
  exists (
    select 1 from conversations c
    where c.id = conversation_id
      and (c.client_id = auth.uid() or est_proprietaire_vendeur(c.vendeur_id))
  )
)
with check (
  exists (
    select 1 from conversations c
    where c.id = conversation_id
      and (c.client_id = auth.uid() or est_proprietaire_vendeur(c.vendeur_id))
  )
);

-- ============================================================
-- WALLET GÉNÉRAL — lecture seule pour le propriétaire, AUCUNE
-- écriture depuis le client (même pas pour un admin). Tout passe
-- par les routes serveur (/api/wallet/*) avec service_role.
--
-- ⚠️ Ceci casse volontairement les appels directs actuellement
-- faits par components/SalleSurveillance.jsx (geler/dégeler un
-- wallet, marquer une identité vérifiée) : ces actions doivent être
-- déplacées vers de nouvelles routes serveur admin protégées par
-- is_admin(), sinon elles échoueront après activation de RLS.
-- ============================================================
alter table wallets enable row level security;

create policy "wallets_select_own_ou_admin"
on wallets for select
to authenticated
using (user_id = auth.uid() or is_admin());

-- Pas de policy insert/update/delete pour authenticated → refusé par
-- défaut. Seul service_role peut écrire.

alter table transactions_wallet enable row level security;

create policy "transactions_wallet_select_own_ou_admin"
on transactions_wallet for select
to authenticated
using (user_id = auth.uid() or destinataire_id = auth.uid() or is_admin());

-- Idem : aucune écriture client. Tout passe par les routes serveur.

-- ============================================================
-- WALLETS_RECHARGE & DEPOTS_WALLET (soldes prépayés vendeur)
-- ============================================================
alter table wallets_recharge enable row level security;

create policy "wallets_recharge_select_own_ou_admin"
on wallets_recharge for select
to authenticated
using (est_proprietaire_vendeur(vendeur_id) or is_admin());

-- Écriture réservée au serveur (décrément automatique à la commande,
-- dépôt validé par paiement) → pas de policy authenticated en insert/update.

alter table depots_wallet enable row level security;

create policy "depots_wallet_select_own_ou_admin"
on depots_wallet for select
to authenticated
using (
  exists (
    select 1 from wallets_recharge wr
    where wr.id = wallet_id and (est_proprietaire_vendeur(wr.vendeur_id) or is_admin())
  )
);

-- ============================================================
-- IA — abonnements, générations, logs
-- ============================================================
alter table ia_abonnements enable row level security;

create policy "ia_abonnements_select_own_ou_admin"
on ia_abonnements for select
to authenticated
using (user_id = auth.uid() or is_admin());
-- Écriture (changement de forfait) réservée au serveur.

alter table ia_generations enable row level security;

create policy "ia_generations_select_own_ou_admin"
on ia_generations for select
to authenticated
using (user_id = auth.uid() or is_admin());
-- Insertion faite côté serveur (route /api/ia) pour fiabiliser le
-- comptage de la limite 3/jour — pas de policy insert authenticated.

alter table logs_ia enable row level security;

create policy "logs_ia_admin_only"
on logs_ia for select
to authenticated
using (is_admin());
-- Écrit uniquement par le serveur.

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
alter table notifications enable row level security;

create policy "notifications_select_own"
on notifications for select
to authenticated
using (user_id = auth.uid());

create policy "notifications_update_lu_own"
on notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
-- Insertion faite par le serveur (déclenchée par les événements
-- métier : commande, message, statut produit, wallet gelé...).

-- ============================================================
-- SEQUESTRES — lecture par client/vendeur concernés, écriture serveur
-- ============================================================
alter table sequestres enable row level security;

create policy "sequestres_select_participant_ou_admin"
on sequestres for select
to authenticated
using (
  exists (
    select 1 from commandes c
    where c.id = commande_id
      and (c.client_id = auth.uid() or est_proprietaire_vendeur(c.vendeur_id) or is_admin())
  )
);

-- ============================================================
-- BOOSTS & PROMOTION DE COMPTES
-- ============================================================
alter table boosts enable row level security;

create policy "boosts_select_public"
on boosts for select
to public
using (date_fin > now());

create policy "boosts_select_own_ou_admin"
on boosts for select
to authenticated
using (est_proprietaire_vendeur(vendeur_id) or is_admin());
-- Création via route serveur (paiement du boost vérifié).

alter table comptes_promus enable row level security;

create policy "comptes_promus_select_public_valides"
on comptes_promus for select
to public
using (statut_validation = 'valide');

create policy "comptes_promus_select_own_ou_admin"
on comptes_promus for select
to authenticated
using (user_id = auth.uid() or is_admin());

create policy "comptes_promus_insert_own"
on comptes_promus for insert
to authenticated
with check (user_id = auth.uid());

create policy "comptes_promus_update_own_ou_admin"
on comptes_promus for update
to authenticated
using (user_id = auth.uid() or is_admin())
with check (user_id = auth.uid() or is_admin());

alter table boosts_compte enable row level security;

create policy "boosts_compte_select_public"
on boosts_compte for select
to public
using (date_fin > now());

create policy "boosts_compte_select_own_ou_admin"
on boosts_compte for select
to authenticated
using (
  exists (
    select 1 from comptes_promus cp
    where cp.id = compte_promu_id and (cp.user_id = auth.uid() or is_admin())
  )
);

-- ============================================================
-- FORMATION & PROJETS DE RÉFÉRENCE — lecture publique, écriture admin
-- ============================================================
alter table modules_formation enable row level security;

create policy "modules_formation_select_public"
on modules_formation for select
to public
using (true);

create policy "modules_formation_admin_write"
on modules_formation for all
to authenticated
using (is_admin())
with check (is_admin());

alter table projets_reference enable row level security;

create policy "projets_reference_select_public"
on projets_reference for select
to public
using (true);

create policy "projets_reference_admin_write"
on projets_reference for all
to authenticated
using (is_admin())
with check (is_admin());

-- ============================================================
-- PRODUITS DIGITAUX (marketing digital)
-- ============================================================
alter table produits_digitaux enable row level security;

create policy "produits_digitaux_select_public_valides"
on produits_digitaux for select
to public
using (statut_validation = 'valide');

create policy "produits_digitaux_select_own_ou_admin"
on produits_digitaux for select
to authenticated
using (est_proprietaire_vendeur(vendeur_id) or is_admin());

create policy "produits_digitaux_insert_own"
on produits_digitaux for insert
to authenticated
with check (est_proprietaire_vendeur(vendeur_id));

create policy "produits_digitaux_update_own_ou_admin"
on produits_digitaux for update
to authenticated
using (est_proprietaire_vendeur(vendeur_id) or is_admin())
with check (est_proprietaire_vendeur(vendeur_id) or is_admin());

-- ============================================================
-- TOURNOIS
-- ============================================================
alter table tournois enable row level security;

create policy "tournois_select_public"
on tournois for select
to public
using (true);

create policy "tournois_admin_write"
on tournois for all
to authenticated
using (is_admin())
with check (is_admin());

alter table inscriptions_tournoi enable row level security;

create policy "inscriptions_tournoi_select_own_ou_admin"
on inscriptions_tournoi for select
to authenticated
using (joueur_id = auth.uid() or is_admin());

create policy "inscriptions_tournoi_insert_own"
on inscriptions_tournoi for insert
to authenticated
with check (joueur_id = auth.uid());

alter table resultats_tournoi enable row level security;

create policy "resultats_tournoi_select_public"
on resultats_tournoi for select
to public
using (true);

create policy "resultats_tournoi_admin_write"
on resultats_tournoi for all
to authenticated
using (is_admin())
with check (is_admin());

-- ============================================================
-- FAVORIS
-- ============================================================
alter table favoris enable row level security;

create policy "favoris_gestion_own"
on favoris for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ============================================================
-- CONTACTS SUPPORT (signalements)
-- ============================================================
alter table contacts_support enable row level security;

create policy "contacts_support_select_own_ou_admin"
on contacts_support for select
to authenticated
using (client_id = auth.uid() or is_admin());

create policy "contacts_support_insert_own"
on contacts_support for insert
to authenticated
with check (client_id = auth.uid());

create policy "contacts_support_update_admin"
on contacts_support for update
to authenticated
using (is_admin())
with check (is_admin());

-- ============================================================
-- DEMANDES DE RETRAIT VENDEUR (payouts)
-- ============================================================
alter table demandes_retrait enable row level security;

create policy "demandes_retrait_select_own_ou_admin"
on demandes_retrait for select
to authenticated
using (est_proprietaire_vendeur(vendeur_id) or is_admin());

create policy "demandes_retrait_insert_own"
on demandes_retrait for insert
to authenticated
with check (est_proprietaire_vendeur(vendeur_id));

create policy "demandes_retrait_update_admin"
on demandes_retrait for update
to authenticated
using (is_admin())
with check (is_admin());

-- ============================================================
-- JOURNAL DE SÉCURITÉ — 100% interne, aucun accès client
-- ============================================================
alter table journal_securite enable row level security;

create policy "journal_securite_admin_only"
on journal_securite for select
to authenticated
using (is_admin());
-- Écrit uniquement par le serveur (service_role).

-- ============================================================
-- CONTENU ÉDITORIAL PUBLIC — bannières, FAQ, catégories
-- ============================================================
alter table bannieres_accueil enable row level security;

create policy "bannieres_select_public_actives"
on bannieres_accueil for select
to public
using (active = true);

create policy "bannieres_admin_write"
on bannieres_accueil for all
to authenticated
using (is_admin())
with check (is_admin());

alter table faq enable row level security;

create policy "faq_select_public"
on faq for select
to public
using (true);

create policy "faq_admin_write"
on faq for all
to authenticated
using (is_admin())
with check (is_admin());

alter table categories_taxes enable row level security;

create policy "categories_taxes_select_public"
on categories_taxes for select
to public
using (true);

create policy "categories_taxes_admin_write"
on categories_taxes for all
to authenticated
using (is_admin())
with check (is_admin());

-- ============================================================
-- CODES PROMO — pas de lecture publique de la liste complète
-- (évite le scraping / la fuite de codes non annoncés) ; la
-- validation d'un code au checkout doit passer par une route
-- serveur qui vérifie active/date_expiration/nb_utilisations.
-- ============================================================
alter table codes_promo enable row level security;

create policy "codes_promo_admin_only"
on codes_promo for select
to authenticated
using (is_admin());

create policy "codes_promo_admin_write"
on codes_promo for all
to authenticated
using (is_admin())
with check (is_admin());

-- ============================================================
-- CAMPAGNES NOTIFICATION & AGENTS LIVRAISON — 100% admin
-- ============================================================
alter table campagnes_notification enable row level security;

create policy "campagnes_notification_admin_only"
on campagnes_notification for all
to authenticated
using (is_admin())
with check (is_admin());

alter table agents_livraison enable row level security;

create policy "agents_livraison_admin_only"
on agents_livraison for all
to authenticated
using (is_admin())
with check (is_admin());

-- ============================================================
-- CONTRAINTE MANQUANTE — un solde de wallet ne doit jamais être négatif
-- (filet de sécurité en plus des vérifications applicatives)
-- ============================================================
alter table wallets add constraint wallets_solde_non_negatif check (solde >= 0);
alter table wallets_recharge add constraint wallets_recharge_solde_non_negatif check (solde >= 0);

-- ============================================================
-- À FAIRE CÔTÉ APPLICATIF APRÈS CE SCRIPT :
-- 1. Déplacer les écritures directes de components/SalleSurveillance.jsx
--    (geler/dégeler wallet, marquer identité vérifiée, valider un
--    vendeur/produit) vers de nouvelles routes serveur app/api/admin/*
--    qui utilisent supabaseAdmin + vérifient is_admin() côté serveur.
-- 2. Vérifier que le composant d'inscription (AuthCompte.jsx, non
--    encore branché à Supabase Auth) insère bien la ligne `users`
--    avec id = auth.uid() du compte Supabase Auth créé.
-- ============================================================


-- ================================================================
-- ==== fichier: auth_setup.sql ====
-- ================================================================
-- ============================================================
-- AUTHENTIFICATION — trigger de création de profil + support du
-- rate limiting de connexion
-- À exécuter APRÈS schema.sql et rls_policies.sql
-- ============================================================

-- ------------------------------------------------------------
-- Création automatique de la ligne public.users à l'inscription
-- Supabase Auth (table interne auth.users) est la SEULE source de
-- vérité pour l'email et le mot de passe : le mot de passe est
-- haché par Supabase Auth (bcrypt) et n'est jamais lu ni stocké par
-- notre code. La colonne users.mot_de_passe_hash du schéma original
-- est donc laissée inutilisée/legacy — ne jamais y écrire de mot de
-- passe en clair ni la réutiliser pour une vérification maison.
--
-- Ce trigger tourne en SECURITY DEFINER, donc il n'a pas besoin
-- d'une session déjà active : il s'exécute même si la confirmation
-- email est requise avant la première connexion.
-- ------------------------------------------------------------
create or replace function public.gerer_nouvel_utilisateur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, nom, email, telephone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nom', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'telephone',
    'client'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.gerer_nouvel_utilisateur();

-- ------------------------------------------------------------
-- Index pour que la vérification de rate limiting (comptage des
-- tentatives de connexion échouées récentes) reste rapide même
-- quand journal_securite grossit.
-- ------------------------------------------------------------
create index if not exists idx_journal_securite_type_date
on journal_securite(type, date_creation);

-- ------------------------------------------------------------
-- Note sur la durée de session (TTL) :
-- Supabase Auth émet des access tokens JWT de courte durée (1h par
-- défaut) avec rotation automatique du refresh token. Cette durée se
-- configure dans le Dashboard Supabase → Authentication → Settings →
-- "Access token expiry" / "Refresh token rotation" — ce n'est pas un
-- réglage applicatif. Réduis-la si besoin (ex: 30 min) pour un
-- wallet financier comme celui-ci. La déconnexion explicite
-- (supabase.auth.signOut(), câblée dans ProfilParametres.jsx) révoque
-- le refresh token côté serveur Supabase, donc une session déconnectée
-- ne peut pas être rejouée.
-- ------------------------------------------------------------


-- ================================================================
-- ==== fichier: contraintes_pays.sql ====
-- ================================================================
-- ============================================================
-- LIMITE PAYS = COUVERTURE SEBPAY
-- À exécuter après schema.sql
-- ============================================================
-- L'inscription vendeur (components/DevenirVendeur.jsx) insère
-- directement depuis le client (pas de route serveur intermédiaire).
-- Le menu déroulant limite les choix côté UI, mais rien n'empêchait
-- techniquement l'insertion d'un pays hors liste en contournant le
-- formulaire. Cette contrainte le bloque au niveau base, quelle que
-- soit la voie d'insertion.
--
-- Liste basée sur les captures d'écran réelles du sélecteur de pays
-- Sebpay (28/08/2026) — Togo confirmé, Tchad exclu (absent du
-- sélecteur malgré sa présence sur le site marketing). À revérifier
-- si Sebpay étend sa couverture. Miroir de lib/pays.js.
-- ============================================================

alter table vendeurs
  add constraint vendeurs_pays_couvert_sebpay
  check (pays in ('CG','CM','GA','CD','CI','SN','BJ','TG','BF','ML','NE','GN','GW','GM','GH','KE','NG','UG','TZ'));

alter table produits
  add constraint produits_pays_couvert_sebpay
  check (pays in ('CG','CM','GA','CD','CI','SN','BJ','TG','BF','ML','NE','GN','GW','GM','GH','KE','NG','UG','TZ'));


-- ================================================================
-- ==== fichier: fix_wallet_atomique.sql ====
-- ================================================================
-- ============================================================
-- CORRECTIF SÉCURITÉ : opérations atomiques sur les wallets
-- ------------------------------------------------------------
-- Problème corrigé : toutes les routes API qui touchaient au solde
-- d'un wallet faisaient "SELECT solde ... puis UPDATE solde = X" en
-- deux requêtes séparées. Deux requêtes simultanées (double-clic,
-- script, ou simple lenteur réseau) pouvaient lire le même solde de
-- départ avant que l'une des deux n'écrive, permettant un retrait ou
-- transfert en double (double-dépense) même si la contrainte
-- `solde >= 0` empêchait un solde final négatif.
--
-- Ces deux fonctions font la lecture ET l'écriture dans la MÊME
-- requête SQL (donc atomique au niveau de la ligne côté Postgres) :
-- plus aucune fenêtre de course possible.
--
-- À exécuter une seule fois dans l'éditeur SQL Supabase.
-- ============================================================

-- Débite un wallet, mais SEULEMENT si le solde est suffisant.
-- Retourne le nouveau solde si l'opération a réussi, ou NULL si le
-- solde était insuffisant (dans ce cas, RIEN n'a été modifié).
create or replace function debiter_wallet_atomique(p_user_id uuid, p_montant numeric)
returns numeric
language plpgsql
security definer
as $$
declare
  v_nouveau_solde numeric;
begin
  update wallets
  set solde = solde - p_montant,
      date_maj = now()
  where user_id = p_user_id
    and solde >= p_montant
  returning solde into v_nouveau_solde;

  return v_nouveau_solde; -- NULL = solde insuffisant, aucune écriture faite
end;
$$;

-- Crédite un wallet (crée la ligne si elle n'existe pas encore).
-- Toujours atomique : deux crédits simultanés s'additionnent
-- correctement au lieu de s'écraser l'un l'autre.
create or replace function crediter_wallet_atomique(p_user_id uuid, p_montant numeric)
returns numeric
language plpgsql
security definer
as $$
declare
  v_nouveau_solde numeric;
begin
  insert into wallets (user_id, solde, date_maj)
  values (p_user_id, p_montant, now())
  on conflict (user_id) do update
    set solde = wallets.solde + excluded.solde,
        date_maj = now()
  returning solde into v_nouveau_solde;

  return v_nouveau_solde;
end;
$$;


-- ================================================================
-- ==== fichier: fix_plafond_mineurs.sql ====
-- ================================================================
-- ============================================================
-- PLAFOND WALLET POUR LES 14-16 ANS (50 000 FCFA max en solde)
-- ------------------------------------------------------------
-- Remplace crediter_wallet_atomique (voir fix_wallet_atomique.sql)
-- par une version qui vérifie l'âge avant de créditer. Placé ICI,
-- au niveau de la fonction de crédit elle-même plutôt que dans une
-- seule route API, cette règle s'applique automatiquement à TOUTE
-- source de crédit du wallet : recharge Mobile Money, transfert reçu
-- d'un autre utilisateur, cashback, paiement vendeur — sans avoir à
-- dupliquer la vérification dans chaque route.
-- ============================================================
create or replace function crediter_wallet_atomique(p_user_id uuid, p_montant numeric)
returns numeric
language plpgsql
security definer
as $$
declare
  v_nouveau_solde numeric;
  v_solde_actuel numeric;
  v_date_naissance date;
  v_age integer;
  v_plafond constant numeric := 50000;
begin
  select date_naissance into v_date_naissance from users where id = p_user_id;

  if v_date_naissance is not null then
    v_age := extract(year from age(current_date, v_date_naissance));
    if v_age between 14 and 16 then
      select solde into v_solde_actuel from wallets where user_id = p_user_id;
      if coalesce(v_solde_actuel, 0) + p_montant > v_plafond then
        raise exception 'plafond_mineur_depasse' using errcode = 'P0001';
      end if;
    end if;
  end if;

  insert into wallets (user_id, solde, date_maj)
  values (p_user_id, p_montant, now())
  on conflict (user_id) do update
    set solde = wallets.solde + excluded.solde,
        date_maj = now()
  returning solde into v_nouveau_solde;

  return v_nouveau_solde;
end;
$$;


-- ================================================================
-- ==== fichier: fix_admin_acces.sql ====
-- ================================================================
-- ============================================================
-- ACCÈS ADMIN PAR EMAIL + CODE (remplace la connexion classique)
-- ------------------------------------------------------------
-- Le lien vers la Salle de Surveillance ne demande plus une vraie
-- connexion Supabase (email/mot de passe ou Google) : on saisit
-- directement un email déjà marqué admin/équipe en base + un code
-- partagé (ADMIN_CODE, variable d'environnement Vercel). En cas de
-- succès, un jeton aléatoire est stocké ici et posé en cookie —
-- le middleware vérifie ensuite ce jeton à chaque page /admin/*.
-- ============================================================
create table if not exists admin_acces_sessions (
  token text primary key,
  email text not null,
  expire_a timestamptz not null,
  date_creation timestamptz not null default now()
);

create index if not exists idx_admin_acces_expire on admin_acces_sessions(expire_a);

-- RLS : personne ne doit pouvoir lire/écrire cette table directement
-- depuis le client — uniquement via le service role côté serveur
-- (route API + middleware, qui utilisent tous les deux la clé
-- service_role, jamais exposée au navigateur).
alter table admin_acces_sessions enable row level security;


-- ================================================================
-- ==== fichier: code_livraison.sql ====
-- ================================================================
-- ============================================================
-- CODE DE CONFIRMATION DE LIVRAISON (produits physiques)
-- À exécuter après schema.sql, rls_policies.sql et auth_setup.sql
-- ============================================================
-- Principe : à la création d'une commande de produit physique
-- (vêtement/accessoire), un code à 6 chiffres est généré et réservé
-- à l'acheteur. Au moment de la remise en main propre, l'acheteur
-- communique ce code au vendeur, qui le saisit dans son tableau de
-- bord pour confirmer la livraison et débloquer le séquestre.
--
-- Le code vit dans sa PROPRE table, sans aucune policy RLS de
-- lecture/écriture pour "authenticated" — volontairement. Même la
-- table `sequestres` (que le vendeur peut lire) n'expose jamais ce
-- code : seules les deux routes serveur dédiées
-- (/api/commandes/[id]/code-livraison pour l'acheteur,
-- /api/commandes/[id]/valider-code pour le vendeur) y accèdent, via
-- service_role. Si le code était lisible directement par le vendeur
-- via une requête Supabase classique, tout l'intérêt de la
-- vérification en main propre disparaîtrait.
-- ============================================================

create table if not exists codes_livraison (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null unique references commandes(id) on delete cascade,
  code text not null,
  tentatives int not null default 0,
  bloque boolean not null default false,
  date_creation timestamptz not null default now(),
  date_validation timestamptz
);

alter table codes_livraison enable row level security;
-- Aucune policy pour "authenticated" ou "public" = accès refusé par
-- défaut pour tout le monde sauf service_role (nos routes API).

create index if not exists idx_codes_livraison_commande on codes_livraison(commande_id);


-- ================================================================
-- ==== fichier: numeros_transfert.sql ====
-- ================================================================
-- ============================================================
-- NUMÉROS DE TRANSFERT (max 3 par utilisateur)
-- À exécuter après schema.sql et rls_policies.sql
-- ============================================================
-- Un utilisateur peut enregistrer jusqu'à 3 numéros sur lesquels il
-- peut recevoir des transferts internes (en plus de son numéro
-- principal `users.telephone`). Le transfert wallet-to-wallet
-- (app/api/wallet/transferer) ne fonctionne QUE vers un numéro
-- reconnu ici ou dans users.telephone — jamais vers un numéro
-- inconnu de la plateforme, puisque le solde n'est qu'une ligne dans
-- notre base (voir la clause CGU sur la nature du wallet) : un
-- transfert vers un numéro non enregistré n'aurait aucun compte
-- destinataire réel où atterrir.
-- ============================================================

create table if not exists numeros_transfert (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  numero text not null unique,
  pays text not null,
  date_ajout timestamptz not null default now()
);

alter table numeros_transfert enable row level security;

create policy "numeros_transfert_gestion_own"
on numeros_transfert for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Limite dure de 3 numéros par utilisateur, imposée en base — pas
-- seulement côté interface, pour qu'un appel direct à Supabase ne
-- puisse pas la contourner.
create or replace function public.limiter_numeros_transfert()
returns trigger
language plpgsql
security definer
as $$
begin
  if (select count(*) from numeros_transfert where user_id = new.user_id) >= 3 then
    raise exception 'Maximum 3 numéros enregistrés par compte.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_limiter_numeros_transfert on numeros_transfert;
create trigger trg_limiter_numeros_transfert
before insert on numeros_transfert
for each row execute function public.limiter_numeros_transfert();

create index if not exists idx_numeros_transfert_user on numeros_transfert(user_id);


-- ================================================================
-- ==== fichier: identite_tekca.sql ====
-- ================================================================
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


-- ================================================================
-- ==== fichier: fix_age_minimum.sql ====
-- ================================================================
-- ============================================================
-- DATE DE NAISSANCE OBLIGATOIRE (âge minimum 14 ans)
-- ------------------------------------------------------------
-- Capturée dans le même écran que la création du pseudo (étape
-- obligatoire pour TOUT nouveau compte, email comme Google/Facebook/
-- Apple — voir CreationPseudo.jsx et /api/identite/creer-pseudo).
-- Colonne nullable au niveau base (pour ne pas casser d'éventuels
-- comptes de test déjà créés sans cette info) ; le middleware bloque
-- déjà l'accès au reste du site tant que pseudo + date_naissance ne
-- sont pas renseignés, donc en pratique tout NOUVEAU compte en aura
-- toujours une.
-- ============================================================
alter table users add column if not exists date_naissance date;

alter table users add constraint users_age_minimum
  check (date_naissance is null or date_naissance <= (current_date - interval '14 years'));


-- ================================================================
-- ==== fichier: abonnements_commissions_messagerie.sql ====
-- ================================================================
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


-- ================================================================
-- ==== fichier: abonnements_v2_cashback_flash.sql ====
-- ================================================================
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


-- ================================================================
-- ==== fichier: migration_pin_journal_securite.sql ====
-- ================================================================
-- ============================================================
-- MIGRATION — à exécuter dans Supabase SQL Editor
-- ============================================================
-- CORRECTIF — le code de /api/securite/pin/verifier insère un
-- événement de type 'pin_echoue' à chaque code PIN incorrect, pour
-- que la limitation anti brute-force (5 échecs / 15 min) puisse les
-- compter. Mais l'enum type_evenement_securite (schema.sql) ne
-- contenait que 'connexion_echouee', 'pin_reinitialise' et
-- 'connexion_suspecte' — donc CET INSERT ÉCHOUAIT SILENCIEUSEMENT à
-- chaque mauvais code PIN (l'erreur n'était pas vérifiée dans le
-- code), et le compteur d'échecs restait bloqué à zéro pour
-- toujours : la protection anti brute-force sur le PIN n'a jamais
-- réellement fonctionné.
--
-- Ajoute aussi 'pin_modifie', utilisé par la nouvelle route
-- /api/securite/pin/modifier (changement de PIN) pour tracer les
-- changements réussis.
--
-- ALTER TYPE ... ADD VALUE ne peut pas être annulé dans la même
-- transaction sur Postgres < 12, donc à exécuter tel quel, une
-- instruction à la fois si l'éditeur SQL de Supabase le demande.

alter type type_evenement_securite add value if not exists 'pin_echoue';
alter type type_evenement_securite add value if not exists 'pin_modifie';


-- ================================================================
-- ==== fichier: migration_marche_avance.sql ====
-- ================================================================
-- ============================================================
-- MIGRATION — à exécuter dans Supabase SQL Editor
-- (fait suite à migration_pin_journal_securite.sql)
-- ============================================================

-- 1) Présence / disponibilité vendeur
-- "en_ligne" n'est pas stocké tel quel : c'est calculé côté
-- application à partir de derniere_activite (ex. "en ligne" si vu il
-- y a moins de 5 min) — évite un état à synchroniser en plus.
alter table vendeurs add column if not exists derniere_activite timestamptz;
alter table vendeurs add column if not exists en_pause boolean not null default false;
alter table vendeurs add column if not exists message_pause text;

-- 2) Modes de remise & zone de couverture (par produit — un vendeur
-- peut livrer différemment selon l'article : un jeu digital n'a pas
-- besoin de "main propre").
alter table produits add column if not exists modes_remise text[] not null default '{}';
alter table produits add column if not exists zone_couverture text;

-- 3) Signalement de boutique / produit — PAS BESOIN d'une nouvelle
-- table : `contacts_support` (motif_contact incluant 'vendeur') fait
-- déjà exactement ça, avec en plus le gel automatique du wallet visé
-- (voir /api/signalements/creer/route.js, déjà en place). Le bouton
-- "Signaler le vendeur" appelle cette route existante.

-- 4) Expiration des demandes vendeur en attente — évite de renotifier
-- l'équipe à chaque exécution du cron une fois l'alerte déjà envoyée.
alter table vendeurs add column if not exists alerte_expiration_envoyee boolean not null default false;

-- 5) Nouveau type de notification pour l'expiration d'une demande
-- vendeur (le signalement, lui, réutilise le type 'message' déjà
-- existant — voir /api/signalements/creer/route.js).
alter type notif_type add value if not exists 'demande_expiree';


-- ================================================================
-- ==== fichier: migration_index_performance.sql ====
-- ================================================================
-- ============================================================
-- MIGRATION — à exécuter dans Supabase SQL Editor
-- (fait suite à migration_pin_journal_securite.sql et
-- migration_marche_avance.sql)
-- ============================================================
-- Postgres n'indexe PAS automatiquement les clés étrangères (contrairement
-- à la clé primaire elle-même) — seules les colonnes uniques ou primaires
-- ont un index créé d'office. Sans ça, chaque `.eq("vendeur_id", ...)`,
-- `.eq("client_id", ...)`, etc. fait un scan complet de la table : sans
-- conséquence avec quelques dizaines de lignes, mais ça ralentit
-- progressivement à mesure que produits/commandes/messages s'accumulent.
-- "if not exists" partout : sans danger à ré-exécuter, et n'affecte aucune
-- donnée existante (un index ne fait qu'accélérer la lecture).

-- Vendeurs
create index if not exists idx_vendeurs_user on vendeurs(user_id);
create index if not exists idx_vendeurs_statut on vendeurs(statut);
create index if not exists idx_vendeurs_niveau on vendeurs(niveau);

-- Produits — la combinaison (vendeur_id, statut_validation) est la plus
-- fréquente (LeMarche, BoutiqueVendeur, ProfilVendeurMarche filtrent
-- toujours les deux ensemble), d'où l'index composite en plus des index
-- simples.
create index if not exists idx_produits_vendeur on produits(vendeur_id);
create index if not exists idx_produits_statut on produits(statut_validation);
create index if not exists idx_produits_categorie on produits(categorie_id);
create index if not exists idx_produits_vendeur_statut on produits(vendeur_id, statut_validation);
create index if not exists idx_variantes_produit on variantes_produits(produit_id);

-- Commandes
create index if not exists idx_commandes_client on commandes(client_id);
create index if not exists idx_commandes_vendeur on commandes(vendeur_id);
create index if not exists idx_commandes_produit on commandes(produit_id);

-- Avis
create index if not exists idx_avis_vendeur on avis(vendeur_id);
create index if not exists idx_avis_client on avis(client_id);

-- Messagerie
create index if not exists idx_conversations_client on conversations(client_id);
create index if not exists idx_conversations_vendeur on conversations(vendeur_id);
create index if not exists idx_messages_conversation on messages_chat(conversation_id);
create index if not exists idx_messages_expediteur on messages_chat(expediteur_id);

-- Wallet vendeur (recharges de jeu)
create index if not exists idx_wallets_recharge_vendeur on wallets_recharge(vendeur_id);
create index if not exists idx_depots_wallet_wallet on depots_wallet(wallet_id);

-- IA
create index if not exists idx_ia_abonnements_user on ia_abonnements(user_id);

-- Séquestre / livraison
create index if not exists idx_sequestres_commande on sequestres(commande_id);

-- Boosts / promotion
create index if not exists idx_boosts_vendeur on boosts(vendeur_id);
create index if not exists idx_boosts_produit on boosts(produit_id);
create index if not exists idx_comptes_promus_user on comptes_promus(user_id);
create index if not exists idx_boosts_compte_compte_promu on boosts_compte(compte_promu_id);
create index if not exists idx_produits_digitaux_vendeur on produits_digitaux(vendeur_id);

-- Tournois / Événements
create index if not exists idx_inscriptions_tournoi_tournoi on inscriptions_tournoi(tournoi_id);
create index if not exists idx_inscriptions_tournoi_joueur on inscriptions_tournoi(joueur_id);
create index if not exists idx_resultats_tournoi_tournoi on resultats_tournoi(tournoi_id);

-- Favoris
create index if not exists idx_favoris_user on favoris(user_id);
create index if not exists idx_favoris_produit on favoris(produit_id);

-- Support / signalements / retraits
create index if not exists idx_contacts_support_client on contacts_support(client_id);
create index if not exists idx_contacts_support_vendeur on contacts_support(vendeur_concerne_id);
create index if not exists idx_demandes_retrait_vendeur on demandes_retrait(vendeur_id);

-- Sécurité — important pour la limite anti brute-force du PIN
-- (compte les lignes user_id + type sur une fenêtre de 15 min à
-- chaque tentative) : sans index composite ici, cette vérification,
-- qui tourne à CHAQUE saisie de code, scanne toute la table.
create index if not exists idx_journal_securite_user_type on journal_securite(user_id, type, date_creation);

-- Codes promo
create index if not exists idx_codes_promo_categorie on codes_promo(categorie_id);

