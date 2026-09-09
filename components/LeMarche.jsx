"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Sun, Moon, MapPin, Search, SlidersHorizontal, Store, Plus, Globe2, ChevronRight
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

import { PAYS_SEBPAY, drapeauPourPays } from "../lib/pays";
import { villesPourPays } from "../lib/villes";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

const PAYS_FILTRE = [{ code: "TOUS", nom: "Tous", drapeau: "🌍" }, ...PAYS_SEBPAY];

/*
  Correspond à une requête sur `produits` jointe à `vendeurs` où
  vendeurs.niveau = 'vendeur_simple'. Chaque annonce vient d'un
  utilisateur différent (pas de boutique dédiée) — d'où la grille en
  colonnes de style masonry : les cartes s'adaptent à la hauteur de
  chaque photo au lieu d'une grille rigide uniforme, ce qui donne un
  rendu plus "vrai marché" que des cases toutes identiques.

  Écran d'accueil du Marché : avant de voir les annonces, l'acheteur
  choisit son pays puis sa ville (étapes "pays"/"ville" ci-dessous),
  ce qui met en avant les vendeurs locaux avec un badge de proximité.
  "Accéder au Marché Grand Public" saute ce filtre et affiche tout,
  avec un filtre pays disponible dans la barre supérieure pour
  changer d'avis à tout moment.
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

  // etapeGeo : "pays" (grille de pays) -> "ville" (sous-grille de
  // villes) -> "marche" (liste des annonces). "Marché Grand Public"
  // saute directement à "marche" avec grandPublic=true.
  const [etapeGeo, setEtapeGeo] = useState(typeInitial !== "TOUS" ? "marche" : "pays");
  const [grandPublic, setGrandPublic] = useState(typeInitial !== "TOUS");
  const [paysChoisi, setPaysChoisi] = useState(null);
  const [villeChoisie, setVilleChoisie] = useState(null);

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
          vendeurs!inner ( id, nom_boutique, ville, pays, niveau, statut )
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
            vendeurId: p.vendeurs?.id || null,
            verifie: p.vendeurs?.statut === "valide",
            hauteur: 140 + ((p.id.charCodeAt(0) || 0) % 6) * 15, // variation visuelle stable
            image: p.images?.[0] || null,
          }))
        );
      }
      setChargement(false);
    };
    chargerAnnonces();
  }, []);

  // Une fois pays+ville choisis (mode local, pas "grand public"), le
  // filtre pays de la barre du haut se cale automatiquement dessus —
  // l'utilisateur peut ensuite le changer librement via les pastilles.
  useEffect(() => {
    if (paysChoisi && !grandPublic) setPays(paysChoisi);
  }, [paysChoisi, grandPublic]);

  const filtrees = annonces.filter((a) => {
    const matchPays = pays === "TOUS" || a.pays === pays;
    const matchType = type === "TOUS" || a.type === type;
    const matchRecherche = a.titre.toLowerCase().includes(recherche.toLowerCase());
    return matchPays && matchType && matchRecherche;
  });

  // Priorité aux vendeurs de la ville choisie (mode local) — tri, pas
  // exclusion : le reste du pays reste visible juste après, plutôt
  // que de cacher des annonces sur la seule foi d'un champ ville
  // saisi librement par chaque vendeur (orthographe non garantie).
  const villeNormalisee = (v) => (v || "").trim().toLowerCase();
  const triees = !grandPublic && villeChoisie
    ? [...filtrees].sort((a, b) => {
        const aLocal = villeNormalisee(a.ville) === villeNormalisee(villeChoisie) ? 0 : 1;
        const bLocal = villeNormalisee(b.ville) === villeNormalisee(villeChoisie) ? 0 : 1;
        return aLocal - bLocal;
      })
    : filtrees;

  // Répartition dynamique en 2 colonnes façon masonry (par hauteur cumulée, pas par index pair/impair)
  const colonnes = [[], []];
  const hauteurs = [0, 0];
  triees.forEach((a) => {
    const cible = hauteurs[0] <= hauteurs[1] ? 0 : 1;
    colonnes[cible].push(a);
    hauteurs[cible] += a.hauteur;
  });

  const villesDisponibles = paysChoisi ? villesPourPays(paysChoisi) : [];

  const header = (titre) => (
    <header
      className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
      style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
    >
      <button
        onClick={() => {
          if (etapeGeo === "ville") setEtapeGeo("pays");
          else if (etapeGeo === "marche" && !grandPublic && villeChoisie) { setEtapeGeo("ville"); }
          else router.back();
        }}
        aria-label="Retour"
      >
        <ArrowLeft size={22} color={COLORS.textPrimary} />
      </button>
      <span className="text-sm font-semibold flex items-center gap-1">
        <Store size={15} color={COLORS.accentPrimary} /> {titre}
      </span>
      <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
        {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
      </button>
    </header>
  );

  // ============================================================
  // ÉTAPE A — sélection du pays
  // ============================================================
  if (etapeGeo === "pays") {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
        {header("Le Marché")}
        <main className="max-w-md mx-auto w-full px-4 pt-20 pb-10">
          <p className="text-lg font-bold text-center mt-2">Où cherches-tu ?</p>
          <p className="text-xs text-center mt-1 mb-5" style={{ color: COLORS.textMuted }}>
            Choisis ton pays pour voir d'abord les vendeurs proches de toi.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {PAYS_SEBPAY.map((p) => (
              <button
                key={p.code}
                onClick={() => { setPaysChoisi(p.code); setGrandPublic(false); setEtapeGeo("ville"); }}
                className="rounded-2xl p-4 flex flex-col items-center gap-1.5"
                style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
              >
                <span className="text-3xl">{p.drapeau}</span>
                <span className="text-xs font-semibold text-center">{p.nom}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => { setGrandPublic(true); setPays("TOUS"); setEtapeGeo("marche"); }}
            className="w-full mt-6 rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2"
            style={{ background: COLORS.accentPrimary, color: COLORS.background }}
          >
            <Globe2 size={18} /> Accéder au Marché Grand Public
          </button>
          <p className="text-[11px] text-center mt-2" style={{ color: COLORS.textMuted }}>
            Tous les vendeurs, tous pays confondus — livraison ou remise en main propre à voir directement avec chacun.
          </p>
        </main>
      </div>
    );
  }

  // ============================================================
  // ÉTAPE B — sélection de la ville
  // ============================================================
  if (etapeGeo === "ville") {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
        {header(PAYS_SEBPAY.find((p) => p.code === paysChoisi)?.nom || "Le Marché")}
        <main className="max-w-md mx-auto w-full px-4 pt-20 pb-10">
          <p className="text-lg font-bold text-center mt-2">
            {drapeauPourPays(paysChoisi)} Quelle ville ?
          </p>
          <p className="text-xs text-center mt-1 mb-5" style={{ color: COLORS.textMuted }}>
            Les vendeurs de ta ville s'afficheront en priorité.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {villesDisponibles.map((v) => (
              <button
                key={v}
                onClick={() => { setVilleChoisie(v); setEtapeGeo("marche"); }}
                className="rounded-2xl p-4 flex items-center justify-center text-center"
                style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
              >
                <span className="text-sm font-semibold">{v}</span>
              </button>
            ))}
            <button
              onClick={() => { setVilleChoisie(null); setEtapeGeo("marche"); }}
              className="rounded-2xl p-4 flex items-center justify-center text-center"
              style={{ background: COLORS.surface, border: `1px dashed ${COLORS.border}`, color: COLORS.textMuted }}
            >
              <span className="text-sm font-semibold">Autre ville</span>
            </button>
          </div>

          <button
            onClick={() => { setGrandPublic(true); setPays("TOUS"); setEtapeGeo("marche"); }}
            className="w-full mt-6 rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2"
            style={{ background: COLORS.accentPrimary, color: COLORS.background }}
          >
            <Globe2 size={18} /> Accéder au Marché Grand Public
          </button>
        </main>
      </div>
    );
  }

  // ============================================================
  // ÉTAPE C — liste des annonces (local ou grand public)
  // ============================================================
  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      {header("Le Marché")}

      <div className="fixed top-14 left-0 right-0 z-30 px-4 py-2 flex flex-col gap-2" style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}>
        {!grandPublic && villeChoisie && (
          <button
            onClick={() => setEtapeGeo("pays")}
            className="self-start text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1"
            style={{ background: COLORS.surface, color: COLORS.accentPrimary, border: `1px solid ${COLORS.border}` }}
          >
            <MapPin size={11} /> {drapeauPourPays(paysChoisi)} {villeChoisie} <ChevronRight size={11} />
          </button>
        )}
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
              {p.drapeau} {p.nom}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-md mx-auto w-full px-4 pt-40 pb-24">
        <p className="text-xs mb-3" style={{ color: COLORS.textMuted }}>{triees.length} annonces</p>

        {/* Grille dynamique — 2 colonnes, hauteur variable par carte */}
        <div className="flex gap-3">
          {colonnes.map((colonne, ci) => (
            <div key={ci} className="flex-1 flex flex-col gap-3">
              {colonne.map((a) => {
                const estLocal = !grandPublic && villeChoisie && villeNormalisee(a.ville) === villeNormalisee(villeChoisie);
                return (
                  <div key={a.id} className="rounded-xl overflow-hidden" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                    <Link href={`/produit/${a.id}`} className="block">
                      <div style={{ height: a.hauteur, background: a.image ? `url(${a.image}) center/cover` : COLORS.background }} />
                    </Link>
                    <div className="p-2.5">
                      {estLocal && (
                        <span
                          className="inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full mb-1"
                          style={{ background: COLORS.accentSecondary, color: COLORS.background }}
                        >
                          Vendeur local à {a.ville}
                        </span>
                      )}
                      <Link href={`/produit/${a.id}`}>
                        <p className="text-xs font-semibold leading-tight" style={{ color: COLORS.textPrimary }}>{a.titre}</p>
                        <p className="text-sm font-bold mt-1" style={{ color: COLORS.accentPrimary }}>{a.prix}</p>
                      </Link>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] flex items-center gap-0.5" style={{ color: COLORS.textMuted }}>
                          {drapeauPourPays(a.pays)} {a.ville}
                        </span>
                        {a.vendeurId ? (
                          <Link href={`/marche/vendeur/${a.vendeurId}`} className="text-[10px] underline" style={{ color: COLORS.textMuted }}>
                            {a.vendeur}
                          </Link>
                        ) : (
                          <span className="text-[10px]" style={{ color: COLORS.textMuted }}>{a.vendeur}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {chargement && (
          <p className="text-sm text-center py-16" style={{ color: COLORS.textMuted }}>Chargement des annonces...</p>
        )}
        {!chargement && triees.length === 0 && (
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
