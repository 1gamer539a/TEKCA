"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Upload, Plus, X, Sun, Moon, Trash2, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";
import { useLanguage } from "../lib/i18n/LanguageContext";

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

// "categorie" est maintenant stocké comme clé technique stable
// (recharge_jeu, accessoire...) plutôt que le libellé français en
// dur — elle sert à la fois de valeur d'affichage (traduite via
// CLE_AFFICHAGE_CATEGORIE + t()) et de valeur envoyée en base
// (identique à nom_categorie dans categories_taxes, donc
// CATEGORIE_VERS_TYPE n'est plus nécessaire).
const CATEGORIES = [
  "recharge_jeu", "accessoire", "vetement", "abonnement_service", "ebook", "template",
  "immobilier", "vehicule", "meuble_deco", "jouet_enfant", "console_gaming", "high_tech", "mode_beaute",
];
const CLE_AFFICHAGE_CATEGORIE = {
  recharge_jeu: "produits.recharge", accessoire: "produits.accessoire", vetement: "produits.vetement",
  abonnement_service: "produits.abonnement", ebook: "produits.ebook", template: "produits.template",
  immobilier: "categories.immobilier_label", vehicule: "categories.vehicules_label", meuble_deco: "categories.meubleDeco_label",
  jouet_enfant: "categories.jouetEnfant_label", console_gaming: "categories.consoleGaming_label",
  high_tech: "categories.highTech_label", mode_beaute: "categories.modeBeaute_label",
};

// Catégories où la qualité des photos est particulièrement
// déterminante pour la confiance de l'acheteur (biens de valeur,
// gros achats) — minimum 4, maximum 7 photos obligatoires.
const CATEGORIES_PHOTOS_STRICTES = ["immobilier", "vehicule", "meuble_deco"];
const PHOTOS_MIN_STRICT = 4;
const PHOTOS_MAX_STRICT = 7;
const PHOTOS_MAX_STANDARD = 4;

// Catégories livrées via le Coffre-fort numérique : pas de séquestre,
// livraison automatique par code, paiement instantané au vendeur —
// voir migration_coffre_fort_numerique.sql. Les autres (accessoire,
// vetement) restent protégées par le séquestre TEKÇA classique.
const CATEGORIES_COFFRE_FORT = ["recharge_jeu", "abonnement_service", "ebook", "template"];

