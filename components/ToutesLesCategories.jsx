"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Sun, Moon, Zap, Gamepad2, Shirt, Tv, Store,
  Sparkles, Trophy, GraduationCap, Megaphone, ChevronRight,
  Home, Car, Sofa, Baby, Joystick, Smartphone, Gem,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "../lib/ThemeContext";
import { useLanguage } from "../lib/i18n/LanguageContext";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

const GROUPES = [
  {
    titreCle: "categories.titreMarketplace",
    items: [
      { cle: "categories.rechargesJeu", icon: Zap, href: "/marche?type=recharge_jeu" },
      { cle: "categories.comptesAbonnements", icon: Tv, href: "/marche?type=abonnement_service" },
      { cle: "categories.accessoires", icon: Gamepad2, href: "/marche?type=accessoire" },
      { cle: "categories.vetements", icon: Shirt, href: "/marche?type=vetement" },
      { cle: "categories.immobilier", icon: Home, href: "/marche?type=immobilier" },
      { cle: "categories.vehicules", icon: Car, href: "/marche?type=vehicule" },
      { cle: "categories.meubleDeco", icon: Sofa, href: "/marche?type=meuble_deco" },
      { cle: "categories.jouetEnfant", icon: Baby, href: "/marche?type=jouet_enfant" },
      { cle: "categories.consoleGaming", icon: Joystick, href: "/marche?type=console_gaming" },
      { cle: "categories.highTech", icon: Smartphone, href: "/marche?type=high_tech" },
      { cle: "categories.modeBeaute", icon: Gem, href: "/marche?type=mode_beaute" },
      { cle: "categories.vendeursPartenaires", icon: Store, href: "/vendre" },
      { cle: "categories.marketingDigital", icon: Tv, href: "/marketing-digital" },
    ],
  },
  {
    titreCle: "categories.titreEcosysteme",
    items: [
      { cle: "categories.iaAssistant", icon: Sparkles, href: "/ia" },
      { cle: "categories.evenements", icon: Trophy, href: "/tournois" },
      { cle: "categories.formationCreateurs", icon: GraduationCap, href: "/formation/createurs" },
      { cle: "categories.formationEntrepreneurs", icon: GraduationCap, href: "/formation/entrepreneurs" },
      { cle: "categories.promotionComptes", icon: Megaphone, href: "/promotion" },
    ],
  },
];

export default function ToutesLesCategories() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const COLORS = THEMES[theme];

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label={t("common.retour")}><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">{t("categories.toutesLesCategories")}</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label={t("common.changerTheme")}>
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-10">
        {GROUPES.map((groupe) => (
          <section key={groupe.titreCle} className="mb-6">
            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: COLORS.accentPrimary }}>
              {t(groupe.titreCle)}
            </p>
            <div className="flex flex-col gap-2">
              {groupe.items.map(({ cle, icon: Icon, badge, href }) => (
                <Link
                  href={href}
                  key={cle}
                  className="rounded-xl p-3 flex items-center gap-3"
                  style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
                >
                  <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: COLORS.background }}>
                    <Icon size={18} color={COLORS.accentPrimary} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{t(`${cle}_label`)}</p>
                      {badge && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: COLORS.accentSecondary, color: COLORS.background }}>
                          {badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px]" style={{ color: COLORS.textMuted }}>{t(`${cle}_desc`)}</p>
                  </div>
                  <ChevronRight size={16} color={COLORS.textMuted} />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
