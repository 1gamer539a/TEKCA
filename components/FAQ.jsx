"use client";

import React, { useState } from "react";
import { ArrowLeft, Sun, Moon, Plus, Minus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "../lib/ThemeContext";
import { useLanguage } from "../lib/i18n/LanguageContext";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

// Chaque thème regroupe des questions identifiées par un préfixe :
// les textes sont dans faq.<id>Q / faq.<id>A (voir lib/i18n/locales).
// Pour ajouter une question : ajouter son id ici + ses 2 clés dans fr.json.
const SECTIONS = [
  { titre: "faq.themeVendeur", ids: ["v1", "v2", "v3", "v4", "v5", "v6"] },
  { titre: "faq.themeRelation", ids: ["r1", "r2"] },
  { titre: "faq.themeSupport", ids: ["s1", "s2"] },
  { titre: "faq.themeInterdits", ids: ["i1", "i2"] },
  // Thème masqué : aucune section emploi/recrutement n'existe encore dans
  // l'application. Les textes (faq.e1Q… faq.e2A) restent dans fr.json ;
  // décommenter cette ligne quand la fonctionnalité sera disponible.
  // { titre: "faq.themeEmploi", ids: ["e1", "e2"] },
  { titre: "faq.themeTarifs", ids: ["t1", "t2"] },
];

export default function FAQ() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const COLORS = THEMES[theme] || THEMES.clair;
  const [ouverte, setOuverte] = useState(null);

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label={t("common.retour")}><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">{t("faq.titre")}</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label={t("common.changerTheme")}>
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-10 flex flex-col gap-6">
        {SECTIONS.map((section) => (
          <section key={section.titre} className="flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.textMuted }}>{t(section.titre)}</p>
            {section.ids.map((id) => {
              const estOuverte = ouverte === id;
              return (
                <div key={id} className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                  <button
                    onClick={() => setOuverte(estOuverte ? null : id)}
                    className="w-full flex items-center justify-between gap-2 text-left"
                    aria-expanded={estOuverte}
                  >
                    <span className="text-xs font-bold">{t(`faq.${id}Q`)}</span>
                    {estOuverte ? <Minus size={14} color={COLORS.accentPrimary} /> : <Plus size={14} color={COLORS.accentPrimary} />}
                  </button>
                  {estOuverte && (
                    <p className="text-[11.5px] mt-2" style={{ color: COLORS.textMuted, whiteSpace: "pre-line" }}>{t(`faq.${id}A`)}</p>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </main>
    </div>
  );
}
