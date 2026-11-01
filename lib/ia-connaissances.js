import supabaseAdmin from "./supabaseAdmin";

/*
  BASE DE CONNAISSANCES DE L'ASSISTANT TEKÇA.

  Trois sources :
  1. les notes ci-dessous (règles qui changent rarement — relues à partir du code du site :
     lib/commission.js, parcours d'inscription, paiements, séquestre…) ;
  2. la grille des abonnements, lue en direct dans la base (donc toujours à jour si l'équipe
     change un prix) ;
  3. la FAQ de l'équipe (table `faq`) : toute question/réponse ajoutée dans l'admin est
     automatiquement connue de l'assistant, sans toucher au code.

  IMPORTANT : l'assistant ne doit rien affirmer qui ne soit pas écrit ici. En cas de doute,
  il renvoie vers l'équipe (voir PROMPT dans app/api/ia/route.js).
*/
const NOTES_FIXES = `
## Qui est TEKÇA
TEKÇA (site officiel : tekca.store) est une marketplace panafricaine : accessoires et recharges gaming, vêtements, abonnements, tournois et événements, formations, marketing digital, assistant IA. Pays couverts : Congo-Brazzaville, Cameroun, Gabon, RD Congo, Côte d'Ivoire, Sénégal, Bénin, Togo, Burkina Faso, Mali, Niger, Guinée, Guinée-Bissau, Gambie, Ghana, Kenya, Nigeria, Ouganda, Tanzanie, Tchad. Langues du site : français, anglais, portugais, swahili, lingala, arabe. Le site peut s'installer comme une application (« Ajouter à l'écran d'accueil »).

## Créer un compte et se connecter
- Inscription gratuite avec une adresse email et un mot de passe d'au moins 8 caractères, ou par connexion sociale (Google, etc.).
- Un code PIN de sécurité est demandé pour les actions sensibles (paiements, retraits…). On ne communique jamais son PIN ni son mot de passe, même à l'équipe TEKÇA.
- Mot de passe oublié : sur la page de connexion, bouton « Mot de passe oublié ? », saisir son email ; si un compte existe, un lien arrive par email pour choisir un nouveau mot de passe.
- Pour supprimer son compte : Mon compte → Paramètres.

## Paiements, portefeuille et recharges
- Les paiements se font par Mobile Money (opérateurs disponibles selon le pays, par exemple MTN, Airtel) ou depuis le portefeuille TEKÇA.
- Recharger son portefeuille : Mon compte → Mon portefeuille → Recharger, saisir le montant, puis valider le paiement sur son téléphone. Le résultat est confirmé par l'opérateur, en général en moins de 2 minutes. Si le paiement est refusé, rien n'est ajouté au portefeuille ; les causes fréquentes sont un solde Mobile Money insuffisant, une validation non faite ou un délai dépassé.
- Retrait : depuis le portefeuille, vers un numéro Mobile Money. Si l'opérateur refuse le retrait, le montant est remboursé sur le portefeuille.
- Transfert entre utilisateurs TEKÇA : possible depuis le portefeuille ; des frais s'ajoutent à la charge de l'expéditeur (voir ci-dessous).
- L'assistant peut afficher gratuitement le solde, l'état des dernières commandes, les ventes (vendeurs), l'abonnement actuel et l'état des réclamations de la personne connectée : il suffit de le demander. Ces informations viennent directement du compte (elles ne sont pas transmises à l'IA).
- Réservé aux abonnés à partir du palier Basic (2 500 FCFA par mois) : la génération d'images et la création d'un brouillon d'annonce à partir d'une photo (bouton photo de l'assistant ; le vendeur relit et valide, puis l'annonce passe par la validation de l'équipe avec preuve d'achat).

## Achats sécurisés (séquestre) et livraison
- Le paiement d'une commande est conservé en séquestre : l'argent n'est versé au vendeur qu'après confirmation de la livraison. Des frais de « Protection Acheteur » peuvent s'appliquer et restent acquis à la plateforme.
- L'acheteur voit dans le suivi de sa commande un code de livraison de 6 caractères. Il ne le donne au vendeur qu'en personne, à la remise du colis : le vendeur saisit ce code et l'argent lui est alors versé. Le code n'est jamais montré au vendeur.
- Autres façons de libérer le paiement : l'acheteur clique sur « Colis reçu », ou le paiement est libéré automatiquement 48 heures après le délai prévu si aucune réclamation n'est ouverte.
- Après 4 saisies d'un mauvais code, le code est bloqué : seule l'équipe peut le débloquer.
- En cas de problème avec la commande, l'acheteur ouvre une réclamation (Mon compte → Mes réclamations) AVANT de donner son code ou de confirmer la réception.

## Devenir vendeur
- Deux niveaux : « Vendeur Indépendant » (particulier ou vendeur occasionnel : publication rapide d'annonces, vérification d'identité simplifiée avec nom, téléphone et pièce d'identité) et « Boutique & Entreprise Vérifiée » (commerçant ou entreprise : vitrine professionnelle avec badge « Vendeur Vérifié », vérification d'identité renforcée et vérification d'activité).
- Chaque produit nécessite une preuve réelle (photo de l'article ou facture) et une validation manuelle par l'équipe avant publication.
- Les fonds des ventes sont retirables après confirmation de la livraison.

## Abonnements TEKÇA (paliers) — avantages
- Gratuit (sans abonnement) : commission vendeur 10 %, frais de transfert 7 %, 10 produits publiables en même temps.
- Basic : commission vendeur 7 %, frais de transfert 5 %, 50 produits.
- Pro : commission vendeur 4 %, frais de transfert 3 %, 200 produits.
- Premium : commission vendeur 1 %, frais de transfert 1 %, produits illimités, et 3 % de cashback sur ses achats (crédité sur le portefeuille).
- Les paliers donnent aussi des avantages comme un badge, l'accès anticipé aux ventes flash et des litiges traités en priorité.

## Aide et contact
- Réclamation ou litige : Mon compte → Mes réclamations. L'équipe répond dans la discussion de la réclamation.
- Contact : page Contact du site, ou support@tekca.store.
`;