/*
  Ce formulaire correspond à un INSERT dans la table `produits` (et
  `variantes_produits` si des variantes sont ajoutées) définie dans
  schema.sql. Rien n'est en dur : au clic sur "Publier", ces champs
  partent vers Supabase avec statut_validation = 'en_attente'.
*/
export default function FormulaireProduit() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const COLORS = THEMES[theme];

  const [categorie, setCategorie] = useState("accessoire");
  const [nom, setNom] = useState("");
  const [prix, setPrix] = useState("");
  const [vendeurId, setVendeurId] = useState(null);
  const [soldeJeu, setSoldeJeu] = useState(0);
  const [montantRecharge, setMontantRecharge] = useState("");
  const [rechargeEnCours, setRechargeEnCours] = useState(false);
  const [erreurRecharge, setErreurRecharge] = useState(null);

  useEffect(() => {
    const chargerVendeur = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: vendeur } = await supabase.from("vendeurs").select("id").eq("user_id", user.id).single();
      if (vendeur) setVendeurId(vendeur.id);
    };
    chargerVendeur();
  }, []);

  useEffect(() => {
    if (!vendeurId || categorie !== "recharge_jeu" || !nom.trim()) { setSoldeJeu(0); return; }
    const minuteur = setTimeout(async () => {
      const { data } = await supabase
        .from("wallets_recharge")
        .select("solde")
        .eq("vendeur_id", vendeurId)
        .eq("jeu", nom.trim())
        .maybeSingle();
      setSoldeJeu(Number(data?.solde || 0));
    }, 400);
    return () => clearTimeout(minuteur);
  }, [vendeurId, categorie, nom]);

  const rechargerWalletJeu = async () => {
    const montant = Number(montantRecharge);
    if (!montant || montant <= 0 || !nom.trim()) return;
    setRechargeEnCours(true);
    setErreurRecharge(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const reponse = await fetch("/api/vendeur/recharger-jeu", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ jeu: nom.trim(), montant }),
      });
      const data = await reponse.json();
      if (!reponse.ok) throw new Error(data.error || t("wallet.echecRecharge"));
      setSoldeJeu(data.solde);
      setMontantRecharge("");
    } catch (e) {
      setErreurRecharge(e.message || t("wallet.echecRecharge"));
    } finally {
      setRechargeEnCours(false);
    }
  };
  const [description, setDescription] = useState("");
  const [preuveFile, setPreuveFile] = useState(null);
  const [photos, setPhotos] = useState([]); // [{ file, preview }]
  const [variantes, setVariantes] = useState([{ taille: "", couleur: "", stock: "" }]);
  const [stockGlobal, setStockGlobal] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [produitCreeId, setProduitCreeId] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [modesRemise, setModesRemise] = useState([]);
  const [zoneCouverture, setZoneCouverture] = useState("");

  // CORRECTIF — Le Marché n'est plus limité au Congo (voir
  // DevenirVendeur.jsx / LeMarche.jsx) : les biens physiques sont
  // maintenant autorisés dans les 20 pays SebPay, plus seulement CG.
  const CATEGORIES_AUTORISEES = CATEGORIES;

  const ajouterVariante = () =>
    setVariantes([...variantes, { taille: "", couleur: "", stock: "" }]);

  const retirerVariante = (i) =>
    setVariantes(variantes.filter((_, idx) => idx !== i));

  const majVariante = (i, champ, valeur) => {
    const copie = [...variantes];
    copie[i][champ] = valeur;
    setVariantes(copie);
  };

  const publier = async () => {
    setErreur(null);

    if (CATEGORIES_PHOTOS_STRICTES.includes(categorie) && photos.length < PHOTOS_MIN_STRICT) {
      setErreur(t("produit.pourCategoriePhotosDesc", { categorie: t(CLE_AFFICHAGE_CATEGORIE[categorie]), min: PHOTOS_MIN_STRICT, max: PHOTOS_MAX_STRICT }));
      return;
    }

    setEnvoiEnCours(true);
    try {
      // 1. Récupère l'utilisateur connecté
      const { data: { user }, error: erreurAuth } = await supabase.auth.getUser();
      if (erreurAuth || !user) throw new Error(t("produit.tuDoisEtreConnectePublier"));

      // 2. Récupère son profil vendeur (doit déjà exister — voir DevenirVendeur)
      const { data: vendeur, error: erreurVendeur } = await supabase
        .from("vendeurs")
        .select("id, pays")
        .eq("user_id", user.id)
        .single();
      if (erreurVendeur || !vendeur) throw new Error(t("produit.profilVendeurIntrouvable"));

      // (l'ancienne restriction "biens physiques = Congo uniquement"
      // a été retirée : Le Marché est ouvert aux 20 pays SebPay)

      // 3. Récupère l'id de la catégorie correspondante — "categorie"
      // est déjà la valeur technique (nom_categorie), plus besoin de
      // mapping intermédiaire.
      const nomCategorie = categorie;
      const { data: categorieRow, error: erreurCategorie } = await supabase
        .from("categories_taxes")
        .select("id")
        .eq("nom_categorie", nomCategorie)
        .single();
      if (erreurCategorie || !categorieRow) throw new Error(t("produit.categorieIntrouvableServeur"));

      // 4. Upload des photos vers Supabase Storage (bucket "produits")
      const photosUrls = [];
      for (const p of photos) {
        const cheminFichier = `${user.id}/${Date.now()}-${p.file.name}`;
        const { error: erreurUpload } = await supabase.storage
          .from("produits")
          .upload(cheminFichier, p.file);
        if (erreurUpload) throw erreurUpload;
        const { data: urlPublique } = supabase.storage.from("produits").getPublicUrl(cheminFichier);
        photosUrls.push(urlPublique.publicUrl);
      }

      // 5. Upload de la preuve (photo réelle / facture) — sauf pour les recharges de jeu
      let preuveUrl = null;
      if (preuveFile) {
        const cheminPreuve = `${user.id}/preuve-${Date.now()}-${preuveFile.name}`;
        const { error: erreurPreuve } = await supabase.storage
          .from("preuves")
          .upload(cheminPreuve, preuveFile);
        if (erreurPreuve) throw erreurPreuve;
        const { data: urlPreuve } = supabase.storage.from("preuves").getPublicUrl(cheminPreuve);
        preuveUrl = urlPreuve.publicUrl;
      }

      // 6. Insertion du produit
      const viaCoffreFort = CATEGORIES_COFFRE_FORT.includes(categorie);
      const { data: produit, error: erreurProduit } = await supabase
        .from("produits")
        .insert({
          vendeur_id: vendeur.id,
          categorie_id: categorieRow.id,
          type: nomCategorie,
          nom,
          description,
          prix_base: parseFloat(prix),
          statut_validation: "en_attente",
          preuve_url: preuveUrl,
          images: photosUrls,
          pays: vendeur.pays,
          modes_remise: modesRemise,
          zone_couverture: zoneCouverture || null,
          via_coffre_fort: viaCoffreFort,
          // stock_global n'est utilisé QUE quand le produit n'a pas de
          // variantes (voir schema.sql) — pour Accessoire, qui n'a pas
          // de système taille/couleur. Pour Vêtement, le stock est géré
          // variante par variante juste en dessous.
          stock_global: categorie === "accessoire" ? (parseInt(stockGlobal, 10) || 0) : null,
        })
        .select()
        .single();
      if (erreurProduit) throw erreurProduit;

      // 7bis. Produit digital (Coffre-fort) — redirige vers l'ajout de
      // stock plutôt que l'écran de succès classique : le produit ne
      // pourra pas recevoir de commande tant qu'aucun code n'est en
      // stock (vérifié côté achat, /api/produits/acheter-digital).
      if (viaCoffreFort) {
        setProduitCreeId(produit.id);
      }

      // 7. Insertion des variantes si vêtement
      if (categorie === "vetement") {
        const lignesVariantes = variantes
          .filter((v) => v.taille || v.couleur)
          .map((v) => ({
            produit_id: produit.id,
            taille: v.taille || null,
            couleur: v.couleur || null,
            stock: parseInt(v.stock, 10) || 0,
          }));
        if (lignesVariantes.length > 0) {
          const { error: erreurVariantes } = await supabase
            .from("variantes_produits")
            .insert(lignesVariantes);
          if (erreurVariantes) throw erreurVariantes;
        }
      }

      setEnvoye(true);
    } catch (e) {
      setErreur(e.message || t("produit.erreurGenerique"));
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const ajouterPhotos = (e) => {
    const maxPhotos = CATEGORIES_PHOTOS_STRICTES.includes(categorie) ? PHOTOS_MAX_STRICT : PHOTOS_MAX_STANDARD;
    const fichiers = Array.from(e.target.files || []);
    const nouvelles = fichiers.map((f) => ({ file: f, preview: URL.createObjectURL(f) }));
    setPhotos((p) => [...p, ...nouvelles].slice(0, maxPhotos));
  };

  const retirerPhoto = (i) => setPhotos((p) => p.filter((_, idx) => idx !== i));

  if (envoye) {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }} className="flex flex-col items-center justify-center px-6 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.accentPrimary}` }}>
          {produitCreeId ? <Lock size={22} color={COLORS.accentPrimary} /> : <Upload size={22} color={COLORS.accentPrimary} />}
        </div>
        <p className="font-bold text-lg">{t("produit.produitEnvoyeValidation")}</p>
        <p className="text-sm mt-2" style={{ color: COLORS.textMuted }}>
          {produitCreeId
            ? t("produit.etapeRestanteCoffreFort")
            : t("produit.produitApparaitraDesc")}
        </p>
        {produitCreeId ? (
          <Link
            href="/dashboard"
            className="mt-6 rounded-xl px-5 py-2.5 text-sm font-semibold"
            style={{ background: COLORS.accentPrimary, color: COLORS.background }}
          >
            {t("produit.configurerMonCoffreFort")}
          </Link>
        ) : (
          <button
            onClick={() => setEnvoye(false)}
            className="mt-6 rounded-xl px-5 py-2.5 text-sm font-semibold"
            style={{ background: COLORS.accentPrimary, color: COLORS.background }}
          >
            {t("produit.ajouterAutreProduit")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label={t("common.retour")}><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">{t("produit.nouveauProduit")}</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label={t("common.changerTheme")}>
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-10 flex flex-col gap-4">
        {/* Catégorie */}
        <div>
          <label className="text-sm font-semibold block mb-2">{t("produit.categorieLabel")}</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES_AUTORISEES.map((c) => (
              <button
                key={c}
                onClick={() => setCategorie(c)}
                className="text-xs px-3 py-1.5 rounded-full"
                style={{
                  background: categorie === c ? COLORS.accentPrimary : COLORS.surface,
                  color: categorie === c ? COLORS.background : COLORS.textMuted,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                {t(CLE_AFFICHAGE_CATEGORIE[c])}
              </button>
            ))}
          </div>
          {CATEGORIES_COFFRE_FORT.includes(categorie) && (
            <p className="text-[11px] mt-2 rounded-lg px-3 py-2" style={{ background: COLORS.surface, color: COLORS.accentSecondary, border: `1px solid ${COLORS.border}` }}>
              {t("produit.coffreFortLivraisonAvert")}
            </p>
          )}
        </div>

        {/* Modes de remise & zone de couverture */}
        <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <label className="text-sm font-semibold">{t("produit.commentCeProduitRemis")}</label>
          <div className="flex flex-wrap gap-2">
            {[
              { valeur: "domicile", cle: "produit.livraisonDomicileOption" },
              { valeur: "main_propre", cle: "vendeur.modeMainPropre" },
              { valeur: "instantane", cle: "produit.remiseInstantaneeOption" },
            ].map((m) => {
              const actif = modesRemise.includes(m.valeur);
              return (
                <button
                  key={m.valeur}
                  onClick={() =>
                    setModesRemise(actif ? modesRemise.filter((x) => x !== m.valeur) : [...modesRemise, m.valeur])
                  }
                  className="text-xs px-3 py-1.5 rounded-full"
                  style={{
                    background: actif ? COLORS.accentPrimary : COLORS.background,
                    color: actif ? COLORS.background : COLORS.textMuted,
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  {t(m.cle)}
                </button>
              );
            })}
          </div>
          {(modesRemise.includes("domicile") || modesRemise.includes("main_propre")) && (
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: COLORS.textMuted }}>
                {t("produit.zoneCouvertureLabel")}
              </label>
              <input
                value={zoneCouverture}
                onChange={(e) => setZoneCouverture(e.target.value)}
                placeholder={t("produit.zoneCouverturePlaceholder")}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
              />
            </div>
          )}
        </div>

        {/* Infos de base */}
        <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <div>
            <label className="text-xs font-semibold block mb-1">{t("produit.nomProduitLabel")}</label>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder={t("produit.nomProduitPlaceholder")}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">{t("produit.prixFcfaLabel")}</label>
            <input
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
              type="number"
              placeholder={t("produit.prixPlaceholder")}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">{t("produit.description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={t("produit.descriptionPlaceholder")}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
              style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
            />
          </div>
        </div>

        {/* Ce bloc n'était pas fonctionnel — voir version connectée ci-dessous */}
        {/* Photos — upload réel, connecté à l'état */}
        <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <label className="text-xs font-semibold block mb-2">
            {t("produit.photosLabel")}
            {CATEGORIES_PHOTOS_STRICTES.includes(categorie) && (
              <span className="font-normal" style={{ color: COLORS.textMuted }}>{t("produit.entreEtObligatoires", { min: PHOTOS_MIN_STRICT, max: PHOTOS_MAX_STRICT })}</span>
            )}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden" style={{ background: COLORS.background }}>
                <img src={p.preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => retirerPhoto(i)}
                  aria-label={t("produit.retirerLaPhoto")}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: COLORS.background }}
                >
                  <X size={12} color={COLORS.textPrimary} />
                </button>
              </div>
            ))}
            {photos.length < (CATEGORIES_PHOTOS_STRICTES.includes(categorie) ? PHOTOS_MAX_STRICT : PHOTOS_MAX_STANDARD) && (
              <label
                className="aspect-square rounded-lg flex items-center justify-center cursor-pointer"
                style={{ background: COLORS.background, border: `1px dashed ${COLORS.border}` }}
              >
                <input type="file" accept="image/*" multiple className="hidden" onChange={ajouterPhotos} />
                <Plus size={16} color={COLORS.textMuted} />
              </label>
            )}
          </div>
        </div>

        {/* Variantes (taille/couleur/stock) */}
        {categorie === "vetement" && (
          <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold">{t("produit.variantesLabel")}</label>
              <button onClick={ajouterVariante} className="text-xs flex items-center gap-1" style={{ color: COLORS.accentPrimary }}>
                <Plus size={14} /> {t("produit.ajouterMot")}
              </button>
            </div>
            {variantes.map((v, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <input
                  value={v.taille}
                  onChange={(e) => majVariante(i, "taille", e.target.value)}
                  placeholder={t("produit.taille")}
                  className="w-1/4 rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                />
                <input
                  value={v.couleur}
                  onChange={(e) => majVariante(i, "couleur", e.target.value)}
                  placeholder={t("produit.couleur")}
                  className="w-1/3 rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                />
                <input
                  value={v.stock}
                  onChange={(e) => majVariante(i, "stock", e.target.value)}
                  placeholder={t("produit.stockPlaceholder")}
                  type="number"
                  className="flex-1 rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                />
                {variantes.length > 1 && (
                  <button onClick={() => retirerVariante(i)} aria-label={t("produit.retirerMot")}>
                    <Trash2 size={14} color={COLORS.textMuted} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Preuve obligatoire — pas pour les recharges de jeu (système de wallet à la place) */}
        {categorie !== "recharge_jeu" && (
          <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <label className="text-xs font-semibold block mb-1">{t("produit.preuveObligatoireLabel")}</label>
            <p className="text-[11px] mb-2" style={{ color: COLORS.textMuted }}>
              {t("produit.preuveObligatoireDesc")}
            </p>
            <label
              className="w-full rounded-lg p-4 flex flex-col items-center justify-center text-xs cursor-pointer"
              style={{ border: `1px dashed ${COLORS.border}`, color: COLORS.textMuted }}
            >
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setPreuveFile(e.target.files?.[0] || null)}
              />
              <Upload size={20} color={COLORS.accentSecondary} className="mb-1" />
              {preuveFile ? `✓ ${preuveFile.name}` : t("produit.importerUnePreuve")}
            </label>
          </div>
        )}

        {/* Wallet — spécifique aux recharges de jeu */}
        {/* Stock — Accessoire (pas de variantes taille/couleur, donc un
            seul compteur global plutôt que le système par variante) */}
        {categorie === "accessoire" && (
          <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <label className="text-xs font-semibold block mb-1">{t("produit.quantiteStockLabel")}</label>
            <input
              value={stockGlobal}
              onChange={(e) => setStockGlobal(e.target.value)}
              placeholder={t("produit.quantiteStockPlaceholder")}
              type="number"
              min="0"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
            />
            <p className="text-[10.5px] mt-1" style={{ color: COLORS.textMuted }}>
              {t("produit.stockEpuiseDesc")}
            </p>
          </div>
        )}

        {categorie === "recharge_jeu" && (
          <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.accentPrimary}` }}>
            <label className="text-xs font-semibold block mb-1">{t("produit.soldePortefeuilleJeu", { jeu: nom || t("produit.ceJeuDefaut") })}</label>
            <p className="text-[11px] mb-3" style={{ color: COLORS.textMuted }}>
              {t("produit.aucunePreuveRequiseDesc")}
            </p>
            <div className="flex items-center justify-between rounded-lg px-3 py-2 mb-3" style={{ background: COLORS.background, border: `1px solid ${COLORS.border}` }}>
              <span className="text-xs" style={{ color: COLORS.textMuted }}>{t("produit.soldeActuelLabel")}</span>
              <span className="text-sm font-bold" style={{ color: COLORS.accentPrimary }}>{soldeJeu.toLocaleString()} FCFA</span>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={montantRecharge}
                onChange={(e) => setMontantRecharge(e.target.value)}
                placeholder={t("produit.montantAAjouterPlaceholder")}
                className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
              />
              <button
                onClick={rechargerWalletJeu}
                disabled={rechargeEnCours || !montantRecharge || !nom.trim()}
                className="rounded-lg px-4 text-sm font-semibold whitespace-nowrap"
                style={{ background: COLORS.accentPrimary, color: COLORS.background }}
              >
                {rechargeEnCours ? "..." : t("produit.rechargerBtn")}
              </button>
            </div>
            {erreurRecharge && <p className="text-[11px] mt-2" style={{ color: "#B23A2E" }}>{erreurRecharge}</p>}
            {!nom.trim() && <p className="text-[11px] mt-2" style={{ color: COLORS.textMuted }}>{t("produit.donneNomProduitDesc")}</p>}
          </div>
        )}

        {erreur && (
          <div className="rounded-xl px-3 py-2 text-xs" style={{ background: COLORS.surface, border: `1px solid #B23A2E`, color: "#B23A2E" }}>
            {erreur}
          </div>
        )}

        <button
          onClick={publier}
          disabled={envoiEnCours || !nom || !prix || (categorie !== "recharge_jeu" && !preuveFile)}
          className="w-full rounded-xl py-3 font-semibold"
          style={{
            background: nom && prix && (categorie === "recharge_jeu" || preuveFile) ? COLORS.accentPrimary : COLORS.border,
            color: nom && prix && (categorie === "recharge_jeu" || preuveFile) ? COLORS.background : COLORS.textMuted,
          }}
        >
          {envoiEnCours ? t("produit.envoiEnCoursFormulaire") : categorie === "recharge_jeu" ? t("produit.activerCeJeu") : t("produit.envoyerPourValidation")}
        </button>
      </main>
    </div>
  );
}
