"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Check, Crown, Shield, Star, Sun, Moon, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import ConfirmationPIN from "./ConfirmationPIN";
import { useTheme } from "../lib/ThemeContext";
import { useLanguage } from "../lib/i18n/LanguageContext";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

// Libellés traduits à l'affichage via t() dans le composant (nomCle,
// avantagesCles) — "id" reste la valeur technique envoyée à l'API.
const PALIERS = [
  { id: "gratuit", nomCle: "nomGratuit", icone: Shield, avantagesCles: ["avGratuit1", "avGratuit2", "avGratuit3"] },
  { id: "basic", nomCle: "nomBasic", icone: Shield, avantagesCles: ["avBasic1", "avBasic2", "avBasic3"] },
  { id: "pro", nomCle: "nomPro", icone: Star, avantagesCles: ["avPro1", "avPro2", "avPro3", "avPro4"] },
  { id: "premium", nomCle: "nomPremium", icone: Crown, avantagesCles: ["avPremium1", "avPremium2", "avPremium3", "avPremium4", "avPremium5"] },
];

const DUREES = [1, 3, 6, 12];

export default function Abonnements() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const COLORS = THEMES[theme];
  const [grille, setGrille] = useState({});
  const [dureeChoisie, setDureeChoisie] = useState(1);
  const [abonnementActif, setAbonnementActif] = useState(null);
  const [enCours, setEnCours] = useState(null);
  const [resiliationEnCours, setResiliationEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(null);
  // CORRECTIF — il n'y avait aucun état de chargement ni de gestion
  // d'erreur sur le chargement initial (contrairement à Portefeuille,
  // DashboardVendeur, etc.) : les erreurs Supabase étaient ignorées
  // (seul `data` était déstructuré, jamais `error`), et rien
  // n'indiquait visuellement qu'un chargement était en cours. En cas
  // de souci réseau ou de RLS mal configurée, la page restait figée
  // avec des prix en "…", sans spinner ni message — donnant
  // l'impression que rien ne se passe après le clic.
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState(null);
  const [palierEnAttentePin, setPalierEnAttentePin] = useState(null);

  const charger = async () => {
    setChargement(true);
    setErreurChargement(null);
    try {
      const { data: tarifs, error: erreurTarifs } = await supabase
        .from("grille_tarifs_abonnement")
        .select("palier, duree_mois, prix_fcfa");
      if (erreurTarifs) throw erreurTarifs;
      if (tarifs) {
        const map = {};
        tarifs.forEach((t) => { map[`${t.palier}-${t.duree_mois}`] = Number(t.prix_fcfa); });
        setGrille(map);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: abo, error: erreurAbo } = await supabase
          .from("abonnements_utilisateur")
          .select("palier, date_fin, renouvellement_auto")
          .eq("user_id", user.id)
          .eq("statut", "actif")
          .gte("date_fin", new Date().toISOString())
          .maybeSingle();
        if (erreurAbo) throw erreurAbo;
        if (abo) setAbonnementActif(abo);
      }
    } catch (e) {
      setErreurChargement(e.message || t("abonnements.impossibleChargerDefaut"));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(); }, []);

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
      if (!reponse.ok) throw new Error(data.error || t("abonnements.echecSouscription"));
      setSucces(t("abonnements.abonnementActivePour", { palier, duree: dureeChoisie }));
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
      if (!reponse.ok) throw new Error(data.error || t("abonnements.echecResiliation"));
      setAbonnementActif((prev) => (prev ? { ...prev, renouvellement_auto: false } : prev));
      setSucces(t("abonnements.renouvellementDesactiveConfirm"));
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
        <button onClick={() => router.back()} aria-label={t("common.retour")}><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">{t("nav.abonnementsTekca")}</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label={t("common.changerTheme")}>
          {theme === "sombre" ? <Sun size={18} color={COLORS.accentSecondary} /> : <Moon size={18} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="pt-20 pb-16 px-4 max-w-md mx-auto w-full">
        <h1 className="text-xl font-bold text-center">{t("abonnements.choisisForfait")}</h1>
        <p className="text-xs text-center mt-1" style={{ color: COLORS.textMuted }}>
          {t("abonnements.moinsCommissionDesc")}
        </p>

        {chargement && (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <Loader2 size={28} color={COLORS.accentPrimary} className="animate-spin" />
            <p className="text-xs" style={{ color: COLORS.textMuted }}>{t("abonnements.chargementForfaits")}</p>
          </div>
        )}

        {!chargement && erreurChargement && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertTriangle size={28} color="#B23A2E" />
            <p className="text-sm font-semibold">{t("abonnements.impossibleCharger")}</p>
            <p className="text-xs" style={{ color: COLORS.textMuted }}>{erreurChargement}</p>
            <button
              onClick={charger}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold mt-1"
              style={{ background: COLORS.accentPrimary, color: COLORS.background }}
            >
              <RefreshCw size={13} /> {t("dashboard.reessayer")}
            </button>
          </div>
        )}

        {!chargement && !erreurChargement && (
        <>
        {abonnementActif && (
          <div className="mt-4 rounded-xl p-3 text-center text-xs" style={{ background: COLORS.surface, border: `1px solid ${COLORS.accentSecondary}` }}>
            <p>
              {t("abonnements.abonnementMot")} <strong className="uppercase">{abonnementActif.palier}</strong> {t("abonnements.actifJusquauMot")}{" "}
              {new Date(abonnementActif.date_fin).toLocaleDateString("fr-FR")}
            </p>
            <p className="mt-1" style={{ color: COLORS.textMuted }}>
              {abonnementActif.renouvellement_auto
                ? t("abonnements.renouvellementActiveDesc")
                : t("abonnements.renouvellementDesactiveDesc")}
            </p>
            {abonnementActif.renouvellement_auto && (
              <button
                onClick={resilier}
                disabled={resiliationEnCours}
                className="mt-2 text-[11px] font-semibold underline"
                style={{ color: "#B23A2E" }}
              >
                {resiliationEnCours ? "..." : t("abonnements.desactiverRenouvellement")}
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
              {t("abonnements.moisSuffix", { n: d })}{d === 12 ? t("abonnements.offert2") : d > 1 ? t("abonnements.remisePct", { pct: d === 3 ? 10 : 20 }) : ""}
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
                  <span className="text-lg font-bold uppercase">{t(`abonnements.${palier.nomCle}`)}</span>
                  {estActif && (
                    <span className="ml-auto text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: COLORS.accentSecondary, color: COLORS.background }}>
                      {t("abonnements.actif")}
                    </span>
                  )}
                </div>

                <p className="text-2xl font-extrabold">
                  {estGratuit ? "0" : prix ? prix.toLocaleString() : "…"}{" "}
                  <span className="text-sm font-normal" style={{ color: COLORS.textMuted }}>
                    FCFA{!estGratuit ? t("abonnements.parMois", { n: dureeChoisie }) : ""}
                  </span>
                </p>

                <ul className="flex flex-col gap-2 mt-4">
                  {palier.avantagesCles.map((cle) => (
                    <li key={cle} className="flex items-start gap-2 text-sm">
                      <Check size={15} color={COLORS.accentPrimary} className="mt-0.5 flex-shrink-0" />
                      <span style={{ color: COLORS.textMuted }}>{t(`abonnements.${cle}`)}</span>
                    </li>
                  ))}
                </ul>

                {!estGratuit && (
                  <button
                    onClick={() => setPalierEnAttentePin(palier.id)}
                    disabled={enCours === palier.id || estActif}
                    className="w-full rounded-lg py-3 mt-5 font-semibold text-sm"
                    style={{
                      background: estActif ? COLORS.border : COLORS.accentPrimary,
                      color: estActif ? COLORS.textMuted : COLORS.background,
                    }}
                  >
                    {estActif ? t("abonnements.dejaActifMasc") : enCours === palier.id ? t("abonnements.traitementDots") : t("abonnements.sabonner")}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-center mt-5" style={{ color: COLORS.textMuted }}>
          {t("abonnements.paiementPortefeuilleDesc")}
        </p>
        </>
        )}
      </main>

      <ConfirmationPIN
        ouvert={!!palierEnAttentePin}
        theme={theme}
        onAnnuler={() => setPalierEnAttentePin(null)}
        onSuccess={() => {
          const palier = palierEnAttentePin;
          setPalierEnAttentePin(null);
          souscrire(palier);
        }}
      />
    </div>
  );
}
