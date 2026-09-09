import ContenuLegal from "./ContenuLegal";

const sections = [
  {
    titre: "Éditeur du site",
    paragraphes: [
      "Le site et l'application TEKÇA sont édités par [NOM DE L'ENTREPRISE / STATUT JURIDIQUE — ex: TEKÇA SARL], immatriculée au Registre du Commerce et du Crédit Mobilier (RCCM) sous le numéro [NUMÉRO RCCM], au capital de [MONTANT] FCFA, dont le siège social est situé [ADRESSE COMPLÈTE], République du Congo.",
      "Numéro d'Identifiant Unique (NIU) : [NUMÉRO NIU].",
      "Directeur de la publication : [NOM DU RESPONSABLE].",
      "Contact : [EMAIL DE CONTACT] — [NUMÉRO DE TÉLÉPHONE].",
    ],
  },
  {
    titre: "Hébergement",
    paragraphes: [
      "L'application est hébergée par Vercel Inc. (déploiement) et Supabase Inc. (base de données et authentification). Ces prestataires peuvent héberger les données en dehors du territoire de la République du Congo — voir la Politique de confidentialité pour le détail des transferts de données.",
    ],
  },
  {
    titre: "Nature du site",
    paragraphes: [
      "TEKÇA est une marketplace mettant en relation des vendeurs tiers indépendants et des acheteurs. TEKÇA n'est pas elle-même vendeuse des produits proposés par les vendeurs de la plateforme, sauf mention contraire explicite sur une fiche produit. Chaque vendeur reste seul responsable de l'exactitude des informations de ses annonces, de la conformité des produits vendus et du respect de ses obligations légales.",
    ],
  },
  {
    titre: "Propriété intellectuelle",
    paragraphes: [
      "La marque TEKÇA, le logo, la charte graphique et les éléments techniques de la plateforme sont la propriété de [NOM DE L'ENTREPRISE] ou de ses partenaires. Toute reproduction non autorisée est interdite.",
      "Les contenus publiés par les vendeurs (photos, descriptions de produits) restent leur propriété ; en les publiant sur TEKÇA, ils accordent à la plateforme le droit de les afficher dans le cadre normal du service.",
    ],
  },
  {
    titre: "Responsabilité",
    paragraphes: [
      "TEKÇA met tout en œuvre pour assurer la disponibilité et l'exactitude des informations du site, sans garantie de résultat. TEKÇA ne saurait être tenue responsable des dommages résultant de l'utilisation du site, d'une interruption de service, ou d'un litige entre un acheteur et un vendeur tiers, sous réserve des obligations légales impératives applicables.",
    ],
  },
];

export default function MentionsLegales() {
  return <ContenuLegal titre="Mentions légales" sections={sections} />;
}
