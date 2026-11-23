"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import i18next, { LANGUES_SUPPORTEES, LANGUES_RTL } from "./i18n";

const LanguageContext = createContext(null);

const CLE_STOCKAGE = "takca-langue";

/*
  CORRECTIF — remplace l'ancien système maison (dictionnaire.js +
  logique de repli écrite à la main) par i18next/react-i18next, tout
  en gardant EXACTEMENT la même interface publique (useLanguage() ->
  { langue, setLangue, t }) pour que les composants qui l'utilisaient
  déjà n'aient rien à changer.

  6 langues : fr (défaut), en, pt, ln, sw, ar — voir lib/i18n/i18n.js
  pour les ressources. ar est RTL : document.dir bascule
  automatiquement en "rtl" quand cette langue est active.
*/
export function LanguageProvider({ children }) {
  const [langue, setLangueState] = useState("fr");

  const appliquerDirection = (code) => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = code;
    document.documentElement.dir = LANGUES_RTL.includes(code) ? "rtl" : "ltr";
  };

  // Lit la préférence sauvegardée une fois le composant monté côté
  // navigateur (localStorage n'existe pas côté serveur en SSR).
  useEffect(() => {
    try {
      const sauvegarde = window.localStorage.getItem(CLE_STOCKAGE);
      if (sauvegarde && LANGUES_SUPPORTEES.includes(sauvegarde)) {
        i18next.changeLanguage(sauvegarde);
        setLangueState(sauvegarde);
        appliquerDirection(sauvegarde);
        return;
      }
    } catch (e) {
      // localStorage indisponible (navigation privée, etc.) — reste en français
    }
    appliquerDirection("fr");
  }, []);

  const setLangue = (nouvelleLangue) => {
    if (!LANGUES_SUPPORTEES.includes(nouvelleLangue)) return;
    i18next.changeLanguage(nouvelleLangue);
    setLangueState(nouvelleLangue);
    appliquerDirection(nouvelleLangue);
    try {
      window.localStorage.setItem(CLE_STOCKAGE, nouvelleLangue);
    } catch (e) {
      // pas grave, juste pas persisté d'une session à l'autre
    }
  };

  // t() garde la même signature qu'avant : t("wallet.recharger", { montant }).
  // i18next gère déjà nativement le repli vers fallbackLng ("fr") pour
  // toute clé absente de la langue active (voir lib/i18n/i18n.js).
  const t = (cle, params) => i18next.t(cle, params);

  return (
    <LanguageContext.Provider value={{ langue, setLangue, t, languesSupportees: LANGUES_SUPPORTEES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage() doit être appelé à l'intérieur de <LanguageProvider>");
  return ctx;
}
