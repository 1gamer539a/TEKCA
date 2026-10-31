# Guide — Assistant IA, mode hors connexion, écran de démarrage

## 1. Assistant IA (étape 1 : support client)

**Ce qu'il fait** : répond sur TEKÇA (inscription, abonnements, paiements, séquestre, devenir vendeur…) à partir de
`lib/ia-connaissances.js`, de la grille des abonnements (lue en direct dans la base) et de la FAQ de l'équipe (table `faq`).
Il génère toujours du contenu gaming. Il peut passer la main à l'équipe : bouton « Parler à l'équipe » → la conversation devient
une réclamation (Mon compte → Mes réclamations) traitée par le rôle « Relation client ».
**Cette version ne voit AUCUNE donnée personnelle** (ni solde, ni commandes) : c'est l'étape 2.

**Mise en route (5 minutes)**
1. https://aistudio.google.com → *Get API key* → créer une clé.
2. Vercel → Settings → Environment Variables : `GEMINI_API_KEY` = la clé (jamais de préfixe NEXT_PUBLIC_). Redéployer.
3. Optionnel : `IA_FOURNISSEUR` (`gemini` ou `openai`), `IA_MODELE_GEMINI` (défaut `gemini-2.5-flash`), `IA_MODELE_OPENAI` (défaut `gpt-4o-mini`).
   Si `GEMINI_API_KEY` n'existe pas mais `OPENAI_API_KEY` oui, c'est OpenAI qui répond.

**Gratuit ou payant** : le palier gratuit de Gemini sert à développer et tester avec de FAUSSES données. Google y utilise les messages pour
améliorer ses produits ; passez au palier payant (compte de facturation + prépaiement minimal) avant le lancement public.
Vérifiez les prix actuels sur la page tarifaire du fournisseur et fixez un plafond mensuel dans son tableau de bord.

**Limites** : 20 messages / 10 min et 150 / jour par utilisateur (compteurs en base). Les messages sont journalisés dans `logs_ia`
(visibles par le rôle Technique) pour améliorer la FAQ. Pensez à le mentionner dans la politique de confidentialité.

**Améliorer les réponses** : ajoutez des questions/réponses dans la table `faq` (admin) — l'assistant les connaît au bout de 5 minutes au plus.
Les règles fixes se modifient dans `lib/ia-connaissances.js`.

## 2. Mode hors connexion (PWA)

Le service worker (`public/sw.js`, v2) est maintenant enregistré pour tout le monde.
**Fonctionne sans réseau** : ouverture de l'application, pages déjà visitées, images déjà vues, catalogue (produits, catégories, boutiques, FAQ),
favoris et commandes déjà consultés (copie rangée PAR utilisateur, vidée à la déconnexion). Un bandeau indique « hors connexion » puis « connexion retrouvée ».
**Jamais hors connexion** (volontaire) : paiements, recharges, retraits, transferts, commandes, messages — le site répond tout de suite par un message clair.
Page jamais visitée + pas de réseau : page `/hors-ligne.html`.

**Tester** : Chrome → F12 → Application → Service Workers (doit afficher *activated*) ; onglet Réseau → *Offline* ; recharger.
**iPhone** : installer l'application (Partager → Sur l'écran d'accueil). Safari peut purger les données d'un site non installé après ~7 jours d'inactivité.

## 3. Écran de démarrage

Logo TEKÇA + « Bienvenue sur TEKÇA » mot par mot (6 langues) ; pendant ce temps, le site prépare la session, le nom, le pseudo et le rôle,
et précharge les pages principales (+ la Salle de surveillance pour l'équipe). Affiché une fois par session de 30 minutes (cookie `tekca_demarre`),
jamais pour les robots d'indexation, raccourci si l'appareil réduit les animations. Aucune donnée financière n'est stockée par le préchargement.
Réglages : durées dans `components/EcranDemarrage.jsx` (`DUREE_MIN_MS`, `DUREE_MAX_MS`).
