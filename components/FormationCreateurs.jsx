"use client";

import React, { useState } from "react";
import {
  ArrowLeft, Sun, Moon, GraduationCap, Video, Radio, FileText,
  Clock, PlayCircle, Lock
} from "lucide-react";
import { useRouter } from "next/navigation";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

/*
  Formation Créateurs de contenu UNIQUEMENT — la formation
  Entrepreneurs vit désormais dans son propre composant séparé,
  FormationEntrepreneurs.jsx, avec un ton et une structure différents.
*/
const MODULES = [
  { titre: "Créer sur TikTok/Insta en partant de zéro", type: "video", duree: "12 min", gratuit: true },
  { titre: "Live Q&A : monétiser sa communauté", type: "live", duree: "20 août, 19h", gratuit: true },
  { titre: "Guide montage vidéo mobile", type: "pdf", duree: "8 pages", gratuit: false },
  { titre: "Stratégie de contenu gaming", type: "video", duree: "18 min", gratuit: false },
];

const ICONES_TYPE = { video: Video, live: Radio, pdf: FileText };

export default function FormationCreateurs() {
  const router = useRouter();
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold flex items-center gap-1">
          <GraduationCap size={15} color={COLORS.accentPrimary} /> Créateurs de contenu
        </span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-10 flex flex-col gap-3">
        {MODULES.map((m, i) => {
          const Icon = ICONES_TYPE[m.type];
          return (
            <button
              key={i}
              className="rounded-xl p-3 flex items-center gap-3"
              style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
            >
              <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: COLORS.background }}>
                <Icon size={18} color={COLORS.accentPrimary} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold">{m.titre}</p>
                <p className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: COLORS.textMuted }}>
                  <Clock size={10} /> {m.duree}
                </p>
              </div>
              {m.gratuit ? (
                <PlayCircle size={18} color={COLORS.accentSecondary} />
              ) : (
                <Lock size={16} color={COLORS.textMuted} />
              )}
            </button>
          );
        })}
      </main>
    </div>
  );
}

