import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import fr from "./locales/fr.json";
import en from "./locales/en.json";
import pt from "./locales/pt.json";
import ln from "./locales/ln.json";
import sw from "./locales/sw.json";
import ar from "./locales/ar.json";

/*
  6 langues supportées, français par défaut. pt/ln/sw/ar n'ont pas
  encore de traductions (fichiers vides) — fallbackLng: "fr" prend le
  relais automatiquement pour toute clé manquante, exactement comme
  le faisait l'ancien LanguageContext maison. Rien ne casse tant que
  ces langues ne sont pas traduites ; on peut les remplir
  progressivement, namespace par namespace, plus tard.

  keySeparator/nsSeparator par défaut (".") + interpolation en
  {{variable}} : comportement identique à l'ancien système, donc
  aucun appel t("wallet.xxx", { montant }) existant à modifier.
*/
export const LANGUES_SUPPORTEES = ["fr", "en", "pt", "ln", "sw", "ar"];
export const LANGUES_RTL = ["ar"];

if (!i18next.isInitialized) {
  i18next.use(initReactI18next).init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      pt: { translation: pt },
      ln: { translation: ln },
      sw: { translation: sw },
      ar: { translation: ar },
    },
    lng: "fr",
    fallbackLng: "fr",
    supportedLngs: LANGUES_SUPPORTEES,
    interpolation: { escapeValue: false }, // React échappe déjà lui-même
    react: { useSuspense: false }, // évite un flash de suspense au premier rendu SSR/hydratation
  });
}

export default i18next;
