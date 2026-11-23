"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { preparerSession } from "../lib/precharge";

const DUREE_MIN_MS = 2800; // le temps d'écrire « Bienvenue sur TEKÇA » mot par mot
const DUREE_MAX_MS = 5500; // on n'attend jamais plus, même si le réseau est lent
const COOKIE_VU = "tekca_demarre";

/*
  Écran de démarrage : logo + « Bienvenue sur TEKÇA » qui apparaît mot par mot,
  pendant que le site prépare en coulisses la session, le profil et le rôle
  de la personne (lib/precharge.js). Il se ferme quand l'animation est terminée
  ET que les données sont prêtes (ou après 5,5 s au plus).

  Il ne s'affiche qu'UNE fois par session de 30 minutes (cookie tekca_demarre,
  lu côté serveur dans app/layout.jsx : pas de clignotement ensuite), jamais
  pour les robots des moteurs de recherche, et il est raccourci si l'appareil
  est réglé sur « réduire les animations ».
*/
export default function EcranDemarrage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [sortie, setSortie] = useState(false); // fondu de sortie en cours
  const [retire, setRetire] = useState(false); // retiré de la page

  useEffect(() => {
    document.cookie = `${COOKIE_VU}=1; path=/; max-age=1800; SameSite=Lax`;
    let annule = false;
    const debut = Date.now();
    const reduit = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const minimum = reduit ? 700 : DUREE_MIN_MS;
    const plafond = new Promise((r) => setTimeout(r, DUREE_MAX_MS));
    Promise.race([preparerSession(router), plafond]).then(() => {
      const reste = Math.max(0, minimum - (Date.now() - debut));
      setTimeout(() => { if (!annule) setSortie(true); }, reste);
    });
    return () => { annule = true; };
  }, []);

  useEffect(() => {
    if (!sortie) return;
    const minuterie = setTimeout(() => setRetire(true), 600);
    return () => clearTimeout(minuterie);
  }, [sortie]);

  if (retire) return null;

  const mots = String(t("splash.bienvenue")).split(" ");

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t("splash.bienvenue")}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        background: "radial-gradient(circle at 50% 38%, #16294A 0%, #0A1220 62%)",
        opacity: sortie ? 0 : 1,
        transition: "opacity 0.55s ease",
        pointerEvents: sortie ? "none" : "auto",
      }}
    >
      <style>{`
        @keyframes tekcaLogo { 0% { opacity: 0; transform: scale(.72); } 62% { opacity: 1; transform: scale(1.06); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes tekcaMot { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes tekcaBarre { 0% { transform: translateX(-110%); } 100% { transform: translateX(260%); } }
        @media (prefers-reduced-motion: reduce) {
          .tekca-logo, .tekca-mot { animation-duration: .01s !important; animation-delay: 0s !important; }
          .tekca-barre { animation: none !important; }
        }
      `}</style>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-tekca.png"
        alt="TEKÇA"
        width={150}
        className="tekca-logo"
        style={{ opacity: 0, animation: "tekcaLogo 0.9s cubic-bezier(.2,.8,.2,1) forwards", filter: "drop-shadow(0 6px 22px rgba(232,93,47,.35))" }}
      />

      <p style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 10px", margin: 0, padding: "0 24px", fontSize: 26, fontWeight: 700, letterSpacing: ".01em", color: "#FFFFFF", textAlign: "center" }}>
        {mots.map((mot, i) => {
          const dernier = i === mots.length - 1;
          return (
            <span
              key={`${mot}-${i}`}
              className="tekca-mot"
              style={{
                opacity: 0,
                animation: "tekcaMot 0.55s ease forwards",
                animationDelay: `${0.95 + i * 0.5}s`,
                color: dernier ? "#E85D2F" : "#FFFFFF",
              }}
            >
              {mot}
            </span>
          );
        })}
      </p>

      <div style={{ width: 96, height: 3, borderRadius: 3, background: "rgba(255,255,255,.12)", overflow: "hidden" }}>
        <div className="tekca-barre" style={{ width: "40%", height: "100%", background: "#E85D2F", borderRadius: 3, animation: "tekcaBarre 1.3s ease-in-out infinite" }} />
      </div>
    </div>
  );
}
