"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Sun, Moon, Package, ChevronRight, Star, RotateCcw
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

function StatutBadge({ COLORS, statut }) {
  const map = {
    en_attente: { label: "En attente", color: COLORS.textMuted },
    paye: { label: "Payé", color: COLORS.accentSecondary },
    expedie: { label: "Expédié", color: COLORS.accentPrimary },
    livre: { label: "Livré", color: "#3A8A5C" },
    annule: { label: "Annulé", color: "#B23A2E" },
  };
  const s = map[statut];
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: COLORS.background, color: s.color, border: `1px solid ${COLORS.border}` }}>
      {s.label}
    </span>
  );
}

export default function HistoriqueCommandes() {
  const router = useRouter();
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];
  const [filtre, setFiltre] = useState("Toutes");
  const [commandes, setCommandes] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const charger = async () => {
      setChargement(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setChargement(false); return; }

      const { data, error } = await supabase
        .from("commandes")
        .select(`
          id, montant_total, statut, date_creation,
          vendeurs ( nom_boutique ),
          produits ( nom )
        `)
        .eq("client_id", user.id)
        .order("date_creation", { ascending: false });

      if (!error && data) {
        setCommandes(
          data.map((c) => ({
            id: c.id,
            vendeur: c.vendeurs?.nom_boutique || "—",
            article: c.produits?.nom || "—",
            montant: `${Number(c.montant_total).toLocaleString()} FCFA`,
            statut: c.statut,
            date: new Date(c.date_creation).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
          }))
        );
      }
      setChargement(false);
    };
    charger();
  }, []);

  const filtres = ["Toutes", "En cours", "Livrées", "Annulées"];
  const enCours = ["en_attente", "paye", "expedie"];

  const commandesFiltrees = commandes.filter((c) => {
    if (filtre === "Toutes") return true;
    if (filtre === "En cours") return enCours.includes(c.statut);
    if (filtre === "Livrées") return c.statut === "livre";
    if (filtre === "Annulées") return c.statut === "annule";
    return true;
  });

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">Mes commandes</span>
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
          <p className="text-sm text-center py-16" style={{ color: COLORS.textMuted }}>Chargement...</p>
        )}
        {!chargement && commandesFiltrees.length === 0 && (
          <div className="flex flex-col items-center pt-16 gap-2">
            <Package size={28} color={COLORS.textMuted} />
            <p className="text-sm" style={{ color: COLORS.textMuted }}>Aucune commande ici.</p>
          </div>
        )}
        {commandesFiltrees.map((c) => (
          <div key={c.id} className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold" style={{ color: COLORS.accentSecondary }}>{c.id}</span>
              <StatutBadge COLORS={COLORS} statut={c.statut} />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg flex-shrink-0" style={{ background: COLORS.background }} />
              <div className="flex-1">
                <p className="text-sm font-semibold">{c.article}</p>
                <p className="text-[11px]" style={{ color: COLORS.textMuted }}>{c.vendeur} · {c.date}</p>
              </div>
              <p className="text-sm font-bold" style={{ color: COLORS.accentPrimary }}>{c.montant}</p>
            </div>
            <div className="flex items-center gap-3 mt-3">
              {c.statut === "livre" && (
                <button className="text-[11px] font-semibold flex items-center gap-1" style={{ color: COLORS.accentPrimary }}>
                  <Star size={12} /> Laisser un avis
                </button>
              )}
              {c.statut === "annule" && (
                <button className="text-[11px] font-semibold flex items-center gap-1" style={{ color: COLORS.accentSecondary }}>
                  <RotateCcw size={12} /> Recommander
                </button>
              )}
              <Link href={`/commandes/${c.id}/suivi`} className="text-[11px] flex items-center gap-1 ml-auto" style={{ color: COLORS.textMuted }}>
                Détails <ChevronRight size={12} />
              </Link>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
