"use client";

import React from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguage } from "../lib/i18n/LanguageContext";

const COLORS = {
  background: "#0A1220",
  surface: "#132039",
  accentPrimary: "#E85D2F",
  textPrimary: "#FFFFFF",
  textMuted: "#8B96AD",
  border: "#1E2D4A",
};

/*
  Composant générique réutilisé par les 3 pages légales pour éviter de
  dupliquer 3 fois la même mise en page. `sections` : tableau de
  { titre, paragraphes: [string, ...] }.
*/
export default function ContenuLegal({ titre, misAJourLe, sections }) {
  const router = useRouter();
  const { t } = useLanguage();

  // Exemple du guide de lecture : on prend la VRAIE partie « droits » si elle existe
  // (dans n'importe quelle langue), sinon une partie du milieu du document.
  const motsDroits = /droit|right|direito|haki|bokoli|حقوق/i;
  const indexExemple = Math.max(0, sections.findIndex((x) => motsDroits.test(x.titre)));
  const exemple = sections.findIndex((x) => motsDroits.test(x.titre)) >= 0 ? indexExemple : Math.floor(sections.length / 2);

  return (
    <div className="min-h-screen" style={{ background: COLORS.background }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour">
          <ArrowLeft size={22} color={COLORS.textPrimary} />
        </button>
        <span className="font-semibold" style={{ color: COLORS.textPrimary }}>{titre}</span>
      </header>

      <main className="pt-20 pb-16 px-5 max-w-md mx-auto w-full">
        {misAJourLe && (
          <p className="text-xs mb-6" style={{ color: COLORS.textMuted }}>
            Dernière mise à jour : {misAJourLe}
          </p>
        )}

        {/* GUIDE DE LECTURE + SOMMAIRE : savoir où aller avant de lire */}
        {sections.length > 2 && (
          <nav aria-label={t("legal.sommaire")} className="mb-8 rounded-xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <p className="text-sm font-semibold mb-1" style={{ color: COLORS.textPrimary }}>{t("legal.commentLire")}</p>
            <p className="text-xs leading-relaxed mb-3" style={{ color: COLORS.textMuted }}>
              {t("legal.commentLireTexte")}{" "}
              <span style={{ color: COLORS.textPrimary }}>
                {t("legal.exempleNumero", { titre: sections[exemple]?.titre, n: exemple + 1 })}
              </span>
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: COLORS.accentPrimary }}>{t("legal.sommaire")}</p>
            <ol className="flex flex-col gap-1.5">
              {sections.map((section, i) => (
                <li key={section.titre}>
                  <a href={`#article-${i + 1}`} className="flex items-baseline gap-2 text-xs" style={{ color: COLORS.textPrimary }}>
                    <span className="inline-flex items-center justify-center rounded-md font-bold shrink-0" style={{ background: COLORS.background, color: COLORS.accentPrimary, minWidth: 24, height: 20, fontSize: 11 }}>
                      {i + 1}
                    </span>
                    <span>{section.titre}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {sections.map((section, i) => (
          <section key={section.titre} id={`article-${i + 1}`} className="mb-6" style={{ scrollMarginTop: 76 }}>
            <h2 className="text-base font-semibold mb-2" style={{ color: COLORS.accentPrimary }}>
              {i + 1}. {section.titre}
            </h2>
            {section.paragraphes.map((p, k) => (
              <p key={k} className="text-sm leading-relaxed mb-2" style={{ color: COLORS.textMuted }}>
                {p}
              </p>
            ))}
            {sections.length > 2 && (
              <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-[11px] font-semibold" style={{ color: COLORS.textMuted }}>
                ↑ {t("legal.sommaire")}
              </a>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
