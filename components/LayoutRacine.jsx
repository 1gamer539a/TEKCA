"use client";

import React, { useState } from "react";
import BoutonIAFlottant from "./BoutonIAFlottant";
import IAAssistant from "./IAAssistant";
import NavigationBas from "./NavigationBas";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

/*
  A utiliser comme layout racine (ex: app/layout.jsx en Next.js App
  Router). Toutes les pages du site ({children}) s'affichent normalement,
  et le bouton IA flottant + le panneau IA en plein écran restent
  disponibles au-dessus, sur CHAQUE page, sans avoir à les remonter
  page par page. Idem pour la nav du bas (NavigationBas) : montée ici
  une seule fois, elle reste visible en changeant de page au lieu de
  disparaître (voir le commentaire dans NavigationBas.jsx).
*/
export default function LayoutRacine({ children }) {
  const [iaOuverte, setIaOuverte] = useState(false);
  const COLORS = THEMES.sombre;

  return (
    <div className="relative">
      {children}

      <NavigationBas theme="sombre" />

      {!iaOuverte && (
        <BoutonIAFlottant COLORS={COLORS} onOpen={() => setIaOuverte(true)} />
      )}

      {iaOuverte && (
        <div className="fixed inset-0 z-[60]">
          <IAAssistant onFermer={() => setIaOuverte(false)} />
        </div>
      )}
    </div>
  );
}
