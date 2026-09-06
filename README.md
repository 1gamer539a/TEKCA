# TEKÇA — Marketplace Gaming (Phase 1)

Projet Next.js (App Router) assemblé à partir de tous les composants validés.

## Installation

```bash
npm install
```

## Lancer en développement

```bash
npm run dev
```

Puis ouvrir http://localhost:3000

## Structure des routes

| Route | Page |
|---|---|
| `/` | Hub d'accueil |
| `/produit/[id]` | Fiche produit (recharge / vêtement / accessoire) |
| `/produit/nouveau` | Formulaire d'ajout de produit (vendeur) |
| `/vendeur/[slug]` | Boutique d'un revendeur officiel |
| `/marche` | Le Marché — annonces des vendeurs simples |
| `/marche/vendeur/[id]` | Profil public d'un vendeur du Marché |
| `/dashboard` | Dashboard vendeur |
| `/vendre` | Devenir vendeur (Marché ou Revendeur officiel) |
| `/panier` | Panier / Checkout |
| `/commandes` | Historique des commandes |
| `/tournois` | Liste des tournois |
| `/tournois/[id]` | Détail tournoi + inscription |
| `/formation/createurs` | Formation Créateurs de contenu |
| `/formation/entrepreneurs` | Formation Entrepreneurs (académie) |
| `/marketing-digital` | Marketing Digital (livres, ebooks, templates) |
| `/promotion` | Promotion de comptes réseaux sociaux |
| `/securite/pin` | Création / saisie du code PIN |
| `/commandes/[id]/suivi` | Suivi de livraison + séquestre |
| `/favoris` | Favoris / Wishlist |
| `/messages` | Liste des conversations |
| `/messages/[id]` | Fil de discussion (vendeur ou IA) |
| `/ia` | IA Assistant (plein écran) |
| `/notifications` | Centre de notifications |
| `/recherche` | Recherche |
| `/categories` | Toutes les catégories |
| `/contact` | Nous contacter (support) |
| `/admin/signalements` | Signalements — vue équipe |
| `/auth` | Connexion / Inscription |
| `/compte` | Profil et paramètres |

Le bouton IA flottant (`components/BoutonIAFlottant.jsx`) est monté une seule fois
dans `app/layout.jsx` via `LayoutClient.jsx` → `LayoutRacine.jsx`, donc il apparaît
sur **toutes** les pages automatiquement.

## Base de données

Le schéma complet est dans `schema.sql` — à exécuter dans l'éditeur SQL de Supabase.
Couvre : comptes, vendeurs (2 niveaux), produits, variantes, commandes, avis, chat
interne, wallets de recharges, séquestre des paiements, boosts, favoris, notifications,
contacts support, tournois, formation, marketing digital, promotion de comptes,
buckets de stockage (photos produits + preuves).

## Configuration Supabase (obligatoire pour que le site fonctionne réellement)

1. Crée un projet sur https://supabase.com
2. Crée un fichier `.env.local` à la racine et renseigne :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (les deux se trouvent dans Project Settings → API)
3. Ouvre l'éditeur SQL de Supabase et exécute dans l'ordre : `schema.sql`,
   puis `rls_policies.sql` (sécurité au niveau des lignes), puis
   `auth_setup.sql` (création automatique du profil à l'inscription +
   support du rate limiting de connexion), puis `code_livraison.sql`
   (code à 6 chiffres de confirmation de livraison physique), puis
   `contraintes_pays.sql` (limite les pays aux 19 pays couverts par
   Sebpay), puis `numeros_transfert.sql` (jusqu'à 3 numéros par
   compte pour recevoir des transferts internes), puis
   `abonnements_commissions_messagerie.sql` (paliers d'abonnement,
   nouveau barème de commission acheteur+vendeur, blocage de compte),
   puis `identite_tekca.sql` (identifiant + pseudo permanents,
   renouvellement automatique des abonnements), puis
   `abonnements_v2_cashback_flash.sql` (refonte à 4 paliers
   Gratuit/Basic/Pro/Premium, cashback acheteur, limite de produits
   par palier, frais de transfert, ventes flash)
