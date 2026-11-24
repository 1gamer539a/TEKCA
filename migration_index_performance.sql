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
