"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { dictionnaire } from "./dictionnaire";

const LanguageContext = createContext(null);

const CLE_STOCKAGE = "takca-langue";

export function LanguageProvider({ children }) {
  const [langue, setLangueState] = useState("fr");

  // Lit la préférence sauvegardée une fois le composant monté côté
  // navigateur (localStorage n'existe pas côté serveur en SSR).
  useEffect(() => {
    try {
      const sauvegarde = window.localStorage.getItem(CLE_STOCKAGE);
      if (sauvegarde === "fr" || sauvegarde === "en") setLangueState(sauvegarde);
    } catch (e) {
      // localStorage indisponible (navigation privée, etc.) — reste en français
    }
  }, []);

  const setLangue = (nouvelleLangue) => {
    setLangueState(nouvelleLangue);
    try {
      window.localStorage.setItem(CLE_STOCKAGE, nouvelleLangue);
    } catch (e) {
      // pas grave, juste pas persisté d'une session à l'autre
    }
  };

  /*
    t("wallet.recharger") → cherche dans dictionnaire[langue], et si
    la clé n'existe pas encore pour cette langue (traduction pas
    encore faite), retombe sur le français plutôt que d'afficher du
    vide ou la clé brute. Ça permet de traduire l'app progressivement
    sans jamais rien casser.

    Deuxième argument optionnel pour l'interpolation :
    t("wallet.confirmationEnvoi", { montant: 5000, nom: "Awa" })
  */
  const t = (cle, params) => {
    const chemins = cle.split(".");

    let valeur = dictionnaire[langue];
    for (const c of chemins) valeur = valeur?.[c];

    if (valeur === undefined) {
      valeur = dictionnaire.fr;
      for (const c of chemins) valeur = valeur?.[c];
    }

    if (typeof valeur !== "string") return cle;

    if (params) {
      for (const [cle2, val2] of Object.entries(params)) {
        valeur = valeur.replaceAll(`{{${cle2}}}`, val2);
      }
    }

    return valeur;
  };

  return (
    <LanguageContext.Provider value={{ langue, setLangue, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage() doit être appelé à l'intérieur de <LanguageProvider>");
  return ctx;
}
