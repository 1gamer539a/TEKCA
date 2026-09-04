"use client";

import React, { useState } from "react";
import {
  ArrowLeft, Sun, Moon, Megaphone, Search, Instagram, Music2,
  Youtube, TrendingUp, Users, ExternalLink, Rocket
} from "lucide-react";
import { useRouter } from "next/navigation";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

const RESEAUX = ["Tous", "TikTok", "Instagram", "YouTube"];
const ICONES_RESEAU = { TikTok: Music2, Instagram: Instagram, YouTube: Youtube };

const COMPTES = [
  { nom: "@grace.gaming", reseau: "TikTok", abonnes: "24 000", niche: "Free Fire highlights", boost: true },
  { nom: "@kivu.esports", reseau: "Instagram", abonnes: "12 500", niche: "Guilde esports Congo", boost: false },
  { nom: "Dan Live Gaming", reseau: "YouTube", abonnes: "8 900", niche: "Let's play PUBG", boost: false },
  { nom: "@rachel.stream", reseau: "TikTok", abonnes: "31 000", niche: "GTA RP", boost: true },
];

export default function PromotionComptes() {
  const router = useRouter();
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];
  const [reseau, setReseau] = useState("Tous");
  const [recherche, setRecherche] = useState("");

  const comptesFiltres = COMPTES
    .filter((c) => reseau === "Tous" || c.reseau === reseau)
    .filter((c) => c.nom.toLowerCase().includes(recherche.toLowerCase()))
    .sort((a, b) => (b.boost ? 1 : 0) - (a.boost ? 1 : 0)); // les boostés remontent en premier

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold flex items-center gap-1">
          <Megaphone size={15} color={COLORS.accentPrimary} /> Promotion de comptes
        </span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <div className="fixed top-14 left-0 right-0 z-30 px-4 py-2 flex flex-col gap-2" style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <Search size={15} color={COLORS.textMuted} />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Chercher un compte gaming..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: COLORS.textPrimary }}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {RESEAUX.map((r) => (
            <button
              key={r}
              onClick={() => setReseau(r)}
              className="text-xs px-3 py-1.5 rounded-full flex-shrink-0"
              style={{
                background: reseau === r ? COLORS.accentPrimary : COLORS.surface,
                color: reseau === r ? COLORS.background : COLORS.textMuted,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-md mx-auto w-full px-4 pt-32 pb-24 flex flex-col gap-3">
        {comptesFiltres.map((c, i) => {
          const Icon = ICONES_RESEAU[c.reseau];
          return (
            <div
              key={i}
              className="rounded-xl p-3 flex items-center gap-3"
              style={{ background: COLORS.surface, border: `1px solid ${c.boost ? COLORS.accentPrimary : COLORS.border}` }}
            >
              <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: COLORS.background }}>
                <Icon size={18} color={COLORS.accentPrimary} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold">{c.nom}</p>
                  {c.boost && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5" style={{ background: COLORS.accentPrimary, color: COLORS.background }}>
                      <TrendingUp size={9} /> Mis en avant
                    </span>
                  )}
                </div>
                <p className="text-[11px]" style={{ color: COLORS.textMuted }}>{c.niche}</p>
                <p className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: COLORS.accentSecondary }}>
                  <Users size={10} /> {c.abonnes} abonnés
                </p>
              </div>
              <ExternalLink size={16} color={COLORS.textMuted} />
            </div>
          );
        })}
      </main>

      {/* Bouton flottant — mettre son propre compte en avant */}
      <button
        className="fixed bottom-6 right-4 z-40 rounded-full px-4 py-3 flex items-center gap-2 font-semibold text-sm shadow-lg"
        style={{ background: COLORS.accentPrimary, color: COLORS.background }}
      >
        <Rocket size={18} /> Promouvoir mon compte
      </button>
    </div>
  );
}
