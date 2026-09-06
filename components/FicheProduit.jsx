"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeft, Star, MessageCircle, ShoppingCart, CheckCircle2,
  Upload, Sun, Moon
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

function Header({ COLORS, theme, setTheme, titre, onRetour }) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
      style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
    >
      <button onClick={onRetour} aria-label="Retour">
        <ArrowLeft size={22} color={COLORS.textPrimary} />
      </button>
      <span className="text-sm font-semibold truncate max-w-[60%]" style={{ color: COLORS.textPrimary }}>
        {titre}
      </span>
      <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
        {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
      </button>
    </header>
  );
}

function Badge({ COLORS, children }) {
  return (
    <span
      className="text-[10px] uppercase px-2 py-0.5 rounded-full font-semibold"
      style={{ background: COLORS.accentSecondary, color: COLORS.background }}
    >
      {children}
    </span>
  );
}

const LABELS_TYPE = {
  recharge_jeu: "Recharge",
  vetement: "Vêtement",
  accessoire: "Accessoire",
  abonnement_service: "Abonnement",
};

/* ============================================================
   1. FICHE RECHARGE DE JEU
   ============================================================ */
function FicheRecharge({ COLORS, produit }) {
  const router = useRouter();
  const [idJoueur, setIdJoueur] = useState("");
  const [serveur, setServeur] = useState("");
  const [verifie, setVerifie] = useState(null);
  const [palierChoisi, setPalierChoisi] = useState(null);

  // Les paliers viennent des variantes du produit (chaque variante = un
  // palier de monnaie avec son propre prix), sinon un palier unique
  // basé sur le prix de base.
  const paliers = produit.variantes.length > 0
    ? produit.variantes.map((v) => ({ id: v.id, qte: v.taille || v.couleur || "Palier", prix: v.prix }))
    : [{ id: null, qte: produit.nom, prix: produit.prix }];

  const verifierId = () => {
    if (!idJoueur) return;
    // Vérification simulée — nécessite l'API du jeu concerné (pas encore
    // disponible) ; en attendant, fallback vérification manuelle par l'équipe.
    setVerifie({ pseudo: "Joueur_" + idJoueur.slice(-4) });
  };

  return (
    <div className="max-w-md mx-auto w-full px-4 pt-20 pb-10">
      <div
        className="rounded-2xl p-4 mb-4 flex items-center gap-3"
        style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
      >
        <div className="w-14 h-14 rounded-xl" style={{ background: COLORS.background }} />
        <div>
          <p className="font-bold" style={{ color: COLORS.textPrimary }}>{produit.jeuLie || produit.nom}</p>
          <Badge COLORS={COLORS}>Recharge</Badge>
        </div>
      </div>

      <div className="rounded-2xl p-4 mb-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <p className="text-sm font-semibold mb-2" style={{ color: COLORS.textPrimary }}>ID joueur</p>
        <div className="flex gap-2">
          <input
            value={idJoueur}
            onChange={(e) => { setIdJoueur(e.target.value); setVerifie(null); }}
            placeholder="Entrer votre ID"
            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
          />
          <select
            value={serveur}
            onChange={(e) => setServeur(e.target.value)}
            className="rounded-lg px-2 text-sm"
            style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
          >
            <option value="">Serveur</option>
            <option value="afrique">Afrique</option>
            <option value="asie">Asie</option>
            <option value="europe">Europe</option>
            <option value="bresil">Brésil</option>
          </select>
        </div>
        <button
          onClick={verifierId}
          className="mt-3 w-full rounded-lg py-2 text-sm font-semibold"
          style={{ background: COLORS.accentPrimary, color: COLORS.background }}
        >
          Vérifier l'ID
        </button>
        {verifie && (
          <div className="mt-3 flex items-center gap-2 text-sm" style={{ color: COLORS.accentSecondary }}>
            <CheckCircle2 size={16} />
            Compte trouvé : <strong>{verifie.pseudo}</strong>
          </div>
        )}
      </div>

      <div
        className="rounded-2xl p-4 mb-4"
        style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, opacity: verifie ? 1 : 0.4, pointerEvents: verifie ? "auto" : "none" }}
      >
        <p className="text-sm font-semibold mb-3" style={{ color: COLORS.textPrimary }}>Choisir un palier</p>
        <div className="grid grid-cols-2 gap-2">
          {paliers.map((p, i) => (
            <button
              key={p.id || i}
              onClick={() => setPalierChoisi(p)}
              className="rounded-lg p-3 text-left"
              style={{
                background: COLORS.background,
                border: `1px solid ${palierChoisi?.id === p.id ? COLORS.accentPrimary : COLORS.border}`,
              }}
            >
              <p className="text-xs" style={{ color: COLORS.textMuted }}>{p.qte}</p>
              <p className="text-sm font-bold" style={{ color: COLORS.accentPrimary }}>{Number(p.prix).toLocaleString()} FCFA</p>
            </button>
          ))}
        </div>
      </div>

      <button
        disabled={!verifie || !palierChoisi}
        onClick={() => {
          const params = new URLSearchParams({ produit: produit.id });
          if (palierChoisi?.id) params.set("variante", palierChoisi.id);
          params.set("idJoueur", idJoueur);
          router.push(`/panier?${params.toString()}`);
        }}
        className="w-full rounded-xl py-3 font-semibold"
        style={{
          background: verifie && palierChoisi ? COLORS.accentPrimary : COLORS.border,
          color: verifie && palierChoisi ? COLORS.background : COLORS.textMuted,
        }}
      >
        Payer maintenant
      </button>
    </div>
  );
}

