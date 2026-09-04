"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Check, Crown, Shield, Star, Sun, Moon } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

const PALIERS = [
  {
    id: "gratuit",
    nom: "Gratuit",
    icone: Shield,
    avantages: ["Commission vendeur : 10%", "10 produits maximum", "Frais de transfert : 7%"],
  },
  {
    id: "basic",
    nom: "Basic",
    icone: Shield,
    avantages: ["Commission vendeur : 7%", "50 produits, badge Vendeur Vérifié", "Frais de transfert : 5%"],
  },
  {
    id: "pro",
    nom: "Pro",
    icone: Star,
    avantages: ["Commission vendeur : 4%", "200 produits, mise en avant prioritaire", "Accès aux ventes flash 12h avant les autres", "Frais de transfert : 3%"],
  },
  {
    id: "premium",
    nom: "Premium",
    icone: Crown,
    avantages: ["Commission vendeur : 1%", "Produits illimités, mise en avant Top", "5% de cashback sur tes achats", "Litiges traités en priorité (2h)", "Frais de transfert : 1%"],
  },
];

const DUREES = [1, 3, 6, 12];

export default function Abonnements() {
  const router = useRouter();
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];
  const [grille, setGrille] = useState({});
  const [dureeChoisie, setDureeChoisie] = useState(1);
  const [abonnementActif, setAbonnementActif] = useState(null);
  const [enCours, setEnCours] = useState(null);
  const [resiliationEnCours, setResiliationEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(null);

  useEffect(() => {
    const charger = async () => {
      const { data: tarifs } = await supabase.from("grille_tarifs_abonnement").select("palier, duree_mois, prix_fcfa");
      if (tarifs) {
        const map = {};
        tarifs.forEach((t) => { map[`${t.palier}-${t.duree_mois}`] = Number(t.prix_fcfa); });
        setGrille(map);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: abo } = await supabase
          .from("abonnements_utilisateur")
          .select("palier, date_fin, renouvellement_auto")
          .eq("user_id", user.id)
          .eq("statut", "actif")
          .gte("date_fin", new Date().toISOString())
          .maybeSingle();
        if (abo) setAbonnementActif(abo);
      }
    };
    charger();
  }, []);

  const souscrire = async (palier) => {
    setErreur(null);
    setSucces(null);
    setEnCours(palier);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const reponse = await fetch("/api/abonnements/souscrire", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ palier, dureeMois: dureeChoisie }),
      });
      const data = await reponse.json();
      if (!reponse.ok) throw new Error(data.error || "Échec de la souscription.");
      setSucces(`Abonnement ${palier} activé pour ${dureeChoisie} mois.`);
      setAbonnementActif({ palier, date_fin: data.abonnement.date_fin, renouvellement_auto: true });
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  };

  const resilier = async () => {
    setErreur(null);
    setSucces(null);
    setResiliationEnCours(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const reponse = await fetch("/api/abonnements/resilier", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await reponse.json();
      if (!reponse.ok) throw new Error(data.error || "Échec de la résiliation.");
      setAbonnementActif((prev) => (prev ? { ...prev, renouvellement_auto: false } : prev));
      setSucces("Renouvellement automatique désactivé. Ton abonnement reste actif jusqu'à son échéance.");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setResiliationEnCours(false);
    }
  };

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">Abonnements TEKÇA</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={18} color={COLORS.accentSecondary} /> : <Moon size={18} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="pt-20 pb-16 px-4 max-w-md mx-auto w-full">
        <h1 className="text-xl font-bold text-center">Choisis ton forfait</h1>
        <p className="text-xs text-center mt-1" style={{ color: COLORS.textMuted }}>
          Moins de commission sur tes achats et tes ventes — que tu sois acheteur, vendeur, ou les deux.
        </p>

        {abonnementActif && (
          <div className="mt-4 rounded-xl p-3 text-center text-xs" style={{ background: COLORS.surface, border: `1px solid ${COLORS.accentSecondary}` }}>
            <p>
              Abonnement <strong className="uppercase">{abonnementActif.palier}</strong> actif jusqu'au{" "}
              {new Date(abonnementActif.date_fin).toLocaleDateString("fr-FR")}
            </p>
            <p className="mt-1" style={{ color: COLORS.textMuted }}>
              {abonnementActif.renouvellement_auto
                ? "Renouvellement automatique activé (si ton portefeuille a le solde)."
                : "Renouvellement automatique désactivé — expirera à cette date."}
            </p>
            {abonnementActif.renouvellement_auto && (
              <button
                onClick={resilier}
                disabled={resiliationEnCours}
                className="mt-2 text-[11px] font-semibold underline"
                style={{ color: "#B23A2E" }}
              >
                {resiliationEnCours ? "..." : "Désactiver le renouvellement automatique"}
              </button>
            )}
          </div>
        )}

        {/* Sélecteur de durée */}
        <div className="flex gap-2 mt-5">
          {DUREES.map((d) => (
            <button
              key={d}
              onClick={() => setDureeChoisie(d)}
              className="flex-1 rounded-lg py-2 text-xs font-semibold"
              style={{
                background: dureeChoisie === d ? COLORS.accentPrimary : COLORS.surface,
                color: dureeChoisie === d ? COLORS.background : COLORS.textMuted,
                border: `1px solid ${dureeChoisie === d ? COLORS.accentPrimary : COLORS.border}`,
              }}
            >
              {d} mois{d === 12 ? " (2 offerts)" : d > 1 ? ` (-${d === 3 ? 10 : 20}%)` : ""}
            </button>
          ))}
        </div>

        {erreur && <p className="text-xs text-center mt-3" style={{ color: "#B23A2E" }}>{erreur}</p>}
        {succes && <p className="text-xs text-center mt-3" style={{ color: "#3A8A5C" }}>{succes}</p>}

        <div className="flex flex-col gap-4 mt-5">
          {PALIERS.map((palier) => {
            const Icone = palier.icone;
            const estGratuit = palier.id === "gratuit";
            const prix = estGratuit ? 0 : grille[`${palier.id}-${dureeChoisie}`];
            const estActif = estGratuit ? !abonnementActif : abonnementActif?.palier === palier.id;
            const estMisEnAvant = palier.id === "pro";

            return (
              <div
                key={palier.id}
                className="rounded-2xl p-5 relative"
                style={{
                  background: COLORS.surface,
                  border: `${estMisEnAvant ? 2 : 1}px solid ${estMisEnAvant ? COLORS.accentPrimary : COLORS.border}`,
                  boxShadow: estMisEnAvant ? `0 0 24px ${COLORS.accentPrimary}33` : "none",
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Icone size={20} color={COLORS.accentPrimary} />
                  <span className="text-lg font-bold uppercase">{palier.nom}</span>
                  {estActif && (
                    <span className="ml-auto text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: COLORS.accentSecondary, color: COLORS.background }}>
                      Actif
                    </span>
                  )}
                </div>

                <p className="text-2xl font-extrabold">
                  {estGratuit ? "0" : prix ? prix.toLocaleString() : "…"}{" "}
                  <span className="text-sm font-normal" style={{ color: COLORS.textMuted }}>
                    FCFA{!estGratuit ? ` / ${dureeChoisie} mois` : ""}
                  </span>
                </p>

                <ul className="flex flex-col gap-2 mt-4">
                  {palier.avantages.map((a) => (
                    <li key={a} className="flex items-start gap-2 text-sm">
                      <Check size={15} color={COLORS.accentPrimary} className="mt-0.5 flex-shrink-0" />
                      <span style={{ color: COLORS.textMuted }}>{a}</span>
                    </li>
                  ))}
                </ul>

                {!estGratuit && (
                  <button
                    onClick={() => souscrire(palier.id)}
                    disabled={enCours === palier.id || estActif}
                    className="w-full rounded-lg py-3 mt-5 font-semibold text-sm"
                    style={{
                      background: estActif ? COLORS.border : COLORS.accentPrimary,
                      color: estActif ? COLORS.textMuted : COLORS.background,
                    }}
                  >
                    {estActif ? "Déjà actif" : enCours === palier.id ? "Traitement..." : "S'abonner"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-center mt-5" style={{ color: COLORS.textMuted }}>
          Paiement depuis ton portefeuille TEKÇA. Renouvellement automatique à l'échéance si ton solde le permet — désactivable à tout moment, sans couper la période déjà payée.
        </p>
      </main>
    </div>
  );
}
