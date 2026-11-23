"use client";

import React from "react";
import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { useTheme } from "../lib/ThemeContext";
import { RAISONS_CONNEXION, urlConnexion } from "../lib/connexion";

const THEMES = {
  sombre: { surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A", background: "#0A1220" },
  clair: { surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0", background: "#FFFFFF" },
};

/*
  Carte « Connexion requise » : cadenas, explication adaptée à l'action tentée, et deux boutons.
  Utilisée dans la fenêtre globale ET en pleine page (panier vide pour un visiteur).
*/
export default function CarteConnexionRequise({ raison = "defaut", suite, onFermer }) {
  const router = useRouter();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const COLORS = THEMES[theme] || THEMES.sombre;
  const cle = RAISONS_CONNEXION.includes(raison) ? raison : "defaut";

  return (
    <div className="w-full max-w-md rounded-2xl p-5 text-center" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary }}>
      <div className="mx-auto mb-3 w-12 h-12 rounded-full flex items-center justify-center" style={{ background: COLORS.background, border: `1px solid ${COLORS.border}` }}>
        <Lock size={22} color={COLORS.accentPrimary} />
      </div>
      <p className="text-base font-bold mb-1">{t("connexionRequise.titre")}</p>
      <p className="text-sm mb-2">{t(`connexionRequise.raison_${cle}`)}</p>
      <p className="text-xs mb-4" style={{ color: COLORS.textMuted }}>{t("connexionRequise.pasUnBug")}</p>
      <button
        onClick={() => router.push(urlConnexion({ suite, raison: cle }))}
        className="w-full rounded-xl py-3 font-bold text-sm mb-2"
        style={{ background: COLORS.accentPrimary, color: "#fff" }}
      >
        {t("connexionRequise.seConnecter")}
      </button>
      <button
        onClick={() => router.push(urlConnexion({ suite, raison: cle, mode: "inscription" }))}
        className="w-full rounded-xl py-3 font-bold text-sm"
        style={{ background: "transparent", color: COLORS.accentPrimary, border: `1px solid ${COLORS.accentPrimary}` }}
      >
        {t("connexionRequise.creerCompte")}
      </button>
      <p className="text-[11px] mt-2" style={{ color: COLORS.textMuted }}>{t("connexionRequise.gratuit")}</p>
      {onFermer && (
        <button onClick={onFermer} className="mt-3 text-xs" style={{ color: COLORS.textMuted }}>
          {t("connexionRequise.plusTard")}
        </button>
      )}
    </div>
  );
}
