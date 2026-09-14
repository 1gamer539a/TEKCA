"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Zap, Crown } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

export default function VentesFlash() {
  const router = useRouter();
  const COLORS = THEMES.clair;
  const [ventes, setVentes] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const charger = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const reponse = await fetch("/api/ventes-flash/actives", {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const data = await reponse.json();
      if (reponse.ok) setVentes(data.ventes || []);
      setChargement(false);
    };
    charger();
  }, []);

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold flex items-center gap-2"><Zap size={16} color={COLORS.accentPrimary} /> Ventes flash</span>
      </header>

      <main className="pt-20 pb-16 px-4 max-w-md mx-auto w-full">
        <div className="rounded-xl p-3 mb-4 flex items-center gap-2 text-xs" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <Crown size={16} color={COLORS.accentSecondary} className="flex-shrink-0" />
          <span style={{ color: COLORS.textMuted }}>Les abonnés Premium voient les ventes flash 12h avant tout le monde.</span>
        </div>

        {chargement && <p className="text-sm text-center" style={{ color: COLORS.textMuted }}>Chargement...</p>}
        {!chargement && ventes.length === 0 && (
          <p className="text-sm text-center" style={{ color: COLORS.textMuted }}>Aucune vente flash en cours pour le moment.</p>
        )}

        <div className="flex flex-col gap-3">
          {ventes.map((v) => {
            const reduction = Math.round((1 - Number(v.prix_flash) / Number(v.produits?.prix_base || 1)) * 100);
            const pasEncoreVisiblePourTous = new Date(v.date_debut_public) > new Date();
            return (
              <div key={v.id} className="rounded-xl p-4 flex items-center justify-between" style={{ background: COLORS.surface, border: `1px solid ${COLORS.accentPrimary}` }}>
                <div>
                  <p className="text-sm font-semibold">{v.produits?.nom}</p>
                  <p className="text-xs mt-1">
                    <span className="line-through" style={{ color: COLORS.textMuted }}>{Number(v.produits?.prix_base).toLocaleString()} FCFA</span>{" "}
                    <span className="font-bold" style={{ color: COLORS.accentPrimary }}>{Number(v.prix_flash).toLocaleString()} FCFA</span>
                  </p>
                  {pasEncoreVisiblePourTous && (
                    <p className="text-[10px] mt-1" style={{ color: COLORS.accentSecondary }}>Accès anticipé Premium</p>
                  )}
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: COLORS.accentPrimary, color: COLORS.background }}>
                  -{reduction}%
                </span>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
