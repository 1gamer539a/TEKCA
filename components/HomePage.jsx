"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Menu, X, Search, Zap, Gamepad2, Shirt, Tv, Store,
  Sparkles, Trophy, GraduationCap, ChevronRight, ChevronDown,
  Sun, Moon, Crown
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { VitrineRotative, useVitrineIndex } from "./VitrineRotative";

const THEMES = {
  sombre: {
    background: "#0A1220",
    surface: "#132039",
    accentPrimary: "#E85D2F",
    accentSecondary: "#C99A3A",
    textPrimary: "#FFFFFF",
    textMuted: "#8B96AD",
    border: "#1E2D4A",
  },
  clair: {
    background: "#FFFFFF",
    surface: "#F8FAFC",
    accentPrimary: "#E85D2F",
    accentSecondary: "#C99A3A",
    textPrimary: "#0F172A",
    textMuted: "#64748B",
    border: "#E2E8F0",
  },
};

const MENU_SECTIONS = [
  { labelKey: "nav.rechargesJeu", icon: Zap, href: "/categories" },
  { labelKey: "nav.comptesAbonnements", icon: Tv, href: "/categories" },
  { labelKey: "nav.accessoires", icon: Gamepad2, href: "/categories" },
  { labelKey: "nav.vetementsGuildes", icon: Shirt, href: "/categories" },
  { labelKey: "nav.marche", icon: Store, href: "/marche" },
  { labelKey: "nav.vendeursPartenaires", icon: Store, href: "/vendre" },
  { labelKey: "nav.iaAssistant", icon: Sparkles, href: "/ia" },
  { labelKey: "nav.tournois", icon: Trophy, href: "/tournois" },
  { labelKey: "nav.formation", icon: GraduationCap, href: "/formation/createurs" },
  { labelKey: "nav.abonnementsTekca", icon: Crown, href: "/abonnements" },
  { labelKey: "nav.ventesFlash", icon: Zap, href: "/ventes-flash" },
];

