"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Sun, Moon, Lock, Bell, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "../lib/ThemeContext";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { chargerParametres, sauverParametres } from "../lib/parametres-client";
import { activerPush, desactiverPush, abonnementPushActif, pushSupporte } from "../lib/push-client";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};
const DELAIS = [0, 1, 5, 15, 30, 60];

function Interrupteur({ actif, onClick, COLORS, desactive }) {
  return (
    <button
      onClick={onClick}
      disabled={desactive}
      role="switch"
      aria-checked={actif}
      className="w-10 h-6 rounded-full relative shrink-0"
      style={{ background: actif ? COLORS.accentPrimary : COLORS.border, opacity: desactive ? 0.6 : 1 }}
    >
      <div className="w-4 h-4 rounded-full absolute top-1 transition-all" style={{ background: COLORS.background, left: actif ? 22 : 4 }} />
    </button>
  );
}

export default function ParametresCompte() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const COLORS = THEMES[theme] || THEMES.clair;
  const [p, setP] = useState(null);
  const [message, setMessage] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [pushActif, setPushActif] = useState(false);
  const [pushEnCours, setPushEnCours] = useState(false);

  useEffect(() => {
    chargerParametres(true).then(setP);
    abonnementPushActif().then(setPushActif);
  }, []);

  const maj = async (patch) => {
    const avant = p;
    setP({ ...p, ...patch });
    setErreur(null);
    setMessage(null);
    try {
      setP(await sauverParametres(patch));
      setMessage(t("parametres.enregistre"));
    } catch (e) {
      setP(avant);
      setErreur(t("parametres.erreurEnregistrement"));
    }
  };

  const basculerPush = async () => {
    setErreur(null);
    setPushEnCours(true);
    try {
      if (pushActif) {
        await desactiverPush();
        setPushActif(false);
      } else {
        const r = await activerPush();
        if (r.ok) setPushActif(true);
        else {
          const messages = {
            non_supporte: t("compte.notifNonSupporte"),
            refuse: t("compte.notifRefuse"),
            cle_manquante: t("compte.notifCleManquante"),
            erreur_serveur: t("compte.notifErreurServeur"),
          };
          setErreur(messages[r.raison] || t("compte.notifImpossible"));
        }
      }
    } catch {
      setErreur(t("compte.notifNonSupporte"));
    } finally {
      setPushEnCours(false);
    }
  };

  const libelleDelai = (m) => (m === 0 ? t("parametres.delaiOuverture") : m === 60 ? t("parametres.delaiHeure") : t("parametres.delaiMinutes", { n: m }));
  const carte = { background: COLORS.surface, border: `1px solid ${COLORS.border}` };
  const ligne = (titre, desc, actif, onClick, desactive) => (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{titre}</p>
        {desc && <p className="text-[11px]" style={{ color: COLORS.textMuted }}>{desc}</p>}
      </div>
      <Interrupteur actif={actif} onClick={onClick} COLORS={COLORS} desactive={desactive} />
    </div>
  );

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3" style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}>
        <button onClick={() => router.back()} aria-label={t("common.retour")}><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">{t("parametres.titre")}</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label={t("common.changerTheme")}>
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 flex flex-col gap-5" style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}>
        {message && <p className="text-[11px] font-semibold" style={{ color: COLORS.accentSecondary }}>{message}</p>}
        {erreur && <p className="text-[11px] font-semibold" style={{ color: "#B23A2E" }}>{erreur}</p>}

        {/* Sécurité */}
        <section className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.accentPrimary }}>{t("parametres.sectionSecurite")}</p>
          <div className="rounded-xl p-3" style={carte}>
            <div className="flex items-center gap-2 mb-1"><Lock size={15} color={COLORS.accentSecondary} /><p className="text-sm font-semibold">{t("parametres.verrouillage")}</p></div>
            <p className="text-[11px] mb-2" style={{ color: COLORS.textMuted }}>{t("parametres.verrouillageDesc")}</p>
            <select
              value={p ? p.pin_delai_minutes : 5}
              disabled={!p}
              onChange={(e) => maj({ pin_delai_minutes: Number(e.target.value) })}
              className="w-full rounded-lg px-2 py-2 text-sm"
              style={{ background: COLORS.background, border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary }}
            >
              {DELAIS.map((m) => <option key={m} value={m}>{libelleDelai(m)}</option>)}
            </select>
          </div>
          <div className="rounded-xl px-3 py-1" style={carte}>
            {ligne(t("parametres.pinActions"), t("parametres.pinActionsDesc"), p ? p.pin_pour_actions : true, () => maj({ pin_pour_actions: !p.pin_pour_actions }), !p)}
          </div>
          <Link href="/securite/modifier-pin" className="rounded-xl px-3 py-3 flex items-center gap-3" style={carte}>
            <Lock size={16} color={COLORS.accentSecondary} />
            <span className="flex-1 text-sm">{t("parametres.modifierPin")}</span>
            <ChevronRight size={15} color={COLORS.textMuted} />
          </Link>
        </section>

        {/* Notifications */}
        <section className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.accentPrimary }}>{t("parametres.sectionNotifs")}</p>
          <div className="rounded-xl px-3 py-1" style={carte}>
            {pushSupporte() && ligne(t("parametres.pushAppareil"), null, pushActif, basculerPush, pushEnCours)}
            {ligne(t("parametres.notifCommandes"), t("parametres.notifCommandesDesc"), p ? p.notif_commandes : true, () => maj({ notif_commandes: !p.notif_commandes }), !p)}
            {ligne(t("parametres.notifMessages"), t("parametres.notifMessagesDesc"), p ? p.notif_messages : true, () => maj({ notif_messages: !p.notif_messages }), !p)}
            {ligne(t("parametres.notifPromos"), t("parametres.notifPromosDesc"), p ? p.notif_promotions : true, () => maj({ notif_promotions: !p.notif_promotions }), !p)}
          </div>
          <p className="text-[11px] flex items-start gap-1" style={{ color: COLORS.textMuted }}><Bell size={12} className="mt-0.5 shrink-0" />{t("parametres.notifImportantes")}</p>
        </section>
      </main>
    </div>
  );
}
