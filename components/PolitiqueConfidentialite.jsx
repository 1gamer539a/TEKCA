"use client";

import ContenuLegal from "./ContenuLegal";
import { useLanguage } from "../lib/i18n/LanguageContext";

export default function PolitiqueConfidentialite() {
  const { t } = useLanguage();
  const sections = [
    { titre: t("legal.confidentialite.collecte.titre"), paragraphes: [t("legal.confidentialite.collecte.p1"), t("legal.confidentialite.collecte.p2"), t("legal.confidentialite.collecte.p3")] },
    { titre: t("legal.confidentialite.localisation.titre"), paragraphes: [t("legal.confidentialite.localisation.p1"), t("legal.confidentialite.localisation.p2"), t("legal.confidentialite.localisation.p3")] },
    { titre: t("legal.confidentialite.utilisation.titre"), paragraphes: [t("legal.confidentialite.utilisation.p1"), t("legal.confidentialite.utilisation.p2")] },
    { titre: t("legal.confidentialite.partage.titre"), paragraphes: [t("legal.confidentialite.partage.p1"), t("legal.confidentialite.partage.p2"), t("legal.confidentialite.partage.p3")] },
    { titre: t("legal.confidentialite.securite.titre"), paragraphes: [t("legal.confidentialite.securite.p1")] },
    { titre: t("legal.confidentialite.conservation.titre"), paragraphes: [t("legal.confidentialite.conservation.p1")] },
    { titre: t("legal.confidentialite.droits.titre"), paragraphes: [t("legal.confidentialite.droits.p1")] },
    { titre: t("legal.confidentialite.cookies.titre"), paragraphes: [t("legal.confidentialite.cookies.p1")] },
    { titre: t("legal.confidentialite.mineurs.titre"), paragraphes: [t("legal.confidentialite.mineurs.p1")] },
    { titre: t("legal.confidentialite.contact.titre"), paragraphes: [t("legal.confidentialite.contact.p1")] },
  ];

  return <ContenuLegal titre={t("legal.confidentialite.titrePage")} sections={sections} />;
}
