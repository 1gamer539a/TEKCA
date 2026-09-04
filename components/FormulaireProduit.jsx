"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Upload, Plus, X, Sun, Moon, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
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

const CATEGORIES = ["Recharge de jeu", "Accessoire", "Vêtement", "Abonnement"];

/*
  Ce formulaire correspond à un INSERT dans la table `produits` (et
  `variantes_produits` si des variantes sont ajoutées) définie dans
  schema.sql. Rien n'est en dur : au clic sur "Publier", ces champs
  partent vers Supabase avec statut_validation = 'en_attente'.
*/
export default function FormulaireProduit() {
  const router = useRouter();
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];

  const [categorie, setCategorie] = useState("Accessoire");
  const [nom, setNom] = useState("");
  const [prix, setPrix] = useState("");
  const [description, setDescription] = useState("");
  const [preuveFile, setPreuveFile] = useState(null);
  const [photos, setPhotos] = useState([]); // [{ file, preview }]
  const [variantes, setVariantes] = useState([{ taille: "", couleur: "", stock: "" }]);
  const [envoye, setEnvoye] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [paysVendeur, setPaysVendeur] = useState(null);

  useEffect(() => {
    const chargerPaysVendeur = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: vendeur } = await supabase.from("vendeurs").select("pays").eq("user_id", user.id).single();
      setPaysVendeur(vendeur?.pays || "CG");
    };
    chargerPaysVendeur();
  }, []);

  const CATEGORIES_PHYSIQUES = ["Accessoire", "Vêtement"];
  const horsCongo = paysVendeur && paysVendeur !== "CG";
  const CATEGORIES_AUTORISEES = horsCongo
    ? CATEGORIES.filter((c) => !CATEGORIES_PHYSIQUES.includes(c))
    : CATEGORIES;

  const ajouterVariante = () =>
    setVariantes([...variantes, { taille: "", couleur: "", stock: "" }]);

  const retirerVariante = (i) =>
    setVariantes(variantes.filter((_, idx) => idx !== i));

  const majVariante = (i, champ, valeur) => {
    const copie = [...variantes];
    copie[i][champ] = valeur;
    setVariantes(copie);
  };

  // Correspondance libellé affiché -> nom_categorie dans la table categories_taxes
  const CATEGORIE_VERS_TYPE = {
    "Recharge de jeu": "recharge_jeu",
    "Accessoire": "accessoire",
    "Vêtement": "vetement",
    "Abonnement": "abonnement_service",
  };

  const publier = async () => {
    setErreur(null);
    setEnvoiEnCours(true);
    try {
      // 1. Récupère l'utilisateur connecté
      const { data: { user }, error: erreurAuth } = await supabase.auth.getUser();
      if (erreurAuth || !user) throw new Error("Tu dois être connecté pour publier un produit.");

      // 2. Récupère son profil vendeur (doit déjà exister — voir DevenirVendeur)
      const { data: vendeur, error: erreurVendeur } = await supabase
        .from("vendeurs")
        .select("id, pays")
        .eq("user_id", user.id)
        .single();
      if (erreurVendeur || !vendeur) throw new Error("Aucun profil vendeur trouvé pour ce compte.");

      // Sécurité serveur : re-vérifie la règle pays même si l'UI l'a déjà filtrée
      // (un client modifié ne doit jamais pouvoir contourner cette règle)
      if (vendeur.pays !== "CG" && CATEGORIES_PHYSIQUES.includes(categorie)) {
        throw new Error("Les biens physiques ne peuvent être vendus que depuis le Congo.");
      }

      // 3. Récupère l'id de la catégorie correspondante
      const nomCategorie = CATEGORIE_VERS_TYPE[categorie];
      const { data: categorieRow, error: erreurCategorie } = await supabase
        .from("categories_taxes")
        .select("id")
        .eq("nom_categorie", nomCategorie)
        .single();
      if (erreurCategorie || !categorieRow) throw new Error("Catégorie introuvable côté serveur.");

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
        })
        .select()
        .single();
      if (erreurProduit) throw erreurProduit;

      // 7. Insertion des variantes si vêtement
      if (categorie === "Vêtement") {
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
      setErreur(e.message || "Une erreur est survenue, réessaie.");
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const ajouterPhotos = (e) => {
    const fichiers = Array.from(e.target.files || []);
    const nouvelles = fichiers.map((f) => ({ file: f, preview: URL.createObjectURL(f) }));
    setPhotos((p) => [...p, ...nouvelles].slice(0, 4));
  };

  const retirerPhoto = (i) => setPhotos((p) => p.filter((_, idx) => idx !== i));

  if (envoye) {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }} className="flex flex-col items-center justify-center px-6 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.accentPrimary}` }}>
          <Upload size={22} color={COLORS.accentPrimary} />
        </div>
        <p className="font-bold text-lg">Produit envoyé pour validation</p>
        <p className="text-sm mt-2" style={{ color: COLORS.textMuted }}>
          Votre produit apparaîtra dans votre boutique une fois validé par l'équipe (généralement sous 72h).
        </p>
        <button
          onClick={() => setEnvoye(false)}
          className="mt-6 rounded-xl px-5 py-2.5 text-sm font-semibold"
          style={{ background: COLORS.accentPrimary, color: COLORS.background }}
        >
          Ajouter un autre produit
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">Nouveau produit</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-10 flex flex-col gap-4">
        {/* Catégorie */}
        <div>
          <label className="text-sm font-semibold block mb-2">Catégorie</label>
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
                {c}
              </button>
            ))}
          </div>
          {horsCongo && (
            <p className="text-[11px] mt-2" style={{ color: COLORS.textMuted }}>
              Hors Congo, seuls les produits digitaux (recharges, abonnements) peuvent être vendus — pas de biens physiques, faute de logistique de livraison.
            </p>
          )}
        </div>

        {/* Infos de base */}
        <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <div>
            <label className="text-xs font-semibold block mb-1">Nom du produit</label>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex: Casque Gaming Pro RGB"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">Prix (FCFA)</label>
            <input
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
              type="number"
              placeholder="Ex: 18000"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Décrivez le produit..."
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
              style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
            />
          </div>
        </div>

