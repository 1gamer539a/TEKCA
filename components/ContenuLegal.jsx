"use client";

import React from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

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

        {sections.map((section) => (
          <section key={section.titre} className="mb-6">
            <h2 className="text-base font-semibold mb-2" style={{ color: COLORS.accentPrimary }}>
              {section.titre}
            </h2>
            {section.paragraphes.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed mb-2" style={{ color: COLORS.textMuted }}>
                {p}
              </p>
            ))}
          </section>
        ))}
      </main>
    </div>
  );
}
