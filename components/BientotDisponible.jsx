"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock3 } from "lucide-react";

const COLORS = { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" };

/*
  Écran générique réutilisé partout où une section n'est pas encore
  prête (Formation, Événements pour l'instant) : bloque la navigation
  vers le vrai contenu sans avoir à supprimer les pages existantes,
  qui restent en place pour être réactivées plus tard.
*/
export default function BientotDisponible({ titre }) {
  const router = useRouter();
  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-base">{titre}</h1>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-24 flex flex-col items-center text-center gap-3" style={{ minHeight: "70vh", justifyContent: "center" }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: COLORS.surface }}>
          <Clock3 size={28} color={COLORS.accentPrimary} />
        </div>
        <p className="font-bold text-lg">Bientôt disponible</p>
        <p className="text-sm" style={{ color: COLORS.textMuted }}>
          Cette section arrive prochainement sur TEKÇA. Reviens un peu plus tard !
        </p>
      </main>
    </div>
  );
}
