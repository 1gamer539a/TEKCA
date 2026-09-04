"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Sun, Moon, Zap, Gamepad2, Shirt, Tv, Store,
  Sparkles, Trophy, GraduationCap, Megaphone, ChevronRight
} from "lucide-react";
import { useRouter } from "next/navigation";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

const GROUPES = [
  {
    titre: "Marketplace",
    items: [
      { label: "Recharges de jeu", icon: Zap, desc: "Free Fire, PUBG, Fortnite...", href: "/marche" },
      { label: "Comptes & Abonnements", icon: Tv, desc: "Netflix, Spotify, Snapchat+...", href: "/marche" },
      { label: "Accessoires PC & PlayStation", icon: Gamepad2, desc: "Manettes, casques, périphériques", href: "/marche" },
      { label: "Vêtements & Guildes", icon: Shirt, desc: "Catalogue et créations sur-mesure", href: "/marche" },
      { label: "Vendeurs partenaires", icon: Store, desc: "Boutiques tierces vérifiées", href: "/vendre" },
      { label: "Marketing Digital", icon: Tv, desc: "Livres, ebooks, templates", href: "/marketing-digital" },
    ],
  },
  {
    titre: "Écosystème",
    items: [
      { label: "IA Assistant", icon: Sparkles, desc: "Questions, sensibilités, codes", href: "/ia" },
      { label: "Tournois", icon: Trophy, desc: "Compétitions gaming", href: "/tournois" },
      { label: "Formation Créateurs", icon: GraduationCap, desc: "Créateurs de contenu", href: "/formation/createurs" },
      { label: "Formation Entrepreneurs", icon: GraduationCap, desc: "Académie entrepreneuriale", href: "/formation/entrepreneurs" },
      { label: "Promotion de comptes", icon: Megaphone, desc: "Mets en avant ton TikTok/Insta", href: "/promotion" },
    ],
  },
];

export default function ToutesLesCategories() {
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
        <span className="text-sm font-semibold">Toutes les catégories</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-10">
        {GROUPES.map((groupe) => (
          <section key={groupe.titre} className="mb-6">
            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: COLORS.accentPrimary }}>
              {groupe.titre}
            </p>
            <div className="flex flex-col gap-2">
              {groupe.items.map(({ label, icon: Icon, desc, badge, href }) => (
                <Link
                  href={href}
                  key={label}
                  className="rounded-xl p-3 flex items-center gap-3"
                  style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
                >
                  <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: COLORS.background }}>
                    <Icon size={18} color={COLORS.accentPrimary} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{label}</p>
                      {badge && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: COLORS.accentSecondary, color: COLORS.background }}>
                          {badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px]" style={{ color: COLORS.textMuted }}>{desc}</p>
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
