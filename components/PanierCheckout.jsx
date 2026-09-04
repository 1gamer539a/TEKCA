"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeft, Trash2, Sun, Moon, MapPin, CreditCard, CheckCircle2, ChevronRight, ShieldCheck
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
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

const TAUX_PROTECTION_ACHETEUR = 0.05;

/*
  Le paiement passe désormais par le wallet interne (pas d'appel direct
  à SeePay ici) : le client doit avoir déjà rechargé son solde
  (page /portefeuille). L'API /api/commandes/creer vérifie le solde,
  débite, crée la commande et le séquestre — jamais fait confiance au
  prix envoyé par le client.
*/
export default function PanierCheckout() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const produitId = searchParams.get("produit");
  const varianteId = searchParams.get("variante");
  const idJoueur = searchParams.get("idJoueur");

  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];

  const [etape, setEtape] = useState("panier");
  const [produit, setProduit] = useState(null);
  const [quantite, setQuantite] = useState(1);
  const [adresse, setAdresse] = useState("");
  const [zone, setZone] = useState("");
  const [solde, setSolde] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [numeroCommande, setNumeroCommande] = useState(null);

  useEffect(() => {
    const charger = async () => {
      setChargement(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setChargement(false); return; }

      const { data: wallet } = await supabase.from("wallets").select("solde").eq("user_id", user.id).single();
      setSolde(Number(wallet?.solde || 0));

      if (produitId) {
        const { data: p } = await supabase
          .from("produits")
          .select("id, nom, prix_base, vendeur_id, vendeurs ( nom_boutique )")
          .eq("id", produitId)
          .single();
        if (p) {
          let prix = Number(p.prix_base);
          if (varianteId) {
            const { data: v } = await supabase.from("variantes_produits").select("prix, taille, couleur").eq("id", varianteId).single();
            if (v?.prix) prix = Number(v.prix);
            setProduit({ id: p.id, nom: p.nom, prix, vendeur: p.vendeurs?.nom_boutique || "—", variante: v ? `${v.taille || ""} ${v.couleur || ""}`.trim() : null });
          } else {
            setProduit({ id: p.id, nom: p.nom, prix, vendeur: p.vendeurs?.nom_boutique || "—", variante: null });
          }
        }
      }
      setChargement(false);
    };
    charger();
  }, [produitId, varianteId]);

  const sousTotal = produit ? produit.prix * quantite : 0;
  const fraisProtection = Math.round(sousTotal * TAUX_PROTECTION_ACHETEUR);
  const totalAvecProtection = sousTotal + fraisProtection;
  const soldeInsuffisant = totalAvecProtection > solde;

  const ETAPES = ["panier", "livraison", "paiement", "confirmation"];
  const indexEtape = ETAPES.indexOf(etape);

  const payer = async () => {
    setErreur(null);
    setEnCours(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const reponse = await fetch("/api/commandes/creer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ produitId: produit.id, varianteId, quantite, adresse, ville: zone, idJoueur }),
      });
      const data = await reponse.json();
      if (!reponse.ok) throw new Error(data.error || "Échec du paiement.");
      setNumeroCommande(data.commandeId);
      setEtape("confirmation");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  };

  if (chargement) {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh" }} className="flex items-center justify-center">
        <p className="text-sm" style={{ color: COLORS.textMuted }}>Chargement...</p>
      </div>
    );
  }

  if (!produit) {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }} className="flex flex-col items-center justify-center px-6 text-center gap-2">
        <p className="text-sm" style={{ color: COLORS.textMuted }}>Ton panier est vide.</p>
        <button onClick={() => router.push("/")} className="text-sm mt-2" style={{ color: COLORS.accentPrimary }}>Retour à l'accueil</button>
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
        <span className="text-sm font-semibold capitalize">{etape}</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      {etape !== "confirmation" && (
        <div className="fixed top-14 left-0 right-0 z-30 flex gap-1 px-4 py-2" style={{ background: COLORS.background }}>
          {ETAPES.slice(0, 3).map((e, i) => (
            <div key={e} className="flex-1 h-1 rounded-full" style={{ background: i <= indexEtape ? COLORS.accentPrimary : COLORS.border }} />
          ))}
        </div>
      )}

      <main className="max-w-md mx-auto w-full px-4 pt-24 pb-28">
        {etape === "panier" && (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg px-3 py-2 text-xs" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.textMuted }}>
              Vendu par <strong style={{ color: COLORS.accentSecondary }}>{produit.vendeur}</strong>
            </div>
            <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <div className="w-14 h-14 rounded-lg flex-shrink-0" style={{ background: COLORS.background }} />
              <div className="flex-1">
                <p className="text-sm font-semibold">{produit.nom}</p>
                {produit.variante && <p className="text-[11px]" style={{ color: COLORS.textMuted }}>{produit.variante}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <button onClick={() => setQuantite((q) => Math.max(1, q - 1))} className="w-6 h-6 rounded-full text-sm" style={{ background: COLORS.background, border: `1px solid ${COLORS.border}` }}>−</button>
                  <span className="text-xs">{quantite}</span>
                  <button onClick={() => setQuantite((q) => q + 1)} className="w-6 h-6 rounded-full text-sm" style={{ background: COLORS.background, border: `1px solid ${COLORS.border}` }}>+</button>
                </div>
              </div>
              <p className="text-sm font-bold" style={{ color: COLORS.accentPrimary }}>{(produit.prix * quantite).toLocaleString()} FCFA</p>
            </div>
          </div>
        )}

        {etape === "livraison" && (
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <label className="text-xs font-semibold flex items-center gap-1 mb-2" style={{ color: COLORS.textPrimary }}>
                <MapPin size={14} color={COLORS.accentPrimary} /> Adresse de livraison
              </label>
              <input
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                placeholder="Quartier, avenue, repère..."
                className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-3"
                style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
              />
              <label className="text-xs font-semibold block mb-2">Ville / Zone</label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
              >
                <option value="">Sélectionner</option>
                <option value="brazzaville">Brazzaville</option>
                <option value="pointe-noire">Pointe-Noire</option>
                <option value="autre">Autre ville</option>
              </select>
            </div>
            <p className="text-[11px] px-1" style={{ color: COLORS.textMuted }}>
              Livraison sous 3 à 5 jours — politique commune à tous les vendeurs de la plateforme.
            </p>
          </div>
        )}

        {etape === "paiement" && (
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <div className="flex justify-between text-sm" style={{ color: COLORS.textMuted }}>
                <span>Sous-total article</span><span>{sousTotal.toLocaleString()} FCFA</span>
              </div>
              <div className="flex justify-between text-sm" style={{ color: COLORS.textMuted }}>
                <span className="flex items-center gap-1"><ShieldCheck size={13} color={COLORS.accentSecondary} /> Protection Acheteur (5%)</span>
                <span>{fraisProtection.toLocaleString()} FCFA</span>
              </div>
              <p className="text-[10px]" style={{ color: COLORS.textMuted }}>
                Garantit un remboursement si l'article ne correspond pas ou n'arrive jamais.
              </p>
              <div className="flex justify-between pt-2 mt-1" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                <span className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>Total à payer</span>
                <span className="text-lg font-bold" style={{ color: COLORS.accentPrimary }}>{totalAvecProtection.toLocaleString()} FCFA</span>
              </div>
            </div>

            <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <label className="text-xs font-semibold flex items-center gap-1 mb-2" style={{ color: COLORS.textPrimary }}>
                <CreditCard size={14} color={COLORS.accentPrimary} /> Solde de ton portefeuille
              </label>
              <div className="rounded-lg px-3 py-3 flex items-center justify-between" style={{ background: COLORS.background, border: `1px solid ${soldeInsuffisant ? "#B23A2E" : COLORS.accentPrimary}` }}>
                <span className="text-sm font-semibold">{solde.toLocaleString()} FCFA</span>
                {!soldeInsuffisant && <CheckCircle2 size={16} color={COLORS.accentPrimary} />}
              </div>
              {soldeInsuffisant && (
                <button onClick={() => router.push("/portefeuille")} className="text-[11px] mt-2" style={{ color: "#B23A2E" }}>
                  Solde insuffisant — appuie ici pour recharger ton portefeuille
                </button>
              )}
            </div>

            {erreur && <p className="text-xs" style={{ color: "#B23A2E" }}>{erreur}</p>}
          </div>
        )}

        {etape === "confirmation" && (
          <div className="flex flex-col items-center text-center gap-3 pt-10">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: COLORS.surface, border: `1px solid ${COLORS.accentPrimary}` }}>
              <CheckCircle2 size={28} color={COLORS.accentPrimary} />
            </div>
            <p className="text-lg font-bold">Commande confirmée</p>
            <p className="text-sm" style={{ color: COLORS.textMuted }}>
              Numéro de commande : <strong style={{ color: COLORS.accentSecondary }}>{numeroCommande}</strong>
            </p>
            <p className="text-xs max-w-xs" style={{ color: COLORS.textMuted }}>
              {produit.vendeur} a été notifié. Ton argent reste protégé jusqu'à confirmation de réception.
            </p>
            <button
              onClick={() => router.push("/commandes")}
              className="mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold"
              style={{ background: COLORS.accentPrimary, color: COLORS.background }}
            >
              Voir mes commandes
            </button>
          </div>
        )}
      </main>

      {etape !== "confirmation" && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 px-4 py-3 flex items-center justify-between"
          style={{ background: COLORS.background, borderTop: `1px solid ${COLORS.border}` }}
        >
          <div>
            <p className="text-[10px]" style={{ color: COLORS.textMuted }}>{etape === "panier" ? "Sous-total" : "Total (protection incluse)"}</p>
            <p className="text-base font-bold" style={{ color: COLORS.accentPrimary }}>
              {(etape === "panier" ? sousTotal : totalAvecProtection).toLocaleString()} FCFA
            </p>
          </div>
          <button
            disabled={enCours || (etape === "paiement" && soldeInsuffisant)}
            onClick={() => {
              if (etape === "panier") setEtape("livraison");
              else if (etape === "livraison") setEtape("paiement");
              else if (etape === "paiement") payer();
            }}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-1"
            style={{
              background: (etape === "paiement" && soldeInsuffisant) ? COLORS.border : COLORS.accentPrimary,
              color: (etape === "paiement" && soldeInsuffisant) ? COLORS.textMuted : COLORS.background,
            }}
          >
            {enCours ? "Paiement..." : etape === "paiement" ? "Payer maintenant" : "Continuer"} <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
