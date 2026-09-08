"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Star, MessageCircle, ShieldCheck, Clock, ShoppingBag,
  Sun, Moon, ChevronDown, Truck
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../lib/supabase";

const THEMES = {
  sombre: {
    background: "#0A1220",
    surface: "#132039",
    accentPrimary: "#E85D2F",
    accentSecondary: "#C99A3A",
    textPrimary: "#FFFFFF",
    textMuted: "#8B96AD",
    border: "#1E2D4A",
  },
  clair: {
    background: "#FFFFFF",
    surface: "#F8FAFC",
    accentPrimary: "#E85D2F",
    accentSecondary: "#C99A3A",
    textPrimary: "#0F172A",
    textMuted: "#64748B",
    border: "#E2E8F0",
  },
};

export default function BoutiqueVendeur() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug;
  const [theme, setTheme] = useState("clair");
  const [filtre, setFiltre] = useState("Tous");
  const COLORS = THEMES[theme];

  const [vendeur, setVendeur] = useState(null);
  const [produits, setProduits] = useState([]);
  const [avis, setAvis] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const charger = async () => {
      setChargement(true);

      const { data: v } = await supabase
        .from("vendeurs")
        .select("id, nom_boutique, sous_domaine, niveau, note_moyenne, nb_avis, nb_ventes, temps_reponse_moyen_minutes, date_creation")
        .eq("sous_domaine", slug)
        .single();

      if (!v) { setChargement(false); return; }
      setVendeur({
        id: v.id,
        nom: v.nom_boutique,
        sousDomaine: v.sous_domaine,
        niveau: v.niveau,
        note: v.note_moyenne,
        nbAvis: v.nb_avis,
        nbVentes: v.nb_ventes,
        tempsReponse: v.temps_reponse_moyen_minutes ? `Répond en < ${v.temps_reponse_moyen_minutes} min` : "Temps de réponse inconnu",
        depuis: `Sur la plateforme depuis ${new Date(v.date_creation).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`,
      });

      const { data: prod } = await supabase
        .from("produits")
        .select("id, nom, prix_base, categorie_id, categories_taxes ( nom_categorie )")
        .eq("vendeur_id", v.id)
        .eq("statut_validation", "valide");
      if (prod) {
        setProduits(
          prod.map((p) => ({
            id: p.id,
            nom: p.nom,
            prix: `${Number(p.prix_base).toLocaleString()} FCFA`,
            categorie: p.categories_taxes?.nom_categorie || "autre",
          }))
        );
      }

      const { data: av } = await supabase
        .from("avis")
        .select("note, commentaire, users:client_id ( nom )")
        .eq("vendeur_id", v.id)
        .order("date_creation", { ascending: false })
        .limit(10);
      if (av) {
        setAvis(av.map((a) => ({ client: a.users?.nom || "Client", note: a.note, commentaire: a.commentaire })));
      }

      setChargement(false);
    };
    charger();
  }, [slug]);

  const categoriesDisponibles = [...new Set(produits.map((p) => p.categorie))];
  const produitsFiltres = filtre === "Tous" ? produits : produits.filter((p) => p.categorie === filtre);

  if (chargement) {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh" }} className="flex items-center justify-center">
        <p className="text-sm" style={{ color: COLORS.textMuted }}>Chargement...</p>
      </div>
    );
  }

  if (!vendeur) {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }} className="flex items-center justify-center px-6 text-center">
        <p className="text-sm" style={{ color: COLORS.textMuted }}>Boutique introuvable.</p>
      </div>
    );
  }


  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      {/* HEADER */}
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-xs" style={{ color: COLORS.textMuted }}>{vendeur.sousDomaine}.plateforme.com</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-16 pb-10">
        {/* EN-TETE BOUTIQUE */}
        <section
          className="rounded-2xl p-4 mt-4 mb-4"
          style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl flex-shrink-0" style={{ background: COLORS.background, border: `1px solid ${COLORS.border}` }} />
            <div className="flex-1">
              <div className="flex items-center gap-1">
                <p className="font-bold text-base" style={{ color: COLORS.textPrimary }}>{vendeur.nom}</p>
                {vendeur.niveau === "revendeur_officiel" && (
                  <ShieldCheck size={16} color={COLORS.accentPrimary} />
                )}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Star size={13} color={COLORS.accentSecondary} fill={COLORS.accentSecondary} />
                <span className="text-xs" style={{ color: COLORS.textMuted }}>
                  {vendeur.note} ({vendeur.nbAvis} avis)
                </span>
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: COLORS.textMuted }}>{vendeur.depuis}</p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mt-3">
            <span
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full"
              style={{ background: COLORS.background, color: COLORS.accentSecondary, border: `1px solid ${COLORS.border}` }}
            >
              <Clock size={12} /> {vendeur.tempsReponse}
            </span>
            <span
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full"
              style={{ background: COLORS.background, color: COLORS.accentSecondary, border: `1px solid ${COLORS.border}` }}
            >
              <ShoppingBag size={12} /> {vendeur.nbVentes} ventes
            </span>
            {vendeur.niveau === "revendeur_officiel" && (
              <span
                className="text-[11px] px-2 py-1 rounded-full font-semibold"
                style={{ background: COLORS.accentPrimary, color: COLORS.background }}
              >
                Vendeur vérifié
              </span>
            )}
          </div>

          <Link
            href={`/messages/${vendeur.sousDomaine}`}
            className="w-full mt-4 rounded-xl py-2.5 font-semibold flex items-center justify-center gap-2 text-sm"
            style={{ background: COLORS.accentPrimary, color: COLORS.background }}
          >
            <MessageCircle size={16} /> Discuter avec le vendeur
          </Link>
        </section>

        {/* FILTRES CATEGORIE */}
        <div className="flex gap-2 mb-3 overflow-x-auto">
          {["Tous", ...categoriesDisponibles].map((c) => (
            <button
              key={c}
              onClick={() => setFiltre(c)}
              className="text-xs px-3 py-1.5 rounded-full flex-shrink-0"
              style={{
                background: filtre === c ? COLORS.accentPrimary : COLORS.surface,
                color: filtre === c ? COLORS.background : COLORS.textMuted,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              {c}
            </button>
          ))}
        </div>

        {/* CATALOGUE */}
        <section className="grid grid-cols-2 gap-3 mb-6">
          {produitsFiltres.length === 0 && (
            <p className="text-xs col-span-2" style={{ color: COLORS.textMuted }}>Aucun produit dans cette catégorie.</p>
          )}
          {produitsFiltres.map((p) => (
            <Link href={`/produit/${p.id}`} key={p.id} className="rounded-xl p-3 block" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <div className="w-full h-20 rounded-lg mb-2" style={{ background: COLORS.background }} />
              <p className="text-xs font-semibold leading-tight" style={{ color: COLORS.textPrimary }}>{p.nom}</p>
              <p className="text-sm font-bold mt-1" style={{ color: COLORS.accentPrimary }}>{p.prix}</p>
            </Link>
          ))}
        </section>

        {/* AVIS */}
        <section className="mb-6">
          <h2 className="text-base font-bold mb-3" style={{ color: COLORS.accentPrimary }}>Avis clients</h2>
          <div className="flex flex-col gap-2">
            {avis.length === 0 && (
              <p className="text-xs" style={{ color: COLORS.textMuted }}>Aucun avis pour l'instant.</p>
            )}
            {avis.map((a, i) => (
              <div key={i} className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>{a.client}</p>
                  <div className="flex items-center gap-0.5">
                    <Star size={12} color={COLORS.accentSecondary} fill={COLORS.accentSecondary} />
                    <span className="text-xs" style={{ color: COLORS.textMuted }}>{a.note}</span>
                  </div>
                </div>
                <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>{a.commentaire}</p>
              </div>
            ))}
          </div>
        </section>

        {/* POLITIQUE COMMUNE PLATEFORME */}
        <section
          className="rounded-xl p-4 flex items-start gap-3"
          style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
        >
          <Truck size={20} color={COLORS.accentSecondary} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold" style={{ color: COLORS.textPrimary }}>Politique de livraison & retours</p>
            <p className="text-[11px] mt-1" style={{ color: COLORS.textMuted }}>
              Livraison sous 3 à 5 jours, retours acceptés sous 48h — règles communes à tous les vendeurs de la plateforme.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
