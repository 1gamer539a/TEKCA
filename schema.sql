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
  -- Note applicative : si pays != 'CG', seuls les types digitaux
  -- (recharge_jeu, abonnement_service) sont autorisés — pas de biens
  -- physiques (accessoire, vetement) en dehors du Congo, faute de
  -- logistique de livraison internationale. Vérifié côté backend.
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
