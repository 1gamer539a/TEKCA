import ContenuLegal from "../../components/ContenuLegal";

export const metadata = {
  title: "À propos de TEKÇA",
  description:
    "TEKÇA (tekca.store) : marketplace panafricaine multi-catégories avec paiement sécurisé par séquestre. Qui nous sommes, ce que nous proposons, où nous sommes présents.",
  alternates: { canonical: "/a-propos" },
};

export default function Page() {
  const sections = [
    {
      titre: "Qui est TEKÇA ?",
      paragraphes: [
        "TEKÇA (site officiel : tekca.store) est une marketplace panafricaine : « tout le e-commerce, un seul écosystème ».",
        "TEKÇA est un service indépendant. Ne pas le confondre avec d'autres plateformes ou applications au nom proche.",
      ],
    },
    {
      titre: "Ce que vous trouvez sur TEKÇA",
      paragraphes: [
        "Le Marché (annonces de vendeurs), accessoires, vêtements, recharges, abonnements, assistant IA, événements et tournois, formations et marketing digital.",
      ],
    },
    {
      titre: "Achats protégés",
      paragraphes: [
        "Les paiements passent par un système de séquestre : l'argent n'est versé au vendeur qu'après confirmation de la livraison. Les vendeurs sont vérifiés (identité) avant de pouvoir publier.",
      ],
    },
    {
      titre: "Pays couverts",
      paragraphes: [
        "Congo-Brazzaville, Cameroun, Gabon, RD Congo, Côte d'Ivoire, Sénégal, Bénin, Togo, Burkina Faso, Mali, Niger, Guinée, Guinée-Bissau, Gambie, Ghana, Kenya, Nigeria, Ouganda, Tanzanie et Tchad.",
      ],
    },
    {
      titre: "Nous retrouver",
      paragraphes: [
        "Site officiel : tekca.store — Instagram : @tekca3. Une question ? Utilisez la page Contact.",
      ],
    },
  ];
  return <ContenuLegal titre="À propos" sections={sections} />;
}
