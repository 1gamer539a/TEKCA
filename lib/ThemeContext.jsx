"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext(null);

const CLE_STOCKAGE = "tekca-theme";

/*
  CORRECTIF — chaque page avait son propre `useState("clair")` local
  (34 composants concernés). Next.js remonte un nouveau composant à
  chaque navigation, donc ce state local repartait de zéro à chaque
  clic sur un lien : le mode sombre choisi sur une page "revenait" en
  clair dès qu'on changeait de page, alors que ça devrait être un
  choix global de l'utilisateur, mémorisé partout — même principe que
  LanguageContext pour la langue.
*/
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("clair");

  useEffect(() => {
    try {
      const sauvegarde = window.localStorage.getItem(CLE_STOCKAGE);
      if (sauvegarde === "clair" || sauvegarde === "sombre") setThemeState(sauvegarde);
    } catch (e) {
      // localStorage indisponible (navigation privée, etc.) — reste en clair
    }
  }, []);

  const setTheme = (nouveauTheme) => {
    setThemeState(nouveauTheme);
    try {
      window.localStorage.setItem(CLE_STOCKAGE, nouveauTheme);
    } catch (e) {
      // pas grave, juste pas persisté d'une session à l'autre
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme() doit être appelé à l'intérieur de <ThemeProvider>");
  return ctx;
}
