"use client";

import ContenuLegal from "./ContenuLegal";
import { useLanguage } from "../lib/i18n/LanguageContext";

export default function CGU() {
  const { t } = useLanguage();
  const sections = [
    { titre: t("legal.cgu.objet.titre"), paragraphes: [t("legal.cgu.objet.p1"), t("legal.cgu.objet.p2")] },
    {
      titre: t("legal.cgu.age.titre"),
      paragraphes: [t("legal.cgu.age.p1"), t("legal.cgu.age.p2"), t("legal.cgu.age.p3"), t("legal.cgu.age.p4")],
    },
    { titre: t("legal.cgu.vendeurs.titre"), paragraphes: [t("legal.cgu.vendeurs.p1"), t("legal.cgu.vendeurs.p2")] },
    {
      titre: t("legal.cgu.paiement.titre"),
      paragraphes: [
        t("legal.cgu.paiement.p1"), t("legal.cgu.paiement.p2"), t("legal.cgu.paiement.p3"),
        t("legal.cgu.paiement.p4"), t("legal.cgu.paiement.p5"),
      ],
    },
    { titre: t("legal.cgu.commande.titre"), paragraphes: [t("legal.cgu.commande.p1"), t("legal.cgu.commande.p2")] },
    {
      titre: t("legal.cgu.sequestre.titre"),
      paragraphes: [t("legal.cgu.sequestre.p1"), t("legal.cgu.sequestre.p2"), t("legal.cgu.sequestre.p3")],
    },
    {
      titre: t("legal.cgu.disponibilite.titre"),
      paragraphes: [
        t("legal.cgu.disponibilite.p1"), t("legal.cgu.disponibilite.p2"), t("legal.cgu.disponibilite.p3"),
        t("legal.cgu.disponibilite.p4"), t("legal.cgu.disponibilite.p5"), t("legal.cgu.disponibilite.p6"),
      ],
    },
    { titre: t("legal.cgu.retractation.titre"), paragraphes: [t("legal.cgu.retractation.p1")] },
    { titre: t("legal.cgu.interdits.titre"), paragraphes: [t("legal.cgu.interdits.p1")] },
    {
      titre: t("legal.cgu.litiges.titre"),
      paragraphes: [t("legal.cgu.litiges.p1"), t("legal.cgu.litiges.p2")],
    },
    { titre: t("legal.cgu.modification.titre"), paragraphes: [t("legal.cgu.modification.p1")] },
  ];

  return <ContenuLegal titre={t("legal.cgu.titrePage")} sections={sections} />;
}
