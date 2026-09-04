"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Sun, Moon, Trophy, Calendar, Users, Coins, Gift,
  Lock, ChevronRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

const BADGES_INSCRIPTION = {
  libre: { label: "Inscription libre", icon: Users },
  payante: { label: "Inscription payante", icon: Coins },
  invitation: { label: "Sur invitation", icon: Lock },
};

export default function ListeTournois() {
  const router = useRouter();
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];
  const [filtre, setFiltre] = useState("Tous");
  const [tournois, setTournois] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const charger = async () => {
      setChargement(true);
      const { data, error } = await supabase
        .from("tournois")
        .select(`
          id, titre, jeu, type_recompense, montant_cash_prize, description_recompense,
          mode_inscription, frais_inscription, nb_places_max, date_debut,
          inscriptions_tournoi ( id )
        `)
        .in("statut", ["a_venir", "inscriptions_ouvertes", "en_cours"])
        .order("date_debut", { ascending: true });

      if (!error && data) {
        setTournois(
          data.map((t) => ({
            id: t.id,
            titre: t.titre,
            jeu: t.jeu,
            type: t.type_recompense,
            recompense: t.type_recompense === "cash_prize"
              ? `${Number(t.montant_cash_prize || 0).toLocaleString()} FCFA`
              : (t.description_recompense || "Récompenses en nature"),
            inscription: t.mode_inscription,
            frais: t.frais_inscription ? `${Number(t.frais_inscription).toLocaleString()} FCFA` : null,
            places: `${t.inscriptions_tournoi?.length || 0}/${t.nb_places_max || "—"}`,
            date: new Date(t.date_debut).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
          }))
        );
      }
      setChargement(false);
    };
    charger();
  }, []);

  const filtres = ["Tous", "Cash prize", "Récompenses", "Ouverts"];
  const tournoisFiltres = tournois.filter((t) => {
    if (filtre === "Tous") return true;
    if (filtre === "Cash prize") return t.type === "cash_prize";
    if (filtre === "Récompenses") return t.type === "nature_points";
    if (filtre === "Ouverts") return t.inscription !== "invitation";
    return true;
  });

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold flex items-center gap-1">
          <Trophy size={15} color={COLORS.accentPrimary} /> Tournois
        </span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <div className="fixed top-14 left-0 right-0 z-30 flex gap-2 px-4 py-2 overflow-x-auto" style={{ background: COLORS.background }}>
        {filtres.map((f) => (
          <button
            key={f}
            onClick={() => setFiltre(f)}
            className="text-xs px-3 py-1.5 rounded-full flex-shrink-0"
            style={{
              background: filtre === f ? COLORS.accentPrimary : COLORS.surface,
              color: filtre === f ? COLORS.background : COLORS.textMuted,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <main className="max-w-md mx-auto w-full px-4 pt-28 pb-10 flex flex-col gap-3">
        {chargement && (
          <p className="text-sm text-center py-16" style={{ color: COLORS.textMuted }}>Chargement des tournois...</p>
        )}
        {!chargement && tournoisFiltres.length === 0 && (
          <p className="text-sm text-center py-16" style={{ color: COLORS.textMuted }}>Aucun tournoi pour l'instant.</p>
        )}
        {tournoisFiltres.map((t) => {
          const BadgeInfo = BADGES_INSCRIPTION[t.inscription];
          return (
            <Link
              href={`/tournois/${t.id}`}
              key={t.id}
              className="rounded-2xl overflow-hidden text-left block"
              style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
            >
              <div className="h-24 flex items-center justify-center" style={{ background: COLORS.background }}>
                <Trophy size={26} color={COLORS.accentSecondary} />
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: COLORS.background, color: COLORS.accentSecondary, border: `1px solid ${COLORS.border}` }}>
                    {t.jeu}
                  </span>
                  <span className="text-[10px] flex items-center gap-1" style={{ color: COLORS.textMuted }}>
                    <Calendar size={10} /> {t.date}
                  </span>
                </div>
                <p className="text-sm font-bold">{t.titre}</p>
                <div className="flex items-center gap-1 mt-1">
                  {t.type === "cash_prize" ? <Coins size={13} color={COLORS.accentPrimary} /> : <Gift size={13} color={COLORS.accentPrimary} />}
                  <span className="text-sm font-semibold" style={{ color: COLORS.accentPrimary }}>{t.recompense}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] flex items-center gap-1" style={{ color: COLORS.textMuted }}>
                    <BadgeInfo.icon size={11} /> {BadgeInfo.label}{t.frais ? ` · ${t.frais}` : ""}
                  </span>
                  <span className="text-[11px] flex items-center gap-1" style={{ color: COLORS.textMuted }}>
                    <Users size={11} /> {t.places} <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </main>
    </div>
  );
}