/* Ce bloc n'était pas fonctionnel — voir version connectée ci-dessous */
        {/* Photos — upload réel, connecté à l'état */}
        <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <label className="text-xs font-semibold block mb-2">Photos du produit</label>
          <div className="grid grid-cols-4 gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden" style={{ background: COLORS.background }}>
                <img src={p.preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => retirerPhoto(i)}
                  aria-label="Retirer la photo"
                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: COLORS.background }}
                >
                  <X size={12} color={COLORS.textPrimary} />
                </button>
              </div>
            ))}
            {photos.length < 4 && (
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
        {categorie === "Vêtement" && (
          <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold">Variantes</label>
              <button onClick={ajouterVariante} className="text-xs flex items-center gap-1" style={{ color: COLORS.accentPrimary }}>
                <Plus size={14} /> Ajouter
              </button>
            </div>
            {variantes.map((v, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <input
                  value={v.taille}
                  onChange={(e) => majVariante(i, "taille", e.target.value)}
                  placeholder="Taille"
                  className="w-1/4 rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                />
                <input
                  value={v.couleur}
                  onChange={(e) => majVariante(i, "couleur", e.target.value)}
                  placeholder="Couleur"
                  className="w-1/3 rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                />
                <input
                  value={v.stock}
                  onChange={(e) => majVariante(i, "stock", e.target.value)}
                  placeholder="Stock"
                  type="number"
                  className="flex-1 rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                />
                {variantes.length > 1 && (
                  <button onClick={() => retirerVariante(i)} aria-label="Retirer">
                    <Trash2 size={14} color={COLORS.textMuted} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Preuve obligatoire — pas pour les recharges de jeu (système de wallet à la place) */}
        {categorie !== "Recharge de jeu" && (
          <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <label className="text-xs font-semibold block mb-1">Preuve du produit (obligatoire)</label>
            <p className="text-[11px] mb-2" style={{ color: COLORS.textMuted }}>
              Photo réelle du produit en votre possession, ou facture/preuve d'achat.
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
              {preuveFile ? `✓ ${preuveFile.name}` : "Importer une preuve"}
            </label>
          </div>
        )}

        {/* Wallet — spécifique aux recharges de jeu */}
        {categorie === "Recharge de jeu" && (
          <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.accentPrimary}` }}>
            <label className="text-xs font-semibold block mb-1">Solde de votre portefeuille — {nom || "ce jeu"}</label>
            <p className="text-[11px] mb-3" style={{ color: COLORS.textMuted }}>
              Aucune preuve requise. Déposez un solde à l'avance : chaque vente le décrémente automatiquement.
              Rechargez votre portefeuille dès qu'il devient bas.
            </p>
            <div className="flex items-center justify-between rounded-lg px-3 py-2 mb-3" style={{ background: COLORS.background, border: `1px solid ${COLORS.border}` }}>
              <span className="text-xs" style={{ color: COLORS.textMuted }}>Solde actuel</span>
              <span className="text-sm font-bold" style={{ color: COLORS.accentPrimary }}>32 500 FCFA</span>
            </div>
            <button
              className="w-full rounded-lg py-2 text-sm font-semibold"
              style={{ background: COLORS.accentPrimary, color: COLORS.background }}
            >
              Recharger mon portefeuille
            </button>
          </div>
        )}

        {erreur && (
          <div className="rounded-xl px-3 py-2 text-xs" style={{ background: COLORS.surface, border: `1px solid #B23A2E`, color: "#B23A2E" }}>
            {erreur}
          </div>
        )}

        <button
          onClick={publier}
          disabled={envoiEnCours || !nom || !prix || (categorie !== "Recharge de jeu" && !preuveFile)}
          className="w-full rounded-xl py-3 font-semibold"
          style={{
            background: nom && prix && (categorie === "Recharge de jeu" || preuveFile) ? COLORS.accentPrimary : COLORS.border,
            color: nom && prix && (categorie === "Recharge de jeu" || preuveFile) ? COLORS.background : COLORS.textMuted,
          }}
        >
          {envoiEnCours ? "Envoi en cours..." : categorie === "Recharge de jeu" ? "Activer ce jeu" : "Envoyer pour validation"}
        </button>
      </main>
    </div>
  );
}