4. Active l'authentification (Authentication → Providers) : Email, Google, Facebook
5. Dans Authentication → Settings, réduis la durée de l'access token
   (ex: 30-60 min au lieu du défaut) vu que la plateforme gère de
   l'argent réel (wallet)
6. `npm install` (ajoute la dépendance `@supabase/ssr` utilisée par
   `middleware.js` pour la vérification de session côté serveur)
7. Sur Vercel, ajoute la variable d'environnement `CRON_SECRET`
   (chaîne aléatoire longue) — Vercel Cron l'utilise automatiquement
   pour authentifier ses appels quotidiens vers
   `/api/cron/rappels-abonnement` (planifié dans `vercel.json`,
   9h UTC par défaut — ajuste l'heure dans `vercel.json` si besoin)
5. Le formulaire d'ajout de produit (`/produit/nouveau`) est déjà branché à Supabase :
   il uploade les photos dans le bucket `produits`, la preuve dans `preuves`, et
   insère la ligne dans la table `produits` avec le statut `en_attente`.

## Configuration IA (ChatGPT)

1. Crée une clé API sur https://platform.openai.com/api-keys
2. Ajoute-la dans `.env.local` sous `OPENAI_API_KEY` (jamais de préfixe `NEXT_PUBLIC_`
   sur cette variable — elle doit rester côté serveur uniquement)
3. `components/IAAssistant.jsx` appelle `/api/ia` (route serveur dans
   `app/api/ia/route.js`), qui appelle ChatGPT (`gpt-4o-mini`) — la clé n'est
   jamais exposée au navigateur
4. Le suivi des générations lourdes (limite 3/jour en free) est déjà branché sur
   la table `ia_generations`, et le forfait actif sur `ia_abonnements`

## Configuration Wallet (Sebpay)

1. Renseigne dans `.env.local` : `SEBPAY_SECRET_KEY`, `SEBPAY_BASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY` — **aucune de ces variables ne doit avoir le
   préfixe `NEXT_PUBLIC_`**, elles ne sont utilisées que côté serveur
   (`lib/sebpay.js`, `lib/supabaseAdmin.js`, routes `app/api/wallet/*`)
2. `lib/sebpay.js` contient des URLs d'endpoints **placeholder** — à remplacer
   par les vraies routes une fois la documentation technique Sebpay fournie
3. Configure l'URL webhook dans le dashboard Sebpay :
   `https://tondomaine.com/api/wallet/webhook-sebpay` — c'est ce qui crédite
   réellement le wallet après confirmation d'un paiement de recharge
4. Le solde n'est jamais fait confiance côté client : chaque retrait/transfert
   revérifie le solde réel en base avant d'agir (`app/api/wallet/retirer`,
   `app/api/wallet/transferer`)
5. Retraits ≥ 15 000 FCFA bloqués tant que `users.piece_identite_verifiee`
   n'est pas `true`

## Prochaines étapes techniques

1. ~~Connecter Supabase~~ — fait sur : formulaire produit, Le Marché, Dashboard
   vendeur, Messages, Fil de discussion (temps réel), Notifications (temps réel),
   Historique commandes, IA Assistant (ChatGPT), Favoris, Liste Tournois, HomePage
   (produits tendances), Boutique vendeur (`/vendeur/[slug]`), Salle de surveillance
   admin (`/admin/signalements` — signalements, chats, validation produits, gestion
   vendeurs). Reste à faire : bouton favori réel sur FicheProduit (actuellement
   composant de démo non lié à un vrai produit), page panier/checkout (reste en
   données d'exemple), détail tournoi (inscription).
2. Brancher l'API de paiement (Sebpay / CinetPay) selon le prestataire choisi
   par chaque vendeur.
3. Brancher l'API Claude (ou autre) pour l'agent IA dans `components/IAAssistant.jsx`
   et `components/FilDiscussion.jsx`.
4. Mettre en place le routing des sous-domaines vendeurs (`kivu-gaming.plateforme.com`
   → `/vendeur/kivu-gaming`) via la config Vercel / middleware Next.js.
5. Déployer sur Vercel (les variables d'environnement `.env.local` doivent être
   ajoutées dans les Project Settings de Vercel).
