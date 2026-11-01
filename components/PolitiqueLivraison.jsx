"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useTheme } from "../lib/ThemeContext";
import { useLanguage } from "../lib/i18n/LanguageContext";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

/*
  CORRECTIF — le lien "Politique de livraison & retours" dans Mon
  Compte pointait par erreur vers /contact. Contenu écrit à partir du
  fonctionnement réel déjà en place dans le code (séquestre wallet,
  code de confirmation à 6 caractères, statuts de commande) plutôt
  que du texte générique.

  CORRECTIF 2 — cette page ignorait le thème sombre (COLORS était une
  constante fixe, jamais reliée à useTheme()) ; corrigé au passage.
*/
export default function PolitiqueLivraison() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const COLORS = THEMES[theme] || THEMES.clair;

  const SECTIONS = [
    { titre: t("legal.livraison.numerique.titre"), texte: t("legal.livraison.numerique.texte") },
    { titre: t("legal.livraison.physique.titre"), texte: t("legal.livraison.physique.texte") },
    { titre: t("legal.livraison.delais.titre"), texte: t("legal.livraison.delais.texte") },
    { titre: t("legal.livraison.litiges.titre"), texte: t("legal.livraison.litiges.texte") },
    { titre: t("legal.livraison.remboursement.titre"), texte: t("legal.livraison.remboursement.texte") },
  ];

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label={t("common.retour")}>
          <ArrowLeft size={20} color={COLORS.textPrimary} />
        </button>
        <h1 className="font-bold text-base">{t("legal.livraison.titrePage")}</h1>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-24 flex flex-col gap-5">
        {SECTIONS.map((s) => (
          <div key={s.titre}>
            <h2 className="font-bold text-sm mb-1" style={{ color: COLORS.accentPrimary }}>{s.titre}</h2>
            <p className="text-sm" style={{ color: COLORS.textMuted }}>{s.texte}</p>
          </div>
        ))}
      </main>
    </div>
  );
}
