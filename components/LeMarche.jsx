"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Sun, Moon, MapPin, Search, SlidersHorizontal, Store, Plus
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

import { PAYS_SEBPAY } from "../lib/pays";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

/*
  CORRECTIF — Le Marché était filtrable par une liste figée de 4
  villes congolaises (Brazzaville, Pointe-Noire, Dolisie, Owando),
  reflet de la restriction "pays: CG" côté inscription vendeur qu'on
  vient d'ouvrir aux 19 pays SebPay (voir DevenirVendeur.jsx). Le
  filtre passe donc du niveau ville (une liste par pays serait
  ingérable ici) au niveau pays ; la ville reste affichée telle que
  saisie par le vendeur sur chaque annonce, sans filtre dédié dessus.
*/
const PAYS_FILTRE = [{ code: "TOUS", nom: "Tous" }, ...PAYS_SEBPAY];

/*
  Correspond à une requête sur `produits` jointe à `vendeurs` où
  vendeurs.niveau = 'vendeur_simple'. Chaque annonce vient d'un
  utilisateur différent (pas de boutique dédiée) — d'où la grille en
  colonnes de style masonry : les cartes s'adaptent à la hauteur de
  chaque photo au lieu d'une grille rigide uniforme, ce qui donne un
  rendu plus "vrai marché" que des cases toutes identiques.
*/

export default function LeMarche() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // CORRECTIF — le lien "Vêtements" renvoyait vers /marche sans
  // filtre, donc mélangé avec les accessoires. /marche?type=vetement
  // pré-filtre maintenant directement sur la sous-catégorie demandée.
  const typeInitial = searchParams.get("type") || "TOUS";
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];
  const [pays, setPays] = useState("TOUS");
  const [type, setType] = useState(typeInitial);
  const [recherche, setRecherche] = useState("");
  const [annonces, setAnnonces] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const chargerAnnonces = async () => {
      setChargement(true);
      const { data, error } = await supabase
        .from("produits")
        .select(`
          id, nom, prix_base, images, type,
          vendeurs!inner ( nom_boutique, ville, pays, niveau )
        `)
        .eq("vendeurs.niveau", "vendeur_simple")
        .eq("statut_validation", "valide")
        .order("date_creation", { ascending: false });

      if (!error && data) {
        setAnnonces(
          data.map((p) => ({
            id: p.id,
            titre: p.nom,
            prix: `${Number(p.prix_base).toLocaleString()} FCFA`,
            ville: p.vendeurs?.ville || "—",
            pays: p.vendeurs?.pays || "CG",
            type: p.type,
            vendeur: p.vendeurs?.nom_boutique || "—",
            hauteur: 140 + ((p.id.charCodeAt(0) || 0) % 6) * 15, // variation visuelle stable
            image: p.images?.[0] || null,
          }))
        );
      }
      setChargement(false);
    };
    chargerAnnonces();
  }, []);

  const filtrees = annonces.filter((a) => {
    const matchPays = pays === "TOUS" || a.pays === pays;
    const matchType = type === "TOUS" || a.type === type;
    const matchRecherche = a.titre.toLowerCase().includes(recherche.toLowerCase());
    return matchPays && matchType && matchRecherche;
  });

  // Répartition dynamique en 2 colonnes façon masonry (par hauteur cumulée, pas par index pair/impair)
  const colonnes = [[], []];
  const hauteurs = [0, 0];
  filtrees.forEach((a) => {
    const cible = hauteurs[0] <= hauteurs[1] ? 0 : 1;
    colonnes[cible].push(a);
    hauteurs[cible] += a.hauteur;
  });

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold flex items-center gap-1">
          <Store size={15} color={COLORS.accentPrimary} /> Le Marché
        </span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <div className="fixed top-14 left-0 right-0 z-30 px-4 py-2 flex flex-col gap-2" style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <Search size={15} color={COLORS.textMuted} />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Chercher une annonce..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: COLORS.textPrimary }}
          />
          <SlidersHorizontal size={15} color={COLORS.accentSecondary} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {PAYS_FILTRE.map((p) => (
            <button
              key={p.code}
              onClick={() => setPays(p.code)}
              className="text-xs px-3 py-1.5 rounded-full flex-shrink-0 flex items-center gap-1"
              style={{
                background: pays === p.code ? COLORS.accentPrimary : COLORS.surface,
                color: pays === p.code ? COLORS.background : COLORS.textMuted,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              {p.code !== "TOUS" && <MapPin size={11} />} {p.nom}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-md mx-auto w-full px-4 pt-32 pb-24">
        <p className="text-xs mb-3" style={{ color: COLORS.textMuted }}>{filtrees.length} annonces</p>

        {/* Grille dynamique — 2 colonnes, hauteur variable par carte */}
        <div className="flex gap-3">
          {colonnes.map((colonne, ci) => (
            <div key={ci} className="flex-1 flex flex-col gap-3">
              {colonne.map((a) => (
                <Link
                  href={`/produit/${a.id}`}
                  key={a.id}
                  className="rounded-xl overflow-hidden block"
                  style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
                >
                  <div style={{ height: a.hauteur, background: a.image ? `url(${a.image}) center/cover` : COLORS.background }} />
                  <div className="p-2.5">
                    <p className="text-xs font-semibold leading-tight" style={{ color: COLORS.textPrimary }}>{a.titre}</p>
                    <p className="text-sm font-bold mt-1" style={{ color: COLORS.accentPrimary }}>{a.prix}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] flex items-center gap-0.5" style={{ color: COLORS.textMuted }}>
                        <MapPin size={9} /> {a.ville}
                      </span>
                      <span className="text-[10px]" style={{ color: COLORS.textMuted }}>{a.vendeur}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ))}
        </div>

        {chargement && (
          <p className="text-sm text-center py-16" style={{ color: COLORS.textMuted }}>Chargement des annonces...</p>
        )}
        {!chargement && filtrees.length === 0 && (
          <p className="text-sm text-center py-16" style={{ color: COLORS.textMuted }}>Aucune annonce trouvée.</p>
        )}
      </main>

      {/* Bouton flottant "Publier une annonce" */}
      <Link
        href="/produit/nouveau"
        className="fixed bottom-6 right-4 z-40 rounded-full px-4 py-3 flex items-center gap-2 font-semibold text-sm shadow-lg"
        style={{ background: COLORS.accentPrimary, color: COLORS.background }}
      >
        <Plus size={18} /> Vendre
      </Link>
    </div>
  );
}
