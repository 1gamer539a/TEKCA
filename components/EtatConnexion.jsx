"use client";

import React, { useEffect, useState } from "react";
import { useLanguage } from "../lib/i18n/LanguageContext";

/*
  Bandeau discret « hors connexion » (rouge) puis « connexion retrouvée » (vert, 3 s).
  Rien ne s'affiche tant que le réseau est là.
*/
export default function EtatConnexion() {
  const { t } = useLanguage();
  const [etat, setEtat] = useState("ok"); // "ok" | "hors" | "retrouve"

  useEffect(() => {
    let minuterie;
    const horsLigne = () => { clearTimeout(minuterie); setEtat("hors"); };
    const enLigne = () => {
      setEtat((e) => (e === "hors" ? "retrouve" : e));
      clearTimeout(minuterie);
      minuterie = setTimeout(() => setEtat("ok"), 3000);
    };
    if (navigator.onLine === false) setEtat("hors");
    window.addEventListener("offline", horsLigne);
    window.addEventListener("online", enLigne);
    return () => {
      clearTimeout(minuterie);
      window.removeEventListener("offline", horsLigne);
      window.removeEventListener("online", enLigne);
    };
  }, []);

  if (etat === "ok") return null;
  const hors = etat === "hors";
  return (
    <div
      role="status"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 95,
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 6px)", paddingBottom: 6, paddingLeft: 12, paddingRight: 12,
        background: hors ? "#B23A2E" : "#2F7D4F", color: "#fff", fontSize: 12, fontWeight: 600, textAlign: "center",
      }}
    >
      {hors ? t("reseau.horsLigne") : t("reseau.retrouve")}
    </div>
  );
}
