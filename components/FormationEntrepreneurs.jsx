"use client";

import React, { useState } from "react";
import {
  ArrowLeft, Sun, Moon, Briefcase, Award, TrendingUp, PlayCircle,
  Lock, Clock, FileText, Radio, Video, CheckCircle2, ChevronRight,
  Building2, Target, Lightbulb
} from "lucide-react";
import { useRouter } from "next/navigation";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

/*
  Positionnement volontairement différent de FormationCreateurs.jsx :
  ton "académie" plutôt que "astuces rapides". Le mentor (Livaï) est
  mis en avant avec des preuves concrètes (projets réels), pas
  seulement des promesses — c'est ce qui justifie le tarif et le
  sérieux du programme.
*/
const PROJETS_REFERENCE = [
  { nom: "GAMER-SHOP", desc: "E-commerce gaming — recharges, abonnements" },
  { nom: "TEKÇA", desc: "Marketplace multi-services en cours" },
  { nom: "Projet 3", desc: "—" },
  { nom: "Projet 4", desc: "—" },
];

const PROGRAMME = [
  {
    titre: "Module 1 — De l'idée au projet concret",
    type: "video",
    duree: "22 min",
    gratuit: true,
    desc: "Comment repérer une vraie opportunité, pas juste une envie.",
  },
  {
    titre: "Module 2 — Construire sans argent au départ",
    type: "video",
    duree: "19 min",
    gratuit: true,
    desc: "La méthode utilisée pour lancer les premiers projets à budget quasi nul.",
  },
  {
    titre: "Live mensuel — Questions/réponses direct",
    type: "live",
    duree: "Dernier samedi du mois, 19h",
    gratuit: true,
    desc: "Pose tes questions directement, sur ton projet précis.",
  },
  {
    titre: "Module 3 — Structurer et sécuriser son activité",
    type: "pdf",
    duree: "16 pages",
    gratuit: false,
    desc: "Statut légal, gestion de l'argent, éviter les erreurs qui coûtent cher.",
  },
  {
    titre: "Module 4 — Faire grandir plusieurs projets à la fois",
    type: "video",
    duree: "27 min",
    gratuit: false,
    desc: "Comment gérer 4 projets en parallèle sans s'épuiser.",
  },
];

const ICONES_TYPE = { video: Video, live: Radio, pdf: FileText };

export default function FormationEntrepreneurs() {
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
          <Briefcase size={15} color={COLORS.accentPrimary} /> Entrepreneurs
        </span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-10">
        {/* Bloc crédibilité — le mentor, pas juste un logo */}
        <div className="rounded-2xl p-5 mb-5" style={{ background: COLORS.surface, border: `1px solid ${COLORS.accentPrimary}` }}>
          <div className="flex items-center gap-2 mb-2">
            <Award size={18} color={COLORS.accentPrimary} />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.accentPrimary }}>
              Formation dirigée par le fondateur
            </span>
          </div>
          <p className="text-lg font-extrabold leading-snug">
            Apprends directement de quelqu'un qui a déjà construit — pas d'une théorie.
          </p>
          <p className="text-sm mt-2" style={{ color: COLORS.textMuted }}>
            4 projets concrets déjà lancés. Ici, on ne vend pas du rêve : on montre comment les idées
            sont nées, comment elles ont été construites, et comment les gérer une fois lancées.
          </p>
        </div>

        {/* Preuve — les projets */}
        <p className="text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-1" style={{ color: COLORS.accentSecondary }}>
          <Building2 size={13} /> Projets réels à l'appui
        </p>
        <div className="grid grid-cols-2 gap-2 mb-6">
          {PROJETS_REFERENCE.map((p) => (
            <div key={p.nom} className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <p className="text-sm font-semibold">{p.nom}</p>
              <p className="text-[11px] mt-0.5" style={{ color: COLORS.textMuted }}>{p.desc}</p>
            </div>
          ))}
        </div>

        {/* Ce que le programme couvre */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 rounded-xl p-3 flex flex-col items-center text-center gap-1" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <Lightbulb size={18} color={COLORS.accentPrimary} />
            <p className="text-[11px] font-semibold">D'où viennent les idées</p>
          </div>
          <div className="flex-1 rounded-xl p-3 flex flex-col items-center text-center gap-1" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <Target size={18} color={COLORS.accentPrimary} />
            <p className="text-[11px] font-semibold">Comment les construire</p>
          </div>
          <div className="flex-1 rounded-xl p-3 flex flex-col items-center text-center gap-1" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <TrendingUp size={18} color={COLORS.accentPrimary} />
            <p className="text-[11px] font-semibold">Les faire grandir</p>
          </div>
        </div>

        {/* Programme */}
        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: COLORS.accentSecondary }}>
          Programme
        </p>
        <div className="flex flex-col gap-2 mb-4">
          {PROGRAMME.map((m, i) => {
            const Icon = ICONES_TYPE[m.type];
            return (
              <button
                key={i}
                className="rounded-xl p-3 flex items-start gap-3 text-left"
                style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: COLORS.background }}>
                  <Icon size={16} color={COLORS.accentPrimary} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{m.titre}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: COLORS.textMuted }}>{m.desc}</p>
                  <p className="text-[10px] flex items-center gap-1 mt-1" style={{ color: COLORS.textMuted }}>
                    <Clock size={10} /> {m.duree}
                  </p>
                </div>
                {m.gratuit ? (
                  <PlayCircle size={18} color={COLORS.accentSecondary} className="flex-shrink-0" />
                ) : (
                  <Lock size={16} color={COLORS.textMuted} className="flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        <button
          className="w-full rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
          style={{ background: COLORS.accentPrimary, color: COLORS.background }}
        >
          <CheckCircle2 size={16} /> Rejoindre le programme complet
        </button>
      </main>
    </div>
  );
}
