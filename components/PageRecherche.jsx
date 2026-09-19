"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Search, Sun, Moon, Store, X, Clock, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

const SUGGESTIONS_POPULAIRES = ["Free Fire", "PUBG Mobile", "Netflix", "Manette PS5", "Snapchat+"];
const CLE_RECHERCHES_RECENTES = "tekca_recherches_recentes";
const LIBELLES_TYPE = { accessoire: "Accessoire", vetement: "Vêtement", recharge_jeu: "Recharge", abonnement_service: "Abonnement" };

/*
  CORRECTIF — cette page était entièrement en données inventées
  (TOUS_LES_ITEMS codé en dur : "Casque Gaming Pro RGB", "Kivu Gaming
  Store"...) et renvoyait donc les mêmes faux résultats pour n'importe
  quelle recherche pertinente. Elle interroge maintenant réellement
  `produits` et `vendeurs`, et les recherches récentes sont gardées
  dans le navigateur (pas de table dédiée pour ça).
*/
export default function PageRecherche() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const COLORS = THEMES[theme];
  const [requete, setRequete] = useState("");
  const [resultats, setResultats] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [recherchesRecentes, setRecherchesRecentes] = useState([]);

  useEffect(() => {
    try {
      const stockees = JSON.parse(window.localStorage.getItem(CLE_RECHERCHES_RECENTES) || "[]");
      setRecherchesRecentes(stockees);
    } catch {
      setRecherchesRecentes([]);
    }
  }, []);

  const memoriserRecherche = (terme) => {
    const nouvelles = [terme, ...recherchesRecentes.filter((r) => r !== terme)].slice(0, 5);
    setRecherchesRecentes(nouvelles);
    try { window.localStorage.setItem(CLE_RECHERCHES_RECENTES, JSON.stringify(nouvelles)); } catch {}
  };

  useEffect(() => {
    const q = requete.trim();
    if (!q) { setResultats([]); return; }

    const minuteur = setTimeout(async () => {
      setChargement(true);
      const [{ data: produits }, { data: vendeurs }] = await Promise.all([
        supabase
          .from("produits")
          .select("id, nom, prix_base, type, vendeurs ( sous_domaine, niveau )")
          .eq("statut_validation", "valide")
          .ilike("nom", `%${q}%`)
          .limit(15),
        supabase
          .from("vendeurs")
          .select("id, nom_boutique, sous_domaine, niveau, note_moyenne, ville, pays")
          .eq("statut", "valide")
          .ilike("nom_boutique", `%${q}%`)
          .limit(10),
      ]);

      const resProduits = (produits || []).map((p) => ({
        type: "produit",
        id: p.id,
        nom: p.nom,
        sousLibelle: LIBELLES_TYPE[p.type] || p.type,
        valeur: `${Number(p.prix_base).toLocaleString()} FCFA`,
        href: `/produit/${p.id}`,
      }));
      const resVendeurs = (vendeurs || []).map((v) => ({
        type: "vendeur",
        id: v.id,
        nom: v.nom_boutique,
        sousLibelle: v.niveau === "revendeur_officiel" ? "Boutique officielle" : `Vendeur du Marché${v.ville ? ` · ${v.ville}` : ""}`,
        valeur: v.note_moyenne ? `${v.note_moyenne} ★` : null,
        href: v.niveau === "revendeur_officiel" ? `/vendeur/${v.sous_domaine}` : `/marche/vendeur/${v.id}`,
      }));

      setResultats([...resProduits, ...resVendeurs]);
      setChargement(false);
    }, 300);

    return () => clearTimeout(minuteur);
  }, [requete]);

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
            onBlur={() => requete.trim() && memoriserRecherche(requete.trim())}
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
            {recherchesRecentes.length > 0 && (
              <section className="mb-5">
                <p className="text-xs font-semibold mb-2" style={{ color: COLORS.textMuted }}>Recherches récentes</p>
                <div className="flex flex-col gap-2">
                  {recherchesRecentes.map((r) => (
                    <button key={r} onClick={() => setRequete(r)} className="flex items-center gap-2 text-sm py-1">
                      <Clock size={14} color={COLORS.textMuted} />
                      <span style={{ color: COLORS.textPrimary }}>{r}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            <section>
              <p className="text-xs font-semibold mb-2" style={{ color: COLORS.textMuted }}>Suggestions</p>
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
            {chargement ? (
              <p className="text-xs flex items-center gap-1.5 py-4" style={{ color: COLORS.textMuted }}>
                <Loader2 size={13} className="animate-spin" /> Recherche...
              </p>
            ) : (
              <p className="text-xs" style={{ color: COLORS.textMuted }}>{resultats.length} résultat(s) pour "{requete}"</p>
            )}
            {resultats.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => { memoriserRecherche(requete.trim()); router.push(r.href); }}
                className="rounded-xl p-3 flex items-center gap-3 text-left w-full"
                style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
              >
                <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: COLORS.background }}>
                  {r.type === "vendeur" ? <Store size={18} color={COLORS.accentPrimary} /> : <div className="w-5 h-5 rounded" style={{ background: COLORS.accentSecondary }} />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{r.nom}</p>
                  <p className="text-[11px]" style={{ color: COLORS.textMuted }}>{r.sousLibelle}</p>
                </div>
                {r.valeur && <p className="text-sm font-bold" style={{ color: COLORS.accentPrimary }}>{r.valeur}</p>}
              </button>
            ))}
            {!chargement && resultats.length === 0 && (
              <p className="text-sm text-center py-10" style={{ color: COLORS.textMuted }}>Aucun résultat trouvé.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
