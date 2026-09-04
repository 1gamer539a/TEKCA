import ContenuLegal from "./ContenuLegal";

const sections = [
  {
    titre: "Objet",
    paragraphes: [
      "Les présentes Conditions Générales d'Utilisation et de Vente (CGU/CGV) régissent l'accès et l'utilisation de la plateforme TEKÇA, marketplace mettant en relation vendeurs et acheteurs pour l'achat de produits gaming, de recharges numériques, d'abonnements de streaming et de services associés (tournois, formation, assistant IA).",
      "L'utilisation de TEKÇA implique l'acceptation pleine et entière des présentes CGU.",
    ],
  },
  {
    titre: "Âge minimum et comptes",
    paragraphes: [
      "L'inscription est réservée aux personnes âgées d'au moins 18 ans, ou disposant de l'autorisation d'un représentant légal. Chaque utilisateur est responsable de la confidentialité de ses identifiants et de toute activité effectuée depuis son compte.",
      "TEKÇA se réserve le droit de suspendre ou clôturer un compte en cas de fraude suspectée, de non-respect des présentes CGU, ou sur demande d'une autorité compétente.",
    ],
  },
  {
    titre: "Vendeurs tiers",
    paragraphes: [
      "Tout vendeur souhaitant proposer des produits sur TEKÇA doit créer un compte vendeur, soumis à validation par l'équipe TEKÇA. Le vendeur reste seul responsable de la conformité, de la description et de la disponibilité de ses produits, ainsi que du respect de la réglementation applicable à son activité.",
      "TEKÇA se réserve le droit de refuser, suspendre ou retirer une annonce ou un compte vendeur ne respectant pas ces conditions, notamment en cas de produit interdit, contrefait, ou de pratique commerciale trompeuse.",
    ],
  },
  {
    titre: "Nature des services de paiement et portefeuille virtuel",
    paragraphes: [
      "Rôle d'intermédiaire technique : TEKÇA agit exclusivement en tant qu'intermédiaire technique et marketplace de mise en relation. TEKÇA n'est ni une banque, ni un établissement de paiement, ni un émetteur de monnaie électronique au sens de la réglementation CEMAC / COBAC.",
      "Gestion des fonds par un tiers agréé : l'ensemble des opérations financières — recharges, encaissements, séquestres temporaires et retraits de fonds — sont exécutées et gérées exclusivement par notre partenaire de paiement, Sebpay (ou tout autre établissement partenaire ultérieurement désigné). Aucun fonds d'utilisateur n'est collecté ou conservé sur les comptes propres de TEKÇA.",
      "Affichage du solde (\"wallet\") : le solde affiché dans l'espace utilisateur de la plateforme constitue une représentation des crédits disponibles auprès du prestataire de paiement partenaire, utilisables pour les transactions internes au service. Il ne constitue pas un dépôt bancaire ni un compte de monnaie électronique détenu par TEKÇA.",
      "Mandat d'exécution : en effectuant une transaction sur la plateforme (achat, transfert à un autre utilisateur, retrait), l'utilisateur donne mandat à TEKÇA de transmettre à Sebpay les instructions d'exécution, de blocage temporaire (séquestre) ou de transfert de fonds correspondantes.",
    ],
  },
  {
    titre: "Commande et paiement",
    paragraphes: [
      "Les paiements sur TEKÇA s'effectuent via Airtel Money, MTN Mobile Money, GIMACPAY ou Sebpay selon la zone géographique de l'utilisateur. Le montant débité correspond au prix affiché au moment de la commande.",
      "L'utilisateur est seul responsable de l'exactitude du numéro de téléphone ou de l'identifiant saisi lors des opérations de recharge ou de retrait via Sebpay. TEKÇA ne pourra être tenue responsable des retards ou erreurs d'exécution imputables à l'opérateur télécom ou au réseau de paiement tiers.",
    ],
  },
  {
    titre: "Séquestre et livraison",
    paragraphes: [
      "Pour les commandes de produits physiques ou de comptes/services impliquant un vendeur tiers, les fonds versés par l'acheteur sont placés en séquestre temporaire chez Sebpay jusqu'à confirmation de la bonne livraison, puis TEKÇA transmet à Sebpay l'instruction de libération vers le vendeur (déduction faite le cas échéant d'une commission de service).",
      "Lors d'une transaction entre membres (achat de compte, diamants ou articles), TEKÇA agit comme tiers arbitre technique : les fonds restent sécurisés sur le compte marchand partenaire jusqu'à confirmation de la livraison par l'acheteur, ou jusqu'à validation par le support sous 24h à 48h en cas de litige. Une fois les fonds libérés vers le vendeur, la transaction est irréversible.",
      "En cas de litige (produit non reçu, non conforme, ou autre désaccord), l'acheteur ou le vendeur peut contacter le support TEKÇA via la page Contact ; TEKÇA peut alors suspendre la transmission de nouvelles instructions de transfert ou de retrait concernant le compte du vendeur concerné, le temps de l'instruction du dossier.",
    ],
  },
  {
    titre: "Rétractation et remboursement",
    paragraphes: [
      "Les conditions de retour et de remboursement peuvent varier selon la nature du produit (un bien physique n'est pas traité comme une recharge numérique ou un abonnement déjà activé, généralement non remboursables une fois livrés). Les conditions spécifiques à chaque produit sont précisées sur sa fiche ou communiquées par le vendeur.",
    ],
  },
  {
    titre: "Contenus et comportements interdits",
    paragraphes: [
      "Sont interdits sur TEKÇA : la vente de produits illicites ou contrefaits, le contournement du wallet/séquestre pour des transactions hors plateforme, le harcèlement d'autres utilisateurs, et toute tentative de fraude au paiement ou d'usurpation d'identité.",
    ],
  },
  {
    titre: "Responsabilité et litiges",
    paragraphes: [
      "TEKÇA agit en tant qu'intermédiaire technique entre acheteurs et vendeurs et ne saurait être tenue responsable des manquements d'un vendeur tiers à ses propres obligations, sous réserve des dispositions légales impératives applicables.",
      "Les présentes CGU sont soumises au droit de la République du Congo. Tout litige sera, à défaut de résolution amiable, porté devant les juridictions compétentes de la République du Congo.",
    ],
  },
  {
    titre: "Modification des CGU",
    paragraphes: [
      "TEKÇA peut modifier les présentes CGU à tout moment ; les utilisateurs seront informés de tout changement substantiel. La poursuite de l'utilisation de la plateforme après modification vaut acceptation des nouvelles conditions.",
    ],
  },
];

export default function CGU() {
  return <ContenuLegal titre="Conditions générales" sections={sections} />;
}
