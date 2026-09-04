"use client";

import React, { useState } from "react";
import {
  ArrowLeft, Sun, Moon, BookOpen, Search, FileText, Video,
  Layers, Download
} from "lucide-react";
import { useRouter } from "next/navigation";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

const TYPES = ["Tous", "E-books", "Templates", "Formations vidéo", "Livres physiques"];

const PRODUITS = [
  { titre: "Guide complet : réussir sur TikTok", type: "E-books", prix: "3 000 FCFA", auteur: "Grace M.", format: "PDF" },
  { titre: "Pack 50 templates Canva gaming", type: "Templates", prix: "5 000 FCFA", auteur: "Dan L.", format: "ZIP" },
  { titre: "Vendre en ligne au Congo", type: "Livres physiques", prix: "8 000 FCFA", auteur: "Rachel P.", format: "Livre" },
  { titre: "Masterclass growth marketing", type: "Formations vidéo", prix: "12 000 FCFA", auteur: "Fabrice N.", format: "Vidéo" },
  { titre: "100 idées de contenu gaming", type: "E-books", prix: "2 000 FCFA", auteur: "Josué K.", format: "PDF" },
];

const ICONES_FORMAT = { PDF: FileText, ZIP: Layers, Livre: BookOpen, Vidéo: Video };

export default function MarketingDigital() {
  const router = useRouter();
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];
  const [type, setType] = useState("Tous");
  const [recherche, setRecherche] = useState("");

  const filtres = PRODUITS.filter((p) => {
    const matchType = type === "Tous" || p.type === type;
    const matchRecherche = p.titre.toLowerCase().includes(recherche.toLowerCase());
    return matchType && matchRecherche;
  });

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold flex items-center gap-1">
          <BookOpen size={15} color={COLORS.accentPrimary} /> Marketing Digital
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
            placeholder="Chercher un livre, template, formation..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: COLORS.textPrimary }}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className="text-xs px-3 py-1.5 rounded-full flex-shrink-0"
              style={{
                background: type === t ? COLORS.accentPrimary : COLORS.surface,
                color: type === t ? COLORS.background : COLORS.textMuted,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-md mx-auto w-full px-4 pt-32 pb-10 flex flex-col gap-3">
        {filtres.map((p, i) => {
          const Icon = ICONES_FORMAT[p.format];
          return (
            <div key={i} className="rounded-xl p-3 flex items-center gap-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: COLORS.background }}>
                <Icon size={18} color={COLORS.accentPrimary} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold leading-tight">{p.titre}</p>
                <p className="text-[11px]" style={{ color: COLORS.textMuted }}>{p.auteur} · {p.format}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className="text-sm font-bold" style={{ color: COLORS.accentPrimary }}>{p.prix}</p>
                {p.format !== "Livre" && <Download size={14} color={COLORS.accentSecondary} />}
              </div>
            </div>
          );
        })}
        {filtres.length === 0 && (
          <p className="text-sm text-center py-16" style={{ color: COLORS.textMuted }}>Aucun résultat.</p>
        )}
      </main>
    </div>
  );
}
