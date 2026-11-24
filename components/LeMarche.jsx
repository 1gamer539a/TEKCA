"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, Sun, Moon, MapPin, Search, Store, Plus, Globe2, ChevronRight,
  Zap, Gamepad2, Shirt, Tv, Home, Car, Sofa, Baby, Joystick, Smartphone, Gem, Laptop, Bell
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

import { PAYS_SEBPAY, drapeauPourPays, nomPourPays } from "../lib/pays";
import { villesPourPays } from "../lib/villes";
import { useTheme } from "../lib/ThemeContext";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { MARQUES, MARQUE_AUTRE } from "../lib/marques";
import { grillePour, formaterMontantCourt, prixDansPalier } from "../lib/grilles-prix";
import { motsSignificatifs, normaliserTexte } from "../lib/recherche-texte";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

/*
  Catégories proposées dès l'ouverture du Marché (mêmes catégories que
  la page « Toutes les catégories »). Le libellé vient de
  categories.<cle>_label / _desc. L'acheteur choisit d'abord ce qu'il
  veut visiter, au lieu de voir tous les produits mélangés.
*/
const CATEGORIES_MARCHE = [
  { type: "vetement", cle: "vetements", icon: Shirt },
  { type: "jouet_enfant", cle: "jouetEnfant", icon: Baby },
  { type: "recharge_jeu", cle: "rechargesJeu", icon: Zap },
  { type: "abonnement_service", cle: "comptesAbonnements", icon: Tv },
  { type: "accessoire", cle: "accessoires", icon: Gamepad2 },
  { type: "console_gaming", cle: "consoleGaming", icon: Joystick },
  { type: "telephone", cle: "telephone", icon: Smartphone },
  { type: "high_tech", cle: "highTech", icon: Laptop },
  { type: "mode_beaute", cle: "modeBeaute", icon: Gem },
  { type: "meuble_deco", cle: "meubleDeco", icon: Sofa },
  { type: "vehicule", cle: "vehicules", icon: Car },
  { type: "immobilier", cle: "immobilier", icon: Home },
];

