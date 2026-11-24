# Audit de sécurité TEKÇA — 24/10/2026

Audit ciblé du code fourni (middleware, routes `/api`, administration, stockage, RLS).
Rien n'a pu être exécuté ici (pas de base ni de build) : **teste en préproduction avant de
déployer** (voir « Mise en service » en bas).

## Corrigé dans cette version

| # | Gravité | Problème | Correction |
|---|---|---|---|
| 1 | **Critique** | Le bucket `preuves` (pièces d'identité, justificatifs) était **public** : n'importe qui avec l'URL voyait une pièce d'identité, sans connexion. | `migration_securite_preuves_privees.sql` : bucket privé, lecture réservée au propriétaire et à l'équipe concernée. L'admin ouvre les documents par URL signée de 5 min (`ApercuPreuve.jsx`, `lib/preuves.js`). |
| 2 | **Élevée** | Tout membre `equipe` voyait **tout** (finances, identités, utilisateurs, wallets) : la règle RLS `is_admin()` valait « admin OU équipe », et l'interface lit les tables directement. | `migration_roles_equipe.sql` : permissions par domaine appliquées **dans la base** (RLS, écriture plus restreinte que la lecture sur les tables partagées) + dans chaque route `/api/admin/*`. |
| 3 | **Élevée** | **Double clic = argent mal compté** : `abonnements/souscrire` et `vendeur/recharger-jeu` lisaient le solde puis l'écrivaient séparément. Deux clics rapides créaient deux abonnements en ne payant qu'une fois, ou créditaient deux fois le wallet d'un jeu en ne débitant qu'une fois. Le renouvellement automatique (cron) avait la même faille si le job était relancé. | Débit atomique (`debiter_wallet_atomique`) partout ; crédit du wallet-jeu protégé avec remboursement si une autre opération est passée avant ; l'abonnement échu est « réclamé » atomiquement par le cron ; index unique « un seul abonnement actif par utilisateur ». |
| 4 | **Moyenne** | **Aucune protection générale contre le double envoi** (commandes, transferts, retraits, recharges, achats, signalements, messages, actions admin). | Trois couches : (a) navigateur — `lib/fetch-anti-doublon.js` ne laisse partir qu'une requête d'écriture identique (appels `/api` et écritures Supabase) ; (b) serveur — `lib/anti-doublon.js` refuse (409) une requête identique reçue dans les 5 à 30 s, même depuis un autre onglet/appareil ; (c) limites de débit sur messages, transferts, réponses support, signalements. SQL : `migration_anti_doublon_limites.sql`. |
| 5 | **Moyenne** | Redirection ouverte dans `/auth/callback?suite=` (ex. `?suite=@site-pirate.com` renvoyait vers un site tiers après une vraie connexion Google : utile pour l'hameçonnage). | `suite` n'accepte plus qu'un chemin interne. |
| 6 | **Moyenne** | Aucun en-tête de sécurité HTTP (pas de CSP, HSTS, anti-iframe…). | `next.config.js` : HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (géolocalisation autorisée car utilisée par la recherche). **CSP à nonces** (`lib/csp.js` + `middleware.js`) : seuls les scripts portant le code secret de la page s'exécutent. Mode réglé par `CSP_MODE` (voir ci-dessous). |
| 7 | **Moyenne** | Même défaut que le bug « Aucun profil vendeur trouvé » dans 4 routes serveur (`vendeur/pause`, `vendeur/recharger-jeu`, `messages/demarrer-vendeur`) : `.single()` échoue dès qu'un compte a 2 lignes `vendeurs`. | Helper `lib/vendeur-serveur.js` (boutique validée en priorité, sinon la plus récente). |
| 8 | Faible | L'alerte « demande vendeur expirée » partait à toute l'équipe. | Envoyée aux admins + au domaine `kyc` seulement. |
| 9 | Faible | Ancienne table d'accès admin « email + code partagé » (`admin_acces_sessions`), plus utilisée. | Supprimée par `migration_securite_preuves_privees.sql`. |
| 11 | **Moyenne** | **Double remboursement possible** : quand SebPay renvoyait deux fois un webhook « retrait refusé » (retry réseau), les deux appels pouvaient rembourser le portefeuille. | Le webhook « réclame » désormais la transaction de façon atomique avant de rembourser ; si le remboursement échoue, la transaction repasse « en attente » pour qu'un nouvel essai puisse le refaire. |
| 12 | Faible | Adresse de contact `support@tekca.com` (domaine non possédé) dans les pages légales, 6 langues : des courriels de clients pouvaient partir vers un tiers. | Remplacée par `support@tekca.store` (et exemples d'adresses de boutique en `tekca.store`). |
| 10 | Info | Pas de trace des changements de rôles d'équipe. | Journalisés (`journal_securite`), visibles et exportables en CSV dans l'onglet Équipe. |

## Déjà bien fait (constaté)
Signature HMAC du webhook Sebpay (comparaison à temps constant) ; crédit de wallet atomique et
idempotent ; routes cron protégées par `CRON_SECRET` ; session vérifiée côté serveur
(`getUser`) ; 2FA prise en compte ; PIN vérifié côté serveur avec blocage après 5 essais ;
limitation des tentatives de connexion ; vérification de propriété (client/vendeur) dans les
routes de commandes, wallet, messages, support ; message de connexion générique (pas
d'énumération de comptes) ; `ipClient` lit d'abord `x-vercel-forwarded-for` (non falsifiable sur Vercel).

## Reste à traiter
1. **2FA obligatoire pour l'équipe** : le code est prêt (`EQUIPE_2FA_OBLIGATOIRE=1`) mais désactivé par défaut. Active-le quand chaque membre, toi compris, a activé sa 2FA — sinon il serait bloqué.
2. **Rotation des secrets** si le zip du projet a circulé : clés Supabase `service_role`, Sebpay, `CRON_SECRET` (aucun secret n'est présent dans le zip : aucun `.env`).
3. **Verrouillage de connexion par email** : le système actuel bloque un email après trop d'échecs ; un tiers peut donc, en théorie, provoquer ce blocage pour embêter quelqu'un. Les routes concernées sont maintenant limitées par adresse IP, ce qui réduit le risque sans le supprimer.

## Mise en service (dans l'ordre)
1. Supabase → SQL Editor, dans cet ordre : `migration_roles_equipe.sql`, `migration_anti_doublon_limites.sql`, `migration_securite_preuves_privees.sql`, `migration_suivi_transactions.sql`.
2. Vérifier : `select tablename, policyname from pg_policies where schemaname='public' and (qual ~ 'is_admin' or with_check ~ 'is_admin');` → **0 ligne**.
3. Vercel → variables d'environnement : `ADMIN_PRINCIPAL_EMAIL` = ton email admin (verrou en plus du rôle).
4. Déployer **avec `CSP_MODE` absent ou `report-only`** (défaut) : la CSP signale dans la console du navigateur (F12 → Console, messages « Content Security Policy ») ce qu'elle bloquerait, sans rien casser. Parcourir le site (accueil, connexion Google, panier, paiement, admin) ; s'il n'y a aucun message, passer `CSP_MODE=enforce` sur Vercel et redéployer.
5. Tester avec un compte `equipe` de test : il ne doit voir que ses onglets.
   Tester aussi le double clic : cliquer très vite deux fois sur « Payer » / « S'abonner » → une seule opération, un seul débit.
6. Si, en mode `enforce`, quelque chose est bloqué : repasser `CSP_MODE=report-only` (retour immédiat à la normale), puis ajouter le domaine concerné dans `lib/csp.js`.

Note : la CSP à nonces rend toutes les pages « dynamiques » (générées à chaque visite plutôt que préparées à l'avance). Le site peut être très légèrement plus lent à répondre ; la plupart de vos pages dépendent déjà de la connexion, donc l'effet est faible.