let cache = { t: 0, texte: "" };

function formaterTarifs(lignes) {
  const parPalier = {};
  for (const l of lignes || []) {
    (parPalier[l.palier] ||= []).push(`${l.duree_mois} mois : ${Number(l.prix_fcfa).toLocaleString("fr-FR")} FCFA`);
  }
  const noms = { basic: "Basic", pro: "Pro", premium: "Premium" };
  return Object.entries(parPalier)
    .map(([palier, liste]) => `- ${noms[palier] || palier} — ${liste.join(" ; ")}`)
    .join("\n");
}

export async function construireContexte() {
  if (cache.texte && Date.now() - cache.t < 5 * 60 * 1000) return cache.texte;

  let tarifs = "";
  let faq = "";
  try {
    const [{ data: grille }, { data: lignesFaq }] = await Promise.all([
      supabaseAdmin.from("grille_tarifs_abonnement").select("palier, duree_mois, prix_fcfa").order("palier").order("duree_mois"),
      supabaseAdmin.from("faq").select("question, reponse").order("ordre", { ascending: true }).limit(40),
    ]);
    tarifs = formaterTarifs(grille);
    faq = (lignesFaq || [])
      .map((f) => `Q : ${String(f.question).slice(0, 200)}\nR : ${String(f.reponse).slice(0, 500)}`)
      .join("\n\n");
  } catch (e) {
    console.error("base de connaissances IA — lecture partielle :", e);
  }

  const texte =
    NOTES_FIXES +
    (tarifs ? `\n## Prix des abonnements (en direct)\n${tarifs}\n` : "") +
    (faq ? `\n## Questions fréquentes validées par l'équipe\n${faq}\n` : "");

  cache = { t: Date.now(), texte };
  return texte;
}