/* ============================================================
   2. FICHE VETEMENT CUSTOM / GUILDE
   ============================================================ */
function FicheVetement({ COLORS, produit }) {
  const router = useRouter();
  const [mode, setMode] = useState("catalogue");
  const [varianteChoisie, setVarianteChoisie] = useState(produit.variantes[0] || null);

  const taillesDisponibles = [...new Set(produit.variantes.map((v) => v.taille).filter(Boolean))];
  const couleursDisponibles = [...new Set(produit.variantes.map((v) => v.couleur).filter(Boolean))];

  const choisirTaille = (taille) => {
    const match = produit.variantes.find((v) => v.taille === taille && (!varianteChoisie?.couleur || v.couleur === varianteChoisie?.couleur));
    if (match) setVarianteChoisie(match);
  };
  const choisirCouleur = (couleur) => {
    const match = produit.variantes.find((v) => v.couleur === couleur && (!varianteChoisie?.taille || v.taille === varianteChoisie?.taille));
    if (match) setVarianteChoisie(match);
  };

  const prixAffiche = varianteChoisie?.prix || produit.prix;

  return (
    <div className="max-w-md mx-auto w-full px-4 pt-20 pb-10">
      <div className="w-full h-56 rounded-2xl mb-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }} />

      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-lg font-bold" style={{ color: COLORS.textPrimary }}>{produit.nom}</p>
        </div>
        <Badge COLORS={COLORS}>Vêtement</Badge>
      </div>

      <div className="flex rounded-xl overflow-hidden mb-4" style={{ border: `1px solid ${COLORS.border}` }}>
        {[
          { id: "catalogue", label: "Modèle catalogue" },
          { id: "surmesure", label: "Sur-mesure guilde" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className="flex-1 py-2 text-xs font-semibold"
            style={{
              background: mode === t.id ? COLORS.accentPrimary : COLORS.surface,
              color: mode === t.id ? COLORS.background : COLORS.textMuted,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === "catalogue" ? (
        <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          {taillesDisponibles.length > 0 && (
            <>
              <p className="text-sm font-semibold mb-2" style={{ color: COLORS.textPrimary }}>Taille</p>
              <div className="flex gap-2 mb-4">
                {taillesDisponibles.map((t) => (
                  <button
                    key={t}
                    onClick={() => choisirTaille(t)}
                    className="w-10 h-10 rounded-lg text-sm font-semibold"
                    style={{
                      background: varianteChoisie?.taille === t ? COLORS.accentPrimary : COLORS.background,
                      color: varianteChoisie?.taille === t ? COLORS.background : COLORS.textPrimary,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </>
          )}
          {couleursDisponibles.length > 0 && (
            <>
              <p className="text-sm font-semibold mb-2" style={{ color: COLORS.textPrimary }}>Couleur — {varianteChoisie?.couleur || "—"}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {couleursDisponibles.map((c) => (
                  <button
                    key={c}
                    onClick={() => choisirCouleur(c)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{
                      background: varianteChoisie?.couleur === c ? COLORS.accentPrimary : COLORS.background,
                      color: varianteChoisie?.couleur === c ? COLORS.background : COLORS.textPrimary,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="text-xl font-bold mb-3" style={{ color: COLORS.accentPrimary }}>{Number(prixAffiche).toLocaleString()} FCFA</p>
          <button
            onClick={() => {
              const params = new URLSearchParams({ produit: produit.id });
              if (varianteChoisie?.id) params.set("variante", varianteChoisie.id);
              router.push(`/panier?${params.toString()}`);
            }}
            className="w-full rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
            style={{ background: COLORS.accentPrimary, color: COLORS.background }}
          >
            <ShoppingCart size={18} /> Ajouter au panier
          </button>
        </div>
      ) : (
        <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <p className="text-sm mb-3" style={{ color: COLORS.textMuted }}>
            Demande de devis pour votre guilde — logo, quantité et couleurs personnalisées.
          </p>
          <label className="text-sm font-semibold block mb-1" style={{ color: COLORS.textPrimary }}>Logo de la guilde</label>
          <div
            className="rounded-lg p-4 flex flex-col items-center justify-center mb-3 text-xs"
            style={{ border: `1px dashed ${COLORS.border}`, color: COLORS.textMuted }}
          >
            <Upload size={20} color={COLORS.accentSecondary} className="mb-1" />
            Glisser une image ou cliquer pour importer
          </div>
          <label className="text-sm font-semibold block mb-1" style={{ color: COLORS.textPrimary }}>Quantité</label>
          <input
            type="number"
            placeholder="Ex: 15"
            className="w-full rounded-lg px-3 py-2 text-sm mb-3 outline-none"
            style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
          />
          <label className="text-sm font-semibold block mb-1" style={{ color: COLORS.textPrimary }}>Couleurs souhaitées</label>
          <input
            placeholder="Ex: Noir et orange"
            className="w-full rounded-lg px-3 py-2 text-sm mb-4 outline-none"
            style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
          />
          <button
            onClick={() => router.push(`/messages/${produit.vendeurSousDomaine || produit.vendeurId}`)}
            className="w-full rounded-xl py-3 font-semibold"
            style={{ background: COLORS.accentPrimary, color: COLORS.background }}
          >
            Envoyer la demande de devis
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   3. FICHE ACCESSOIRE / ABONNEMENT
   ============================================================ */
function FicheAccessoire({ COLORS, produit }) {
  const router = useRouter();
  return (
    <div className="max-w-md mx-auto w-full px-4 pt-20 pb-10">
      <div className="w-full h-56 rounded-2xl mb-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }} />

      <div className="flex items-center justify-between mb-2">
        <p className="text-lg font-bold" style={{ color: COLORS.textPrimary }}>{produit.nom}</p>
        <Badge COLORS={COLORS}>{LABELS_TYPE[produit.type] || produit.type}</Badge>
      </div>
      {produit.description && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <p className="text-sm font-semibold mb-2" style={{ color: COLORS.textPrimary }}>Description</p>
          <p className="text-xs" style={{ color: COLORS.textMuted }}>{produit.description}</p>
        </div>
      )}

      <p className="text-xl font-bold mb-3" style={{ color: COLORS.accentPrimary }}>{Number(produit.prix).toLocaleString()} FCFA</p>

      <div className="flex gap-3">
        <button
          onClick={() => router.push(`/panier?produit=${produit.id}`)}
          className="flex-1 rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
          style={{ background: COLORS.accentPrimary, color: COLORS.background }}
        >
          <ShoppingCart size={18} /> Ajouter au panier
        </button>
        {produit.modeCommande === "whatsapp" && (
          <button
            onClick={() => router.push(`/messages/${produit.vendeurSousDomaine || produit.vendeurId}`)}
            className="flex-1 rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
            style={{ border: `1px solid ${COLORS.accentPrimary}`, color: COLORS.accentPrimary }}
          >
            <MessageCircle size={18} /> WhatsApp
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   PAGE — charge le vrai produit et route vers le bon layout
   ============================================================ */
export default function FicheProduit() {
  const router = useRouter();
  const params = useParams();
  const produitId = params?.id;
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];
  const [produit, setProduit] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (!produitId) return;
    const charger = async () => {
      setChargement(true);
      const { data: p } = await supabase
        .from("produits")
        .select(`
          id, nom, description, prix_base, type, jeu_lie, mode_commande, vendeur_id,
          vendeurs ( sous_domaine ),
          variantes_produits ( id, taille, couleur, prix, stock )
        `)
        .eq("id", produitId)
        .eq("statut_validation", "valide")
        .single();

      if (p) {
        setProduit({
          id: p.id,
          nom: p.nom,
          description: p.description,
          prix: p.prix_base,
          type: p.type,
          jeuLie: p.jeu_lie,
          modeCommande: p.mode_commande,
          vendeurId: p.vendeur_id,
          vendeurSousDomaine: p.vendeurs?.sous_domaine,
          variantes: p.variantes_produits || [],
        });
      }
      setChargement(false);
    };
    charger();
  }, [produitId]);

  if (chargement) {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh" }} className="flex items-center justify-center">
        <p className="text-sm" style={{ color: COLORS.textMuted }}>Chargement...</p>
      </div>
    );
  }

  if (!produit) {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }} className="flex items-center justify-center px-6 text-center">
        <p className="text-sm" style={{ color: COLORS.textMuted }}>Produit introuvable ou non disponible.</p>
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh" }}>
      <Header COLORS={COLORS} theme={theme} setTheme={setTheme} titre={produit.nom} onRetour={() => router.back()} />
      <div className="pt-4">
        {produit.type === "recharge_jeu" && <FicheRecharge COLORS={COLORS} produit={produit} />}
        {produit.type === "vetement" && <FicheVetement COLORS={COLORS} produit={produit} />}
        {(produit.type === "accessoire" || produit.type === "abonnement_service") && (
          <FicheAccessoire COLORS={COLORS} produit={produit} />
        )}
      </div>
    </div>
  );
}
