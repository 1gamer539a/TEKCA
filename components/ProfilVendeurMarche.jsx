"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Sun, Moon, MapPin, MessageCircle, Store,
  Calendar, ShieldCheck, AlertTriangle, RefreshCw, Loader2, Flag
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { drapeauPourPays, nomPourPays } from "../lib/pays";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

const LIBELLES_TYPE = {
  accessoire: "Accessoires",
  vetement: "Vêtements",
  recharge_jeu: "Recharges",
  abonnement_service: "Abonnements",
};

/*
  CORRECTIF — ce composant affichait un profil et des annonces
  entièrement inventés (VENDEUR / ANNONCES_VENDEUR codés en dur),
  quel que soit le vendeur cliqué depuis Le Marché. Il charge
  maintenant le vrai vendeur (table `vendeurs`) et ses vrais produits
  validés à partir de l'id dans l'URL (/marche/vendeur/[id]).
*/
export default function ProfilVendeurMarche() {
  const router = useRouter();
  const params = useParams();
  const vendeurId = params?.id;
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];

  const [vendeur, setVendeur] = useState(null);
  const [produits, setProduits] = useState([]);
  const [filtreType, setFiltreType] = useState("Tous");
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState(null);
  const [ouvertureConversation, setOuvertureConversation] = useState(false);
  const [erreurConversation, setErreurConversation] = useState(null);

  const charger = async () => {
    if (!vendeurId) return;
    setChargement(true);
    setErreurChargement(null);
    try {
      const { data: v, error: erreurVendeur } = await supabase
        .from("vendeurs")
        .select("id, nom_boutique, ville, pays, niveau, statut, date_creation, note_moyenne, nb_avis, nb_ventes, derniere_activite, en_pause, message_pause")
        .eq("id", vendeurId)
        .eq("niveau", "vendeur_simple")
        .single();
      if (erreurVendeur) throw new Error("Vendeur introuvable.");
      setVendeur(v);

      const { data: p, error: erreurProduits } = await supabase
        .from("produits")
        .select("id, nom, prix_base, images, type")
        .eq("vendeur_id", vendeurId)
        .eq("statut_validation", "valide")
        .order("date_creation", { ascending: false });
      if (erreurProduits) throw erreurProduits;
      setProduits(p || []);
    } catch (e) {
      setErreurChargement(e.message || "Impossible de charger ce profil.");
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(); }, [vendeurId]);

  const demarrerConversation = async () => {
    if (!vendeur) return;
    setOuvertureConversation(true);
    setErreurConversation(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const reponse = await fetch("/api/messages/demarrer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ vendeurId: vendeur.id }),
      });
      const data = await reponse.json();
      if (!reponse.ok) throw new Error(data.error || "Impossible d'ouvrir la conversation.");
      router.push(`/messages/${data.conversationId}`);
    } catch (e) {
      setOuvertureConversation(false);
      setErreurConversation(e.message || "Impossible d'ouvrir la conversation.");
    }
  };

  const typesDisponibles = ["Tous", ...new Set(produits.map((p) => LIBELLES_TYPE[p.type] || p.type))];
  const produitsFiltres = filtreType === "Tous" ? produits : produits.filter((p) => (LIBELLES_TYPE[p.type] || p.type) === filtreType);

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">Profil vendeur</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-10">
        {chargement && (
          <div className="flex flex-col items-center justify-center gap-2 py-20">
            <Loader2 size={28} color={COLORS.accentPrimary} className="animate-spin" />
            <p className="text-xs" style={{ color: COLORS.textMuted }}>Chargement du profil...</p>
          </div>
        )}

        {!chargement && erreurChargement && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <AlertTriangle size={28} color="#B23A2E" />
            <p className="text-sm font-semibold">Impossible de charger ce profil</p>
            <p className="text-xs" style={{ color: COLORS.textMuted }}>{erreurChargement}</p>
            <button
              onClick={charger}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold mt-1"
              style={{ background: COLORS.accentPrimary, color: COLORS.background }}
            >
              <RefreshCw size={13} /> Réessayer
            </button>
          </div>
        )}

        {!chargement && !erreurChargement && vendeur && (
          <>
            {/* En-tête profil */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 relative" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <Store size={24} color={COLORS.accentPrimary} />
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full"
                  style={{
                    background: vendeur.derniere_activite && (Date.now() - new Date(vendeur.derniere_activite).getTime()) < 5 * 60 * 1000 ? "#3A8A5C" : COLORS.textMuted,
                    border: `2px solid ${COLORS.background}`,
                  }}
                  title={vendeur.derniere_activite && (Date.now() - new Date(vendeur.derniere_activite).getTime()) < 5 * 60 * 1000 ? "En ligne" : "Hors ligne"}
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-base">{vendeur.nom_boutique}</p>
                  {vendeur.statut === "valide" && (
                    <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: COLORS.accentSecondary, color: COLORS.background }}>
                      <ShieldCheck size={10} /> Vérifié
                    </span>
                  )}
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: vendeur.derniere_activite && (Date.now() - new Date(vendeur.derniere_activite).getTime()) < 5 * 60 * 1000 ? "#3A8A5C" : COLORS.textMuted }}>
                  {vendeur.derniere_activite && (Date.now() - new Date(vendeur.derniere_activite).getTime()) < 5 * 60 * 1000 ? "En ligne" : "Hors ligne"}
                </p>
                <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: COLORS.textMuted }}>
                  <MapPin size={11} /> {drapeauPourPays(vendeur.pays)} {vendeur.ville ? `${vendeur.ville}, ` : ""}{nomPourPays(vendeur.pays)}
                </p>
                <p className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: COLORS.textMuted }}>
                  <Calendar size={11} /> Membre depuis {new Date(vendeur.date_creation).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                </p>
              </div>
            </div>

            {vendeur.en_pause && (
              <div className="rounded-lg px-3 py-2 mb-4 text-[11px]" style={{ background: "rgba(178,58,46,0.1)", color: "#B23A2E" }}>
                ⏸ {vendeur.message_pause || "Ce vendeur est temporairement indisponible — nouvelles commandes fermées."}
              </div>
            )}

            <div className="rounded-xl px-3 py-2 mb-4 text-[11px]" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.textMuted }}>
              Profil du Marché — vendeur particulier, biens physiques uniquement.
            </div>

            <button
              onClick={demarrerConversation}
              disabled={ouvertureConversation}
              className="w-full rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 mb-2"
              style={{ background: COLORS.accentPrimary, color: COLORS.background }}
            >
              <MessageCircle size={16} /> {ouvertureConversation ? "Ouverture..." : "Envoyer un message"}
            </button>
            {erreurConversation && (
              <p className="text-[11px] mb-2 text-center" style={{ color: "#B23A2E" }}>{erreurConversation}</p>
            )}
            <Link
              href={`/contact?vendeur=${vendeur.id}`}
              className="w-full rounded-xl py-2 text-xs flex items-center justify-center gap-1.5 mb-4"
              style={{ color: COLORS.textMuted }}
            >
              <Flag size={12} /> Signaler ce vendeur
            </Link>

            {/* Filtres catégorie */}
            {produits.length > 0 && (
              <div className="flex gap-2 mb-3 overflow-x-auto">
                {typesDisponibles.map((t) => (
                  <button
                    key={t}
                    onClick={() => setFiltreType(t)}
                    className="text-xs px-3 py-1.5 rounded-full flex-shrink-0"
                    style={{
                      background: filtreType === t ? COLORS.accentPrimary : COLORS.surface,
                      color: filtreType === t ? COLORS.background : COLORS.textMuted,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            {/* Annonces */}
            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: COLORS.accentPrimary }}>
              Ses annonces ({produitsFiltres.length})
            </p>

            {produits.length === 0 && (
              <p className="text-sm text-center py-10" style={{ color: COLORS.textMuted }}>
                Ce vendeur n'a pas encore publié d'annonce.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              {produitsFiltres.map((p) => (
                <Link
                  href={`/produit/${p.id}`}
                  key={p.id}
                  className="rounded-xl overflow-hidden block"
                  style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
                >
                  <div className="h-24" style={{ background: p.images?.[0] ? `url(${p.images[0]}) center/cover` : COLORS.background }} />
                  <div className="p-2.5">
                    <p className="text-xs font-semibold leading-tight">{p.nom}</p>
                    <p className="text-sm font-bold mt-1" style={{ color: COLORS.accentPrimary }}>{Number(p.prix_base).toLocaleString()} FCFA</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