const QUICK_ACCESS = [
  { label: "Le Marché", icon: Store, href: "/marche" },
  { label: "Accessoires", icon: Gamepad2, href: "/categories" },
  { label: "Vêtements", icon: Shirt, href: "/categories" },
  { label: "Abonnements", icon: Tv, href: "/categories" },
  { label: "IA Assistant", icon: Sparkles, href: "/ia" },
  { label: "Tournois", icon: Trophy, href: "/tournois" },
  { label: "Formation", icon: GraduationCap, href: "/formation/createurs" },
  { label: "Marketing Digital", icon: Tv, href: "/marketing-digital" },
];

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState("clair");
  const { langue, setLangue, t } = useLanguage();
  const indexVitrine = useVitrineIndex();
  const COLORS = THEMES[theme];
  const [produitsTendances, setProduitsTendances] = useState([]);

  useEffect(() => {
    const charger = async () => {
      const { data, error } = await supabase
        .from("produits")
        .select("id, nom, prix_base, type")
        .eq("statut_validation", "valide")
        .order("date_creation", { ascending: false })
        .limit(6);

      if (!error && data) {
        const LABELS_TYPE = {
          recharge_jeu: "Recharge",
          accessoire: "Accessoire",
          vetement: "Vêtement",
          abonnement_service: "Abonnement",
        };
        setProduitsTendances(
          data.map((p) => ({
            id: p.id,
            titre: p.nom,
            prix: `${Number(p.prix_base).toLocaleString()} FCFA`,
            tag: LABELS_TYPE[p.type] || p.type,
          }))
        );
      }
    };
    charger();
  }, []);

  return (
    <div
      style={{ background: COLORS.background, color: COLORS.textPrimary, minHeight: "100vh" }}
      className="font-sans flex flex-col"
    >
      <style>{`
        @keyframes takcaFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes takcaGlowPulse {
          0%, 100% { box-shadow: 0 0 0 0 ${COLORS.accentPrimary}55; }
          50% { box-shadow: 0 0 0 10px ${COLORS.accentPrimary}00; }
        }
        @keyframes takcaVitrineEntree {
          0%   { opacity: 0; transform: scale(0.88) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .takca-hero-ligne1 { animation: takcaFadeUp 0.55s ease-out both; }
        .takca-hero-ligne2 { animation: takcaFadeUp 0.55s ease-out 0.15s both; }
        .takca-cta-pulse { animation: takcaGlowPulse 2.6s ease-in-out infinite; }
        .takca-vitrine-entree { animation: takcaVitrineEntree 0.6s ease-out both; }
      `}</style>
      {/* HEADER */}
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => setMenuOpen(true)} aria-label={t("common.ouvrirMenu")}>
          <Menu size={24} color={COLORS.textPrimary} />
        </button>
        <img src="/logo-tekca.png" alt="TEKÇA" style={{ height: 28, objectFit: "contain" }} />
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")}
            aria-label={t("common.changerTheme")}
          >
            {theme === "sombre" ? (
              <Sun size={20} color={COLORS.accentSecondary} />
            ) : (
              <Moon size={20} color={COLORS.accentSecondary} />
            )}
          </button>
          <Link href="/recherche" aria-label={t("common.rechercher")}>
            <Search size={22} color={COLORS.accentPrimary} />
          </Link>
        </div>
      </header>

      {/* MENU HAMBURGER — panneau latéral */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="w-4/5 max-w-xs h-full overflow-y-auto p-5"
            style={{ background: COLORS.background, borderRight: `1px solid ${COLORS.border}` }}
          >
            <div className="flex justify-end mb-4">
              <button onClick={() => setMenuOpen(false)} aria-label={t("common.fermerMenu")}>
                <X size={24} color={COLORS.textPrimary} />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {MENU_SECTIONS.map(({ labelKey, icon: Icon, badge, href }) => (
                <Link
                  href={href}
                  key={labelKey}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-between py-3 px-2 rounded-lg text-left"
                  style={{ borderBottom: `1px solid ${COLORS.border}` }}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={18} color={COLORS.accentPrimary} />
                    <span style={{ color: COLORS.textPrimary }}>{t(labelKey)}</span>
                  </span>
                  {badge ? (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: COLORS.accentSecondary, color: COLORS.background }}
                    >
                      {badge}
                    </span>
                  ) : (
                    <ChevronRight size={16} color={COLORS.textMuted} />
                  )}
                </Link>
              ))}
              <div className="mt-4 pt-4 flex flex-col gap-2 text-sm" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                <Link href="/mentions-legales" onClick={() => setMenuOpen(false)} style={{ color: COLORS.textMuted }}>
                  {t("nav.mentionsLegales")}
                </Link>
                <Link href="/cgu" onClick={() => setMenuOpen(false)} style={{ color: COLORS.textMuted }}>
                  {t("nav.conditionsGenerales")}
                </Link>
                <Link href="/confidentialite" onClick={() => setMenuOpen(false)} style={{ color: COLORS.textMuted }}>
                  {t("nav.confidentialite")}
                </Link>
              </div>

              <div className="mt-4 pt-4 flex items-center justify-between text-sm" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                <span style={{ color: COLORS.textMuted }}>{t("nav.langue")}</span>
                <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
                  {["fr", "en"].map((code) => (
                    <button
                      key={code}
                      onClick={() => setLangue(code)}
                      className="px-3 py-1 text-xs font-semibold uppercase"
                      style={{
                        background: langue === code ? COLORS.accentPrimary : "transparent",
                        color: langue === code ? COLORS.background : COLORS.textMuted,
                      }}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            </nav>
          </div>
          <button
            className="flex-1"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => setMenuOpen(false)}
            aria-label={t("common.fermer")}
          />
        </div>
      )}

      {/* CONTENU */}
      <main className="flex-1 pt-16 pb-20 px-4 max-w-md mx-auto w-full">
        {/* HERO */}
        <section
          className="mt-4 rounded-2xl p-5 relative overflow-hidden"
          style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
        >
          <VitrineRotative theme={theme} index={indexVitrine} />
          <div className="relative z-10">
            <img src="/logo-tekca.png" alt="TEKÇA" className="takca-hero-ligne1" style={{ height: 56, objectFit: "contain", marginBottom: 10 }} />
            <h1 className="text-3xl font-extrabold leading-tight uppercase tracking-tight">
              <span className="block takca-hero-ligne1">Tout le e-commerce,</span>
              <span className="block takca-hero-ligne2" style={{ color: COLORS.accentPrimary }}>un seul écosystème</span>
            </h1>
            <p className="text-sm mt-2" style={{ color: COLORS.textMuted }}>
              Recharges · Accessoires · Vêtements · IA · Marketplace
            </p>
            <div className="flex gap-3 mt-4">
              <Link
                href="/marche"
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: COLORS.accentPrimary, color: COLORS.background }}
              >
                Découvrir la boutique
              </Link>
              <Link
                href="/vendre"
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ border: `1px solid ${COLORS.accentPrimary}`, color: COLORS.accentPrimary }}
              >
                Devenir vendeur
              </Link>
            </div>
          </div>
        </section>

        {/* GRILLE ACCES RAPIDE */}
        <section className="grid grid-cols-4 gap-3 mt-5">
          {QUICK_ACCESS.map(({ label, icon: Icon, badge, href }) => (
            <Link
              href={href}
              key={label}
              className="flex flex-col items-center justify-center gap-2 rounded-xl py-4 relative"
              style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
            >
              {badge && (
                <span
                  className="absolute top-1 right-1 text-[9px] px-1.5 py-0.5 rounded-full"
                  style={{ background: COLORS.accentSecondary, color: COLORS.background }}
                >
                  {badge}
                </span>
              )}
              <Icon size={22} color={COLORS.accentPrimary} />
              <span className="text-xs text-center" style={{ color: COLORS.textPrimary }}>
                {label}
              </span>
            </Link>
          ))}
        </section>

        {/* PRODUITS TENDANCES */}
        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold" style={{ color: COLORS.accentPrimary }}>
              Produits tendances
            </h2>
            <ChevronRight size={18} color={COLORS.textMuted} />
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {produitsTendances.length === 0 && (
              <p className="text-xs" style={{ color: COLORS.textMuted }}>Aucun produit pour l'instant.</p>
            )}
            {produitsTendances.map((p) => (
              <Link
                href={`/produit/${p.id}`}
                key={p.id}
                className="min-w-[140px] rounded-xl p-3 flex-shrink-0 block"
                style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
              >
                <div
                  className="w-full h-20 rounded-lg mb-2"
                  style={{ background: COLORS.background }}
                />
                <span className="text-[10px] uppercase" style={{ color: COLORS.accentSecondary }}>
                  {p.tag}
                </span>
                <p className="text-sm font-semibold leading-tight mt-1">{p.titre}</p>
                <p className="text-sm font-bold mt-1" style={{ color: COLORS.accentPrimary }}>
                  {p.prix}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* BANDEAU VENDEUR */}
        <section
          className="mt-6 rounded-2xl p-5 relative overflow-hidden"
          style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
        >
          <VitrineRotative theme={theme} index={indexVitrine} />
          <div className="relative z-10">
            <h3 className="text-lg font-bold">Rejoignez l'écosystème</h3>
            <p className="text-sm mt-1" style={{ color: COLORS.textMuted }}>
              Devenez vendeur agréé, lancez votre boutique gaming.
            </p>
            <button
              className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold takca-cta-pulse"
              style={{ background: COLORS.accentPrimary, color: COLORS.background }}
            >
              Créer mon compte vendeur
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
