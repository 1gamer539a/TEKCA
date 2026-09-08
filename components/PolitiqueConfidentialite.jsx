import ContenuLegal from "./ContenuLegal";

const sections = [
  {
    titre: "Données collectées",
    paragraphes: [
      "TEKÇA collecte les données que tu nous fournis directement : nom, email, numéro de téléphone, et, pour la vérification d'identité liée au wallet, une pièce d'identité et les informations associées.",
      "Sont également collectées automatiquement les données liées à l'utilisation du service : historique de commandes, transactions du wallet, messages échangés avec un vendeur ou le support, et informations techniques de connexion (adresse IP, notamment pour la protection contre les tentatives de connexion frauduleuses).",
    ],
  },
  {
    titre: "Utilisation des données",
    paragraphes: [
      "Ces données servent à : créer et sécuriser ton compte, traiter tes commandes et paiements, prévenir la fraude (limitation des tentatives de connexion, vérification d'identité au-delà de certains seuils de retrait), assurer le support client, et améliorer le service.",
      "Si tu utilises l'assistant IA intégré à TEKÇA, le contenu de tes échanges avec l'assistant est transmis à notre fournisseur d'intelligence artificielle (OpenAI) pour générer une réponse, dans les conditions décrites ci-dessous.",
    ],
  },
  {
    titre: "Partage des données",
    paragraphes: [
      "Tes données ne sont jamais vendues. Elles peuvent être partagées avec : nos prestataires techniques (Supabase pour l'hébergement des données, Vercel pour l'hébergement de l'application), nos prestataires de paiement (Sebpay, et les opérateurs mobile money concernés) dans la stricte mesure nécessaire au traitement d'un paiement, et OpenAI pour le fonctionnement de l'assistant IA.",
      "Ces prestataires peuvent héberger ou traiter les données en dehors de la République du Congo. Nous veillons à ne travailler qu'avec des prestataires offrant des garanties de sécurité appropriées.",
    ],
  },
  {
    titre: "Sécurité",
    paragraphes: [
      "L'accès aux données est protégé par des règles de sécurité au niveau base de données (chaque utilisateur ne peut lire que ses propres données), par le chiffrement des communications, et par un système de limitation des tentatives de connexion. Les mots de passe sont hachés et ne sont jamais stockés ni consultables en clair, y compris par notre équipe.",
    ],
  },
  {
    titre: "Conservation",
    paragraphes: [
      "Les données sont conservées le temps nécessaire à la fourniture du service et à nos obligations légales (notamment comptables et de lutte contre la fraude). Les pièces d'identité fournies pour la vérification du wallet sont conservées selon les délais requis par nos obligations de prévention de la fraude, puis supprimées.",
    ],
  },
  {
    titre: "Tes droits",
    paragraphes: [
      "Tu peux demander l'accès, la rectification ou la suppression de tes données personnelles en nous contactant via la page Contact. Certaines données (historique de transactions notamment) peuvent devoir être conservées malgré une demande de suppression, pour répondre à nos obligations légales.",
    ],
  },
  {
    titre: "Cookies",
    paragraphes: [
      "TEKÇA utilise des cookies techniques nécessaires au fonctionnement du site (maintien de ta session de connexion). Aucun cookie publicitaire tiers n'est utilisé à ce stade.",
    ],
  },
  {
    titre: "Mineurs",
    paragraphes: [
      "TEKÇA n'est pas destinée aux personnes de moins de 18 ans. Si nous prenons connaissance qu'un compte a été créé par un mineur sans autorisation d'un représentant légal, ce compte pourra être suspendu.",
    ],
  },
  {
    titre: "Contact",
    paragraphes: [
      "Pour toute question relative à cette politique ou à tes données personnelles : [EMAIL DE CONTACT DÉDIÉ AUX DONNÉES PERSONNELLES].",
    ],
  },
];

export default function PolitiqueConfidentialite() {
  return <ContenuLegal titre="Confidentialité" sections={sections} />;
}