// nom de "Tous" traduit à l'affichage (voir PAYS_FILTRE.map plus bas), pas ici
const PAYS_FILTRE_BASE = [{ code: "TOUS", drapeau: "🌍" }, ...PAYS_SEBPAY];

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
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const COLORS = THEMES[theme];
  const PAYS_FILTRE = PAYS_FILTRE_BASE.map((p) => ({ ...p, nom: p.code === "TOUS" ? t("common.tous") : p.nom }));

  // etapeGeo : "pays" (grille de pays) -> "ville" (sous-grille de
  // villes) -> "marche" (liste des annonces). "Marché Grand Public"
  // saute directement à "marche" avec grandPublic=true.
  //
  // CORRECTIF — le filtre pays/ville était redemandé à chaque visite.
  // On retient maintenant le choix dans le navigateur (localStorage)
  // pour ne plus le redemander tant que l'acheteur ne change pas
  // explicitement d'avis via le bouton rapide en haut de la liste.
  // Dernier choix pays/ville mémorisé : proposé en raccourci à l'étape « pays », JAMAIS appliqué
  // automatiquement (avant, il envoyait directement dans le grand public sans rien demander).
  let preference = null;
  try {
    const stockee = typeof window !== "undefined" ? window.localStorage.getItem("tekca_marche_geo") : null;
    preference = stockee ? JSON.parse(stockee) : null;
  } catch {
    preference = null;
  }

  // Parcours : question (« Que recherches-tu ? ») → catégorie → pays → ville → liste.
  const [etapeGeo, setEtapeGeo] = useState("question");
  const [grandPublic, setGrandPublic] = useState(false);
  const [paysChoisi, setPaysChoisi] = useState(null);
  const [villeChoisie, setVilleChoisie] = useState(null);
  const [questionTexte, setQuestionTexte] = useState("");

  const memoriserPreference = (valeurs) => {
    try {
      window.localStorage.setItem("tekca_marche_geo", JSON.stringify(valeurs));
    } catch {
      // localStorage indisponible (navigation privée...) — pas bloquant,
      // le filtre sera simplement redemandé à la prochaine visite.
    }
  };

  const [pays, setPays] = useState("TOUS");
  const [type, setType] = useState(typeInitial);
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState("recent");
  const [annonces, setAnnonces] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [marque, setMarque] = useState(null); // clé de marque, « autre » ou null (toutes)
  const [budget, setBudget] = useState(null); // indice du palier de prix choisi ou null
  const [alerteId, setAlerteId] = useState(null);
  const [alerteActive, setAlerteActive] = useState(false);
  const filtresRef = useRef(null);
  const [hautFiltres, setHautFiltres] = useState(150);
  const grille = type !== "TOUS" ? grillePour(type) : null;
  const marquesCategorie = type !== "TOUS" ? MARQUES[type] || null : null;

  useEffect(() => {
    const chargerAnnonces = async () => {
      setChargement(true);
      const selection = (colonnes) => supabase
        .from("produits")
        .select(`
          id, nom, prix_base, images, type, modes_remise, date_creation, jeu_lie${colonnes},
          vendeurs!inner ( id, nom_boutique, ville, pays, niveau, statut, note_moyenne )
        `)
        .eq("vendeurs.niveau", "vendeur_simple")
        .eq("statut_validation", "valide")
        .order("date_creation", { ascending: false });
      let { data, error } = await selection(", marque, marque_autre");
      // Colonnes `marque` absentes (migration_3 pas encore exécutée) : on recharge sans elles, la liste reste visible.
      if (error) ({ data, error } = await selection(""));

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
            modesRemise: p.modes_remise || [],
            note: p.vendeurs?.note_moyenne || 0,
            dateCreation: p.date_creation,
            prixNombre: Number(p.prix_base),
            jeuLie: p.jeu_lie || "",
            marque: p.marque || null,
            marqueAutre: p.marque_autre || "",
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

  // Alerte de recherche : ce que l'acheteur cherche (texte, marque, budget, catégorie, pays) est gardé pour
  // le prévenir quand un vendeur publie un produit correspondant. Le serveur n'enregistre que s'il y a une
  // vraie intention (texte, marque ou budget) et si l'acheteur n'a pas désactivé les alertes (Paramètres).
  useEffect(() => {
    if (etapeGeo !== "marche") return;
    const texte = recherche.trim();
    const palier = grille && budget !== null ? grille[budget] : null;
    if (texte.length < 2 && !marque && !palier) return;
    const minuteur = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const reponse = await fetch("/api/marche/recherche", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            id: alerteId,
            texte,
            categorie: type !== "TOUS" ? type : null,
            marque,
            prixMin: palier ? palier[0] : null,
            prixMax: palier ? palier[1] : null,
            pays: grandPublic ? null : paysChoisi,
            ville: grandPublic ? null : villeChoisie,
          }),
        });
        const data = await reponse.json();
        if (reponse.ok && data.enregistre) { setAlerteId(data.id); setAlerteActive(true); }
        else if (reponse.ok) setAlerteActive(false);
      } catch {
        /* l'alerte est un bonus : jamais bloquant */
      }
    }, 1500);
    return () => clearTimeout(minuteur);
  }, [etapeGeo, recherche, marque, budget, type, grandPublic, paysChoisi, villeChoisie]);

  // Nombre de colonnes de la grille : 2 sur téléphone (comme avant), puis 3 / 4 / 5 selon la largeur de l'écran.
  const [nbColonnes, setNbColonnes] = useState(2);
  useEffect(() => {
    const calculer = () => {
      const largeur = window.innerWidth;
      setNbColonnes(largeur >= 1280 ? 5 : largeur >= 1024 ? 4 : largeur >= 768 ? 3 : 2);
    };
    calculer();
    window.addEventListener("resize", calculer);
    return () => window.removeEventListener("resize", calculer);
  }, []);

  // La barre de filtres est fixe en haut et sa hauteur change (marques, budget) : on la mesure
  // pour que la liste commence toujours juste en dessous.
  useEffect(() => {
    if (etapeGeo !== "marche" || !filtresRef.current) return;
    const mesurer = () => setHautFiltres(filtresRef.current ? filtresRef.current.offsetHeight : 150);
    mesurer();
    const observateur = typeof ResizeObserver !== "undefined" ? new ResizeObserver(mesurer) : null;
    if (observateur) observateur.observe(filtresRef.current);
    return () => { if (observateur) observateur.disconnect(); };
  }, [etapeGeo, type]);

  const filtrees = annonces.filter((a) => {
    const matchPays = pays === "TOUS" || a.pays === pays;
    const matchType = type === "TOUS" || a.type === type;
    const matchBudget = budget === null || !grille || prixDansPalier(a.prixNombre, grille, budget);
    const matchMarque = !marque || (marque === MARQUE_AUTRE ? !a.marque || a.marque === MARQUE_AUTRE : a.marque === marque);
    const q = recherche.toLowerCase().trim();
    // CORRECTIF — recherche "multi-critères" : cherchait uniquement
    // dans le titre de l'annonce, pas dans le nom du vendeur ni le
    // jeu concerné (pour les recharges, l'acheteur tape "Free Fire",
    // pas forcément le titre exact de l'annonce).
    // Mots importants seulement (« iPhone 13 pas cher » → iphone + 13) : tous doivent se retrouver
    // dans le titre, le vendeur, le jeu ou la marque.
    const mots = motsSignificatifs(q, 2);
    const corpus = normaliserTexte(`${a.titre} ${a.vendeur} ${a.jeuLie} ${a.marque || ""} ${a.marqueAutre || ""}`);
    const matchRecherche = !q || (mots.length === 0 ? corpus.includes(normaliserTexte(q)) : mots.every((m) => corpus.includes(m)));
    return matchPays && matchType && matchBudget && matchMarque && matchRecherche;
  });

  // Priorité aux vendeurs de la ville choisie (mode local) — tri, pas
  // exclusion : le reste du pays reste visible juste après, plutôt
  // que de cacher des annonces sur la seule foi d'un champ ville
  // saisi librement par chaque vendeur (orthographe non garantie).
  // Un tri explicite (prix, notes...) prend le pas sur la priorité
  // locale : si l'acheteur trie par prix, il veut le moins cher
  // partout, pas le moins cher "chez lui" en premier.
  const villeNormalisee = (v) => (v || "").trim().toLowerCase();
  let triees = [...filtrees];
  if (tri === "prix_asc") {
    triees.sort((a, b) => a.prixNombre - b.prixNombre);
  } else if (tri === "prix_desc") {
    triees.sort((a, b) => b.prixNombre - a.prixNombre);
  } else if (tri === "notes") {
    triees.sort((a, b) => b.note - a.note);
  } else if (tri === "recent") {
    triees.sort((a, b) => new Date(b.dateCreation) - new Date(a.dateCreation));
    if (!grandPublic && villeChoisie) {
      triees.sort((a, b) => {
        const aLocal = villeNormalisee(a.ville) === villeNormalisee(villeChoisie) ? 0 : 1;
        const bLocal = villeNormalisee(b.ville) === villeNormalisee(villeChoisie) ? 0 : 1;
        return aLocal - bLocal;
      });
    }
  }

  // Répartition dynamique en 2 colonnes façon masonry (par hauteur cumulée, pas par index pair/impair)
  const colonnes = Array.from({ length: nbColonnes }, () => []);
  const hauteurs = Array(nbColonnes).fill(0);
  triees.forEach((a) => {
    const cible = hauteurs.indexOf(Math.min(...hauteurs)); // colonne la moins haute
    colonnes[cible].push(a);
    hauteurs[cible] += a.hauteur;
  });

  const villesDisponibles = paysChoisi ? villesPourPays(paysChoisi) : [];

  const header = (titre) => (
    <header
      className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 barre-pc"
      style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
    >
      <button
        onClick={() => {
          // Retour = l'ordre inverse du parcours : liste → ville → pays → catégorie → question.
          if (etapeGeo === "marche") setEtapeGeo(grandPublic ? "pays" : "ville");
          else if (etapeGeo === "ville") setEtapeGeo("pays");
          else if (etapeGeo === "pays") setEtapeGeo("categorie");
          else if (etapeGeo === "categorie") setEtapeGeo("question");
          else router.back();
        }}
        aria-label={t("common.retour")}
      >
        <ArrowLeft size={22} color={COLORS.textPrimary} />
      </button>
      <span className="text-sm font-semibold flex items-center gap-1">
        <Store size={15} color={COLORS.accentPrimary} /> {titre}
      </span>
      <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label={t("common.changerTheme")}>
        {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
      </button>
    </header>
  );

  // ============================================================
  // ÉTAPE 0A — « Que recherches-tu précisément ? »
  // ============================================================
  if (etapeGeo === "question") {
    const continuer = () => {
      setRecherche(questionTexte.trim());
      setEtapeGeo(type !== "TOUS" ? "pays" : "categorie"); // lien direct vers une catégorie : on garde cette catégorie
    };
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
        {header(t("nav.marche"))}
        <main className="max-w-md lg:max-w-3xl mx-auto w-full px-4 pt-20 pb-10">
          <p className="text-lg font-bold text-center mt-2">{t("marche.questionTitre")}</p>
          <p className="text-xs text-center mt-1 mb-5" style={{ color: COLORS.textMuted }}>{t("marche.questionDesc")}</p>
          <div className="flex items-center gap-2 rounded-xl px-3 py-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <Search size={16} color={COLORS.textMuted} />
            <input
              value={questionTexte}
              onChange={(e) => setQuestionTexte(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") continuer(); }}
              maxLength={120}
              autoFocus
              placeholder={t("marche.questionPlaceholder")}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: COLORS.textPrimary }}
            />
          </div>
          <p className="text-[11px] mt-3 flex items-start gap-1.5" style={{ color: COLORS.textMuted }}>
            <Bell size={12} className="mt-0.5 shrink-0" /> {t("marche.questionAlerteInfo")}
          </p>
          <button
            onClick={continuer}
            className="w-full mt-5 rounded-xl py-3.5 font-semibold"
            style={{ background: COLORS.accentPrimary, color: COLORS.background }}
          >
            {t("marche.questionContinuer")}
          </button>
          <button
            onClick={() => { setQuestionTexte(""); setRecherche(""); setEtapeGeo(type !== "TOUS" ? "pays" : "categorie"); }}
            className="w-full mt-3 text-xs font-semibold"
            style={{ color: COLORS.textMuted }}
          >
            {t("marche.questionPasser")}
          </button>
        </main>
      </div>
    );
  }

  // ============================================================
  // ÉTAPE 0B — choix de la catégorie à visiter
  // ============================================================
  if (etapeGeo === "categorie") {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
        {header(t("nav.marche"))}
        <main className="max-w-md lg:max-w-3xl mx-auto w-full px-4 pt-20 pb-10">
          <p className="text-lg font-bold text-center mt-2">{t("marche.quelleCategorie")}</p>
          <p className="text-xs text-center mt-1 mb-5" style={{ color: COLORS.textMuted }}>
            {t("marche.quelleCategorieDesc")}
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {CATEGORIES_MARCHE.map(({ type: typeCat, cle, icon: Icon }) => (
              <button
                key={typeCat}
                onClick={() => {
                  setType(typeCat);
                  setMarque(null);
                  setBudget(null);
                  setEtapeGeo("pays"); // après la catégorie, c'est le pays (puis la ville) qu'on demande
                }}
                className="rounded-2xl p-4 flex flex-col items-center gap-2 text-center"
                style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
              >
                <Icon size={26} color={COLORS.accentPrimary} />
                <span className="text-xs font-semibold">{t(`categories.${cle}_label`)}</span>
                <span className="text-[10px] leading-tight" style={{ color: COLORS.textMuted }}>{t(`categories.${cle}_desc`)}</span>
              </button>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // ============================================================
  // ÉTAPE A — sélection du pays
  // ============================================================
  if (etapeGeo === "pays") {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
        {header(t("nav.marche"))}
        <main className="max-w-md lg:max-w-3xl mx-auto w-full px-4 pt-20 pb-10">
          <p className="text-lg font-bold text-center mt-2">{t("marche.ouCherchesTu")}</p>
          <p className="text-xs text-center mt-1 mb-5" style={{ color: COLORS.textMuted }}>
            {t("marche.choisisPaysDesc")}
          </p>

          {preference && (
            <button
              onClick={() => {
                if (preference.grandPublic) { setGrandPublic(true); setPays("TOUS"); }
                else { setGrandPublic(false); setPaysChoisi(preference.pays); setVilleChoisie(preference.ville || null); }
                setEtapeGeo("marche");
              }}
              className="w-full mb-4 rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: COLORS.surface, color: COLORS.accentPrimary, border: `1px dashed ${COLORS.accentPrimary}` }}
            >
              <MapPin size={14} /> {t("marche.dernierChoix")} :{" "}
              {preference.grandPublic ? t("marche.marcheGrandPublic") : `${drapeauPourPays(preference.pays)} ${preference.ville || nomPourPays(preference.pays)}`}
            </button>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
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
            onClick={() => { setGrandPublic(true); setPays("TOUS"); setEtapeGeo("marche"); memoriserPreference({ grandPublic: true, pays: null, ville: null }); }}
            className="w-full mt-6 rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2"
            style={{ background: COLORS.accentPrimary, color: COLORS.background }}
          >
            <Globe2 size={18} /> {t("marche.accederMarcheGrandPublic")}
          </button>
          <p className="text-[11px] text-center mt-2" style={{ color: COLORS.textMuted }}>
            {t("marche.tousVendeursDesc")}
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
        {header(PAYS_SEBPAY.find((p) => p.code === paysChoisi)?.nom || t("nav.marche"))}
        <main className="max-w-md lg:max-w-3xl mx-auto w-full px-4 pt-20 pb-10">
          <p className="text-lg font-bold text-center mt-2">
            {drapeauPourPays(paysChoisi)} {t("marche.quelleVille")}
          </p>
          <p className="text-xs text-center mt-1 mb-5" style={{ color: COLORS.textMuted }}>
            {t("marche.villesPrioriteDesc")}
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {villesDisponibles.map((v) => (
              <button
                key={v}
                onClick={() => { setVilleChoisie(v); setEtapeGeo("marche"); memoriserPreference({ grandPublic: false, pays: paysChoisi, ville: v }); }}
                className="rounded-2xl p-4 flex items-center justify-center text-center"
                style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
              >
                <span className="text-sm font-semibold">{v}</span>
              </button>
            ))}
            <button
              onClick={() => { setVilleChoisie(null); setEtapeGeo("marche"); memoriserPreference({ grandPublic: false, pays: paysChoisi, ville: null }); }}
              className="rounded-2xl p-4 flex items-center justify-center text-center"
              style={{ background: COLORS.surface, border: `1px dashed ${COLORS.border}`, color: COLORS.textMuted }}
            >
              <span className="text-sm font-semibold">{t("marche.autreVille")}</span>
            </button>
          </div>

          <button
            onClick={() => { setGrandPublic(true); setPays("TOUS"); setEtapeGeo("marche"); memoriserPreference({ grandPublic: true, pays: null, ville: null }); }}
            className="w-full mt-6 rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2"
            style={{ background: COLORS.accentPrimary, color: COLORS.background }}
          >
            <Globe2 size={18} /> {t("marche.accederMarcheGrandPublic")}
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
      {header(t("nav.marche"))}

      <div ref={filtresRef} className="fixed top-14 left-0 right-0 z-30 px-4 py-2 flex flex-col gap-2 barre-pc" style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}>
        <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setEtapeGeo("categorie")}
          className="text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1"
          style={{ background: COLORS.accentPrimary, color: COLORS.background, border: `1px solid ${COLORS.border}` }}
        >
          {(() => {
            const cat = CATEGORIES_MARCHE.find((c) => c.type === type);
            return cat ? t(`categories.${cat.cle}_label`) : t("marche.changerCategorie");
          })()}
          {" "}<ChevronRight size={11} />
        </button>
        <button
          onClick={() => setEtapeGeo("pays")}
          className="text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1"
          style={{ background: COLORS.surface, color: COLORS.accentPrimary, border: `1px solid ${COLORS.border}` }}
        >
          <MapPin size={11} />
          {grandPublic
            ? t("marche.marcheGrandPublic")
            : `${drapeauPourPays(paysChoisi)} ${villeChoisie || nomPourPays(paysChoisi)}`}
          {" "}<ChevronRight size={11} />
        </button>
        </div>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <Search size={15} color={COLORS.textMuted} />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t("marche.chercherAnnonce")}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: COLORS.textPrimary }}
          />
          <select
            value={tri}
            onChange={(e) => setTri(e.target.value)}
            className="text-[11px] bg-transparent outline-none flex-shrink-0"
            style={{ color: COLORS.accentSecondary }}
            aria-label={t("marche.trierAnnonces")}
          >
            <option value="recent">{t("marche.optNouveautes")}</option>
            <option value="prix_asc">{t("marche.optPrixCroissant")}</option>
            <option value="prix_desc">{t("marche.optPrixDecroissant")}</option>
            <option value="notes">{t("marche.optMeilleuresNotes")}</option>
          </select>
        </div>
        {grille && (
          <div className="flex gap-2 overflow-x-auto pb-1" aria-label={t("marche.budgetTitre")}>
            {grille.map((palier, indice) => (
              <button
                key={indice}
                onClick={() => setBudget(budget === indice ? null : indice)}
                className="text-[11px] px-3 py-1.5 rounded-full flex-shrink-0 font-semibold"
                style={{
                  background: budget === indice ? COLORS.accentSecondary : COLORS.surface,
                  color: budget === indice ? COLORS.background : COLORS.textMuted,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                {palier[0] === 0
                  ? t("marche.prixMoinsDe", { max: formaterMontantCourt(palier[1]) })
                  : palier[1] === null
                    ? t("marche.prixPlusDe", { min: formaterMontantCourt(palier[0]) })
                    : `${formaterMontantCourt(palier[0])} – ${formaterMontantCourt(palier[1])}`}
              </button>
            ))}
          </div>
        )}
        {marquesCategorie && (
          <div className="flex gap-2 overflow-x-auto pb-1" aria-label={t("marche.marqueTitre")}>
            {[{ cle: null, nom: t("marche.toutesMarques") }, ...marquesCategorie, { cle: MARQUE_AUTRE, nom: t("marche.marqueAutre") }].map((m) => (
              <button
                key={m.cle || "toutes"}
                onClick={() => setMarque(marque === m.cle ? null : m.cle)}
                className="text-[11px] px-3 py-1.5 rounded-full flex-shrink-0 font-semibold"
                style={{
                  background: marque === m.cle ? COLORS.accentPrimary : COLORS.surface,
                  color: marque === m.cle ? COLORS.background : COLORS.textMuted,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                {m.nom}
              </button>
            ))}
          </div>
        )}
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

      <main className="max-w-md lg:max-w-6xl mx-auto w-full px-4 pb-24" style={{ paddingTop: 56 + hautFiltres + 12 }}>
        <p className="text-xs mb-3" style={{ color: COLORS.textMuted }}>{t("marche.nAnnonces", { count: triees.length })}</p>
        {alerteActive && (
          <p className="text-[11px] mb-3 flex items-start gap-1.5 rounded-lg px-3 py-2" style={{ background: COLORS.surface, color: COLORS.accentSecondary, border: `1px solid ${COLORS.border}` }}>
            <Bell size={12} className="mt-0.5 shrink-0" /> {t("marche.alerteEnregistree")}
          </p>
        )}

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
                          {t("marche.vendeurLocalA", { ville: a.ville })}
                        </span>
                      )}
                      {a.modesRemise?.length > 0 && (
                        <div className="flex gap-1 mb-1">
                          {a.modesRemise.includes("domicile") && <span title={t("marche.livraisonDomicileTitle")} className="text-xs">📦</span>}
                          {a.modesRemise.includes("main_propre") && <span title={t("marche.remiseMainPropreTitle")} className="text-xs">🤝</span>}
                          {a.modesRemise.includes("instantane") && <span title={t("marche.livraisonInstantaneeTitle")} className="text-xs">⚡</span>}
                        </div>
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
          <p className="text-sm text-center py-16" style={{ color: COLORS.textMuted }}>{t("marche.chargementAnnonces")}</p>
        )}
        {!chargement && triees.length === 0 && (
          <p className="text-sm text-center py-16" style={{ color: COLORS.textMuted }}>{t("marche.aucuneAnnonce")}</p>
        )}
      </main>

      {/* Bouton flottant "Publier une annonce" — remonté au-dessus de
          la barre de navigation du bas (même z-index qu'elle
          auparavant : le bouton était à moitié caché derrière). */}
      <Link
        href="/produit/nouveau"
        className="fixed bottom-24 right-4 z-50 rounded-full px-4 py-3 flex items-center gap-2 font-semibold text-sm shadow-lg"
        style={{ background: COLORS.accentPrimary, color: COLORS.background }}
      >
        <Plus size={18} /> {t("marche.vendre")}
      </Link>
    </div>
  );
}
