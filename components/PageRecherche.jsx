"use client";

import React, { useState } from "react";
import { ArrowLeft, Search, Sun, Moon, Store, X, Clock } from "lucide-react";
import { useRouter } from "next/navigation";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

const RECHERCHES_RECENTES = ["Free Fire diamants", "Casque gaming", "Hoodie esports"];
const SUGGESTIONS_POPULAIRES = ["Free Fire", "PUBG Mobile", "Netflix", "Manette PS5", "Snapchat+"];

const TOUS_LES_ITEMS = [
  { type: "produit", nom: "Diamants Free Fire 520", categorie: "Recharge", prix: "5 000 FCFA" },
  { type: "produit", nom: "Casque Gaming Pro RGB", categorie: "Accessoire", prix: "18 000 FCFA" },
  { type: "produit", nom: "Hoodie Guilde Esports", categorie: "Vêtement", prix: "25 000 FCFA" },
  { type: "produit", nom: "Netflix Premium 1 mois", categorie: "Abonnement", prix: "6 000 FCFA" },
  { type: "vendeur", nom: "Kivu Gaming Store", categorie: "Accessoires · Vêtements", note: "4.7 ★" },
];

export default function PageRecherche() {
  const router = useRouter();
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];
  const [requete, setRequete] = useState("");

  const resultats = requete.trim()
    ? TOUS_LES_ITEMS.filter((i) => i.nom.toLowerCase().includes(requete.toLowerCase()))
    : [];

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center gap-2 px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <div className="flex-1 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <Search size={16} color={COLORS.textMuted} />
          <input
            autoFocus
            value={requete}
            onChange={(e) => setRequete(e.target.value)}
            placeholder="Rechercher un produit, un jeu, un vendeur..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: COLORS.textPrimary }}
          />
          {requete && (
            <button onClick={() => setRequete("")} aria-label="Effacer"><X size={14} color={COLORS.textMuted} /></button>
          )}
        </div>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-10">
        {!requete && (
          <>
            <section className="mb-5">
              <p className="text-xs font-semibold mb-2" style={{ color: COLORS.textMuted }}>Recherches récentes</p>
              <div className="flex flex-col gap-2">
                {RECHERCHES_RECENTES.map((r) => (
                  <button key={r} onClick={() => setRequete(r)} className="flex items-center gap-2 text-sm py-1">
                    <Clock size={14} color={COLORS.textMuted} />
                    <span style={{ color: COLORS.textPrimary }}>{r}</span>
                  </button>
                ))}
              </div>
            </section>
            <section>
              <p className="text-xs font-semibold mb-2" style={{ color: COLORS.textMuted }}>Populaire en ce moment</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS_POPULAIRES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setRequete(s)}
                    className="text-xs px-3 py-1.5 rounded-full"
                    style={{ background: COLORS.surface, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {requete && (
          <div className="flex flex-col gap-2">
            <p className="text-xs" style={{ color: COLORS.textMuted }}>{resultats.length} résultat(s) pour "{requete}"</p>
            {resultats.map((r, i) => (
              <button
                key={i}
                onClick={() => router.push(r.type === "vendeur" ? `/vendeur/${encodeURIComponent(r.nom)}` : `/produit/${encodeURIComponent(r.nom)}`)}
                className="rounded-xl p-3 flex items-center gap-3 text-left w-full"
                style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
              >
                <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: COLORS.background }}>
                  {r.type === "vendeur" ? <Store size={18} color={COLORS.accentPrimary} /> : <div className="w-5 h-5 rounded" style={{ background: COLORS.accentSecondary }} />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{r.nom}</p>
                  <p className="text-[11px]" style={{ color: COLORS.textMuted }}>{r.categorie}</p>
                </div>
                <p className="text-sm font-bold" style={{ color: COLORS.accentPrimary }}>{r.prix || r.note}</p>
              </button>
            ))}
            {resultats.length === 0 && (
              <p className="text-sm text-center py-10" style={{ color: COLORS.textMuted }}>Aucun résultat trouvé.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
