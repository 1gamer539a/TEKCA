"use client";

import React, { useState } from "react";
import {
  ArrowLeft, Sun, Moon, MapPin, Phone, MessageCircle, Store,
  Calendar, Heart
} from "lucide-react";
import { useRouter } from "next/navigation";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

const VENDEUR = {
  nom: "Josué K.",
  ville: "Brazzaville",
  telephone: "+242 06 000 00 00",
  depuis: "Membre depuis mars 2026",
  niveau: "vendeur_simple",
};

const ANNONCES_VENDEUR = [
  { id: 1, titre: "Manette PS4 occasion", prix: "12 000 FCFA" },
  { id: 2, titre: "T-shirt guilde vintage", prix: "4 000 FCFA" },
  { id: 3, titre: "Casque filaire", prix: "6 000 FCFA" },
  { id: 4, titre: "Sacoche gaming", prix: "7 500 FCFA" },
];

export default function ProfilVendeurMarche() {
  const router = useRouter();
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];
  const [favoris, setFavoris] = useState([]);

  const toggleFavori = (id) =>
    setFavoris((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">Profil vendeur</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-10">
        {/* En-tête profil */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <Store size={24} color={COLORS.accentPrimary} />
          </div>
          <div>
            <p className="font-bold text-base">{VENDEUR.nom}</p>
            <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: COLORS.textMuted }}>
              <MapPin size={11} /> {VENDEUR.ville}
            </p>
            <p className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: COLORS.textMuted }}>
              <Calendar size={11} /> {VENDEUR.depuis}
            </p>
          </div>
        </div>

        <div className="rounded-xl px-3 py-2 mb-4 text-[11px]" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.textMuted }}>
          Profil du Marché — vendeur particulier, biens physiques uniquement.
        </div>

        <div className="flex gap-3 mb-6">
          <button
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: COLORS.accentPrimary, color: COLORS.background }}
          >
            <MessageCircle size={16} /> Discuter
          </button>
          <button
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
            style={{ border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary }}
          >
            <Phone size={16} /> Appeler
          </button>
        </div>

        {/* Annonces */}
        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: COLORS.accentPrimary }}>
          Ses annonces ({ANNONCES_VENDEUR.length})
        </p>
        <div className="grid grid-cols-2 gap-3">
          {ANNONCES_VENDEUR.map((a) => (
            <div key={a.id} className="rounded-xl overflow-hidden relative" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <div className="h-24" style={{ background: COLORS.background }} />
              <button
                onClick={() => toggleFavori(a.id)}
                aria-label="Ajouter aux favoris"
                className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: "rgba(11,10,10,0.6)" }}
              >
                <Heart size={14} color={favoris.includes(a.id) ? COLORS.accentPrimary : COLORS.textPrimary} fill={favoris.includes(a.id) ? COLORS.accentPrimary : "none"} />
              </button>
              <div className="p-2.5">
                <p className="text-xs font-semibold leading-tight">{a.titre}</p>
                <p className="text-sm font-bold mt-1" style={{ color: COLORS.accentPrimary }}>{a.prix}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
