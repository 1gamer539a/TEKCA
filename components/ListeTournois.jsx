"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Sun, Moon, Trophy, Calendar, Users, Coins, Gift,
  Lock, ChevronRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";
import { useLanguage } from "../lib/i18n/LanguageContext";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

const CLES_INSCRIPTION = {
  libre: { cle: "tournois.inscriptionLibre", icon: Users },
  payante: { cle: "tournois.inscriptionPayante", icon: Coins },
  invitation: { cle: "tournois.surInvitation", icon: Lock },
};

export default function ListeTournois() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const COLORS = THEMES[theme];
  const [filtre, setFiltre] = useState("tous");
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
          data.map((tour) => ({
            id: tour.id,
            titre: tour.titre,
            jeu: tour.jeu,
            type: tour.type_recompense,
            recompense: tour.type_recompense === "cash_prize"
              ? `${Number(tour.montant_cash_prize || 0).toLocaleString()} FCFA`
              : (tour.description_recompense || t("tournois.recompensesNature")),
            inscription: tour.mode_inscription,
            frais: tour.frais_inscription ? `${Number(tour.frais_inscription).toLocaleString()} FCFA` : null,
            places: `${tour.inscriptions_tournoi?.length || 0}/${tour.nb_places_max || "—"}`,
            date: new Date(tour.date_debut).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
          }))
        );
      }
      setChargement(false);
    };
    charger();
  }, []);

  const filtres = [
    { valeur: "tous", cle: "common.tous" },
    { valeur: "cash_prize", cle: "tournois.filtreCashPrize" },
    { valeur: "recompenses", cle: "tournois.filtreRecompenses" },
    { valeur: "ouverts", cle: "tournois.filtreOuverts" },
  ];
  const tournoisFiltres = tournois.filter((tour) => {
    if (filtre === "tous") return true;
    if (filtre === "cash_prize") return tour.type === "cash_prize";
    if (filtre === "recompenses") return tour.type === "nature_points";
    if (filtre === "ouverts") return tour.inscription !== "invitation";
    return true;
  });

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label={t("common.retour")}><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold flex items-center gap-1">
          <Trophy size={15} color={COLORS.accentPrimary} /> {t("nav.tournois")}
        </span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label={t("common.changerTheme")}>
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <div className="fixed top-14 left-0 right-0 z-30 flex gap-2 px-4 py-2 overflow-x-auto" style={{ background: COLORS.background }}>
        {filtres.map((f) => (
          <button
            key={f.valeur}
            onClick={() => setFiltre(f.valeur)}
            className="text-xs px-3 py-1.5 rounded-full flex-shrink-0"
            style={{
              background: filtre === f.valeur ? COLORS.accentPrimary : COLORS.surface,
              color: filtre === f.valeur ? COLORS.background : COLORS.textMuted,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            {t(f.cle)}
          </button>
        ))}
      </div>

      <main className="max-w-md mx-auto w-full px-4 pt-28 pb-10 flex flex-col gap-3">
        {chargement && (
          <p className="text-sm text-center py-16" style={{ color: COLORS.textMuted }}>{t("tournois.chargementEvenements")}</p>
        )}
        {!chargement && tournoisFiltres.length === 0 && (
          <p className="text-sm text-center py-16" style={{ color: COLORS.textMuted }}>{t("tournois.aucunEvenement")}</p>
        )}
        {tournoisFiltres.map((tour) => {
          const BadgeInfo = CLES_INSCRIPTION[tour.inscription];
          return (
            <Link
              href={`/tournois/${tour.id}`}
              key={tour.id}
              className="rounded-2xl overflow-hidden text-left block"
              style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
            >
              <div className="h-24 flex items-center justify-center" style={{ background: COLORS.background }}>
                <Trophy size={26} color={COLORS.accentSecondary} />
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: COLORS.background, color: COLORS.accentSecondary, border: `1px solid ${COLORS.border}` }}>
                    {tour.jeu}
                  </span>
                  <span className="text-[10px] flex items-center gap-1" style={{ color: COLORS.textMuted }}>
                    <Calendar size={10} /> {tour.date}
                  </span>
                </div>
                <p className="text-sm font-bold">{tour.titre}</p>
                <div className="flex items-center gap-1 mt-1">
                  {tour.type === "cash_prize" ? <Coins size={13} color={COLORS.accentPrimary} /> : <Gift size={13} color={COLORS.accentPrimary} />}
                  <span className="text-sm font-semibold" style={{ color: COLORS.accentPrimary }}>{tour.recompense}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] flex items-center gap-1" style={{ color: COLORS.textMuted }}>
                    <BadgeInfo.icon size={11} /> {t(BadgeInfo.cle)}{tour.frais ? ` · ${tour.frais}` : ""}
                  </span>
                  <span className="text-[11px] flex items-center gap-1" style={{ color: COLORS.textMuted }}>
                    <Users size={11} /> {tour.places} <ChevronRight size={12} />
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
