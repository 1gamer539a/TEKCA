"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Sun, Moon, Heart, Trash2, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

/*
  Correspond à la table `favoris` (user_id, produit_id) du schéma,
  jointe à `produits` + `vendeurs` pour l'affichage.
*/
export default function Favoris() {
  const router = useRouter();
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];
  const [favoris, setFavoris] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const charger = async () => {
      setChargement(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setChargement(false); return; }

      const { data, error } = await supabase
        .from("favoris")
        .select(`
          id,
          produits ( id, nom, prix_base, vendeurs ( nom_boutique ) )
        `)
        .eq("user_id", user.id)
        .order("date_creation", { ascending: false });

      if (!error && data) {
        setFavoris(
          data
            .filter((f) => f.produits)
            .map((f) => ({
              favoriId: f.id,
              produitId: f.produits.id,
              titre: f.produits.nom,
              prix: `${Number(f.produits.prix_base).toLocaleString()} FCFA`,
              vendeur: f.produits.vendeurs?.nom_boutique || "—",
            }))
        );
      }
      setChargement(false);
    };
    charger();
  }, []);

  const retirer = async (favoriId) => {
    setFavoris((prev) => prev.filter((f) => f.favoriId !== favoriId));
    await supabase.from("favoris").delete().eq("id", favoriId);
  };

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold flex items-center gap-1">
          <Heart size={15} color={COLORS.accentPrimary} /> Mes favoris
        </span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-10">
        {chargement && (
          <p className="text-sm text-center py-16" style={{ color: COLORS.textMuted }}>Chargement...</p>
        )}
        {!chargement && favoris.length === 0 ? (
          <div className="flex flex-col items-center pt-20 gap-2">
            <Heart size={32} color={COLORS.textMuted} />
            <p className="text-sm" style={{ color: COLORS.textMuted }}>Aucun favori pour l'instant.</p>
            <p className="text-xs text-center max-w-xs" style={{ color: COLORS.textMuted }}>
              Appuie sur le cœur ♥ sur un produit ou une annonce pour le retrouver ici.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {favoris.map((f) => (
              <div key={f.favoriId} className="rounded-xl p-3 flex items-center gap-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <Link href={`/produit/${f.produitId}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-14 h-14 rounded-lg flex-shrink-0" style={{ background: COLORS.background }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{f.titre}</p>
                    <p className="text-[11px]" style={{ color: COLORS.textMuted }}>{f.vendeur}</p>
                    <p className="text-sm font-bold mt-0.5" style={{ color: COLORS.accentPrimary }}>{f.prix}</p>
                  </div>
                </Link>
                <div className="flex flex-col items-center gap-2">
                  <button aria-label="Ajouter au panier">
                    <ShoppingCart size={17} color={COLORS.accentPrimary} />
                  </button>
                  <button onClick={() => retirer(f.favoriId)} aria-label="Retirer des favoris">
                    <Trash2 size={16} color={COLORS.textMuted} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
