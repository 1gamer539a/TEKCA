"use client";

import ContenuLegal from "./ContenuLegal";
import { useLanguage } from "../lib/i18n/LanguageContext";

export default function MentionsLegales() {
  const { t } = useLanguage();
  const sections = [
    {
      titre: t("legal.mentions.editeur.titre"),
      paragraphes: [
        t("legal.mentions.editeur.p1"),
        t("legal.mentions.editeur.p2"),
        t("legal.mentions.editeur.p3"),
      ],
    },
    {
      titre: t("legal.mentions.hebergement.titre"),
      paragraphes: [t("legal.mentions.hebergement.p1")],
    },
    {
      titre: t("legal.mentions.nature.titre"),
      paragraphes: [t("legal.mentions.nature.p1"), t("legal.mentions.nature.p2")],
    },
    {
      titre: t("legal.mentions.propriete.titre"),
      paragraphes: [t("legal.mentions.propriete.p1"), t("legal.mentions.propriete.p2")],
    },
    {
      titre: t("legal.mentions.responsabilite.titre"),
      paragraphes: [t("legal.mentions.responsabilite.p1")],
    },
  ];

  return <ContenuLegal titre={t("legal.mentions.titrePage")} sections={sections} />;
}
