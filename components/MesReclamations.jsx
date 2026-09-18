"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Sun, Moon, MessageCircle, Clock, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

const LABELS_STATUT = {
  ouvert: { label: "En attente de réponse", color: "#B23A2E" },
  en_cours: { label: "Réponse reçue", color: "#C99A3A" },
  resolu: { label: "Résolu", color: "#3A8A5C" },
};

/*
  CORRECTIF — une réclamation envoyée via "Nous contacter" ou une
  vérification d'identité disparaissait ensuite dans la nature côté
  client : aucun endroit pour la retrouver ni voir une éventuelle
  réponse de l'équipe. Cette page liste toutes les réclamations du
  compte connecté, avec le fil complet accessible en cliquant dessus.
*/
export default function MesReclamations() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const COLORS = THEMES[theme];
  const [reclamations, setReclamations] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const charger = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setChargement(false); return; }
      const { data } = await supabase
        .from("contacts_support")
        .select("id, motif, message, statut, date_creation")
        .eq("client_id", user.id)
        .order("date_creation", { ascending: false });
      setReclamations(data || []);
      setChargement(false);
    };
    charger();
  }, []);

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">Mes réclamations</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-10">
        {chargement && <p className="text-xs text-center py-10" style={{ color: COLORS.textMuted }}>Chargement...</p>}
        {!chargement && reclamations.length === 0 && (
          <p className="text-sm text-center py-10" style={{ color: COLORS.textMuted }}>Aucune réclamation envoyée pour l'instant.</p>
        )}
        {reclamations.map((r) => {
          const statutInfo = LABELS_STATUT[r.statut] || LABELS_STATUT.ouvert;
          return (
            <Link
              key={r.id}
              href={`/reclamations/${r.id}`}
              className="block rounded-xl p-3 mb-2"
              style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: COLORS.background, color: statutInfo.color }}>
                  {statutInfo.label}
                </span>
                <span className="text-[10px]" style={{ color: COLORS.textMuted }}>
                  {new Date(r.date_creation).toLocaleDateString("fr-FR")}
                </span>
              </div>
              <p className="text-xs line-clamp-2" style={{ color: COLORS.textPrimary }}>{r.message}</p>
              <p className="text-[10.5px] mt-1.5 flex items-center gap-1" style={{ color: COLORS.accentPrimary }}>
                <MessageCircle size={11} /> Voir le fil
              </p>
            </Link>
          );
        })}
      </main>
    </div>
  );
}
