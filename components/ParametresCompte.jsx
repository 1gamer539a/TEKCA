"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Sun, Moon, Lock, Bell, ChevronRight, KeyRound, Fingerprint, ShieldCheck, FileText, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { chargerParametres, sauverParametres } from "../lib/parametres-client";
import { activerPush, desactiverPush, abonnementPushActif, pushSupporte } from "../lib/push-client";
import ConfirmationPIN from "./ConfirmationPIN";
import SuppressionCompte from "./SuppressionCompte";

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
  const [afficherSuppression, setAfficherSuppression] = useState(false);

  // Mot de passe (comptes e-mail uniquement)
  const [compteEmail, setCompteEmail] = useState(true);
  const [mdpOuvert, setMdpOuvert] = useState(false);
  const [ancien, setAncien] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [mdpErreur, setMdpErreur] = useState(null);
  const [mdpSucces, setMdpSucces] = useState(false);
  const [mdpEnCours, setMdpEnCours] = useState(false);
  const [pinMdpOuvert, setPinMdpOuvert] = useState(false);
  // Double authentification (TOTP — Google Authenticator, Authy…) via Supabase Auth MFA
  const [facteur, setFacteur] = useState(null); // facteur vérifié, s'il existe
  const [enrolement, setEnrolement] = useState(null); // { id, qr, secret } pendant l'activation
  const [codeMfa, setCodeMfa] = useState("");
  const [mfaEnCours, setMfaEnCours] = useState(false);
  const [pinMfaOuvert, setPinMfaOuvert] = useState(false);

  const chargerFacteur = async () => {
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      setFacteur(data?.totp?.[0] || null);
    } catch {
      setFacteur(null);
    }
  };
  useEffect(() => { chargerFacteur(); }, []);

  const activerMfa = async () => {
    setErreur(null);
    setMfaEnCours(true);
    try {
      // Nettoie une activation abandonnée avant d'en démarrer une nouvelle.
      const { data: tous } = await supabase.auth.mfa.listFactors();
      for (const f of tous?.all || []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `TEKCA-${Date.now()}` });
      if (error) throw error;
      setEnrolement({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCodeMfa("");
    } catch {
      setErreur(t("parametres.mfaErreurActiver"));
    } finally {
      setMfaEnCours(false);
    }
  };
  const confirmerMfa = async () => {
    setErreur(null);
    setMfaEnCours(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolement.id, code: codeMfa.trim() });
      if (error) throw error;
      setEnrolement(null);
      setCodeMfa("");
      await chargerFacteur();
      setMessage(t("parametres.mfaActivee"));
    } catch {
      setErreur(t("parametres.mfaErreurCode"));
    } finally {
      setMfaEnCours(false);
    }
  };
  const desactiverMfa = async () => {
    setPinMfaOuvert(false);
    setErreur(null);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: facteur.id });
      if (error) throw error;
      setFacteur(null);
      setMessage(t("parametres.mfaDesactivee"));
    } catch {
      setErreur(t("parametres.mfaErreurDesactiver"));
    }
  };

  useEffect(() => {
    chargerParametres(true).then(setP);
    abonnementPushActif().then(setPushActif);
    supabase.auth.getUser().then(({ data }) => setCompteEmail(data?.user?.app_metadata?.provider === "email"));
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

  const demanderChangementMdp = () => {
    setMdpErreur(null);
    setMdpSucces(false);
    if (nouveau.length < 8) return setMdpErreur(t("parametres.motDePasseCourt"));
    if (nouveau !== confirmation) return setMdpErreur(t("parametres.motsDePasseDifferents"));
    if (!ancien) return setMdpErreur(t("parametres.motDePasseIncorrect"));
    setPinMdpOuvert(true); // le PIN valide l'action
  };

  const changerMdp = async (pin) => {
    setPinMdpOuvert(false);
    setMdpEnCours(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/compte/mot-de-passe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ ancienMotDePasse: ancien, nouveauMotDePasse: nouveau, pin }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMdpErreur(d.code === "ancien_incorrect" ? t("parametres.motDePasseIncorrect") : d.error || t("parametres.erreurEnregistrement"));
        return;
      }
      setMdpSucces(true);
      setAncien("");
      setNouveau("");
      setConfirmation("");
      setMdpOuvert(false);
      setMessage(t("parametres.motDePasseModifie"));
    } catch {
      setMdpErreur(t("parametres.erreurEnregistrement"));
    } finally {
      setMdpEnCours(false);
    }
  };

  const libelleDelai = (m) => (m === 0 ? t("parametres.delaiOuverture") : m === 60 ? t("parametres.delaiHeure") : t("parametres.delaiMinutes", { n: m }));
  const carte = { background: COLORS.surface, border: `1px solid ${COLORS.border}` };
  const champ = { background: COLORS.background, border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary };
  const ligne = (titre, desc, actif, onClick, desactive) => (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{titre}</p>
        {desc && <p className="text-[11px]" style={{ color: COLORS.textMuted }}>{desc}</p>}
      </div>
      <Interrupteur actif={actif} onClick={onClick} COLORS={COLORS} desactive={desactive} />
    </div>
  );
  const titreSection = (s) => <p className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.accentPrimary }}>{s}</p>;
  const lienRow = (href, Icone, libelle) => (
    <Link href={href} className="rounded-xl px-3 py-3 flex items-center gap-3" style={carte}>
      <Icone size={16} color={COLORS.accentSecondary} />
      <span className="flex-1 text-sm">{libelle}</span>
      <ChevronRight size={15} color={COLORS.textMuted} />
    </Link>
  );

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3" style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}>
        <button onClick={() => (window.history.length > 1 ? router.back() : router.push("/compte"))} aria-label={t("common.retour")}><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
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
          {titreSection(t("parametres.sectionSecurite"))}
          <div className="rounded-xl p-3" style={carte}>
            <div className="flex items-center gap-2 mb-1"><Lock size={15} color={COLORS.accentSecondary} /><p className="text-sm font-semibold">{t("parametres.verrouillage")}</p></div>
            <p className="text-[11px] mb-2" style={{ color: COLORS.textMuted }}>{t("parametres.verrouillageDesc")}</p>
            <select
              value={p ? p.pin_delai_minutes : 5}
              disabled={!p}
              onChange={(e) => maj({ pin_delai_minutes: Number(e.target.value) })}
              className="w-full rounded-lg px-2 py-2 text-sm"
              style={champ}
            >
              {DELAIS.map((m) => <option key={m} value={m}>{libelleDelai(m)}</option>)}
            </select>
          </div>
          <div className="rounded-xl px-3 py-1" style={carte}>
            {ligne(t("parametres.pinActions"), t("parametres.pinActionsDesc"), p ? p.pin_pour_actions : true, () => maj({ pin_pour_actions: !p.pin_pour_actions }), !p)}
          </div>
          {lienRow("/securite/modifier-pin", Lock, t("parametres.modifierPin"))}

          {/* Modifier le mot de passe */}
          <div className="rounded-xl p-3 flex flex-col gap-2" style={carte}>
            <button onClick={() => { setMdpOuvert((o) => !o); setMdpErreur(null); }} className="flex items-center gap-3 text-left">
              <KeyRound size={16} color={COLORS.accentSecondary} />
              <span className="flex-1 text-sm">{t("parametres.modifierMotDePasse")}</span>
              <ChevronRight size={15} color={COLORS.textMuted} style={{ transform: mdpOuvert ? "rotate(90deg)" : "none" }} />
            </button>
            {mdpOuvert && !compteEmail && <p className="text-[11px]" style={{ color: COLORS.textMuted }}>{t("parametres.motDePasseReseau")}</p>}
            {mdpOuvert && compteEmail && (
              <>
                <input type="password" autoComplete="current-password" value={ancien} onChange={(e) => setAncien(e.target.value)} placeholder={t("parametres.ancienMotDePasse")} className="rounded-lg px-3 py-2 text-sm" style={champ} />
                <input type="password" autoComplete="new-password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} placeholder={t("parametres.nouveauMotDePasse")} className="rounded-lg px-3 py-2 text-sm" style={champ} />
                <input type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder={t("parametres.confirmerMotDePasse")} className="rounded-lg px-3 py-2 text-sm" style={champ} />
                {mdpErreur && <p className="text-[11px] font-semibold" style={{ color: "#B23A2E" }}>{mdpErreur}</p>}
                {mdpSucces && <p className="text-[11px] font-semibold" style={{ color: COLORS.accentSecondary }}>{t("parametres.motDePasseModifie")}</p>}
                <button
                  onClick={demanderChangementMdp}
                  disabled={mdpEnCours || !ancien || !nouveau || !confirmation}
                  className="rounded-lg py-2.5 text-sm font-semibold"
                  style={{ background: COLORS.accentPrimary, color: COLORS.background, opacity: mdpEnCours || !ancien || !nouveau || !confirmation ? 0.6 : 1 }}
                >
                  {t("parametres.enregistrerMotDePasse")}
                </button>
              </>
            )}
          </div>
        </section>

        {/* Sécurité avancée (à venir) */}
        <section className="flex flex-col gap-2">
          {titreSection(t("parametres.sectionAvancee"))}
          {[[Fingerprint, "parametres.biometrie", "parametres.biometrieDesc"]].map(([Icone, titre, desc]) => (
            <div key={titre} className="rounded-xl px-3 py-3 flex items-center gap-3" style={{ ...carte, opacity: 0.65 }}>
              <Icone size={16} color={COLORS.accentSecondary} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{t(titre)}</p>
                <p className="text-[11px]" style={{ color: COLORS.textMuted }}>{t(desc)}</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: COLORS.border, color: COLORS.textMuted }}>{t("parametres.bientot")}</span>
            </div>
          ))}
        </section>

        {/* Double authentification (2FA) */}
        <section className="flex flex-col gap-2">
          <div className="rounded-xl p-3 flex flex-col gap-2" style={carte}>
            <div className="flex items-center gap-3">
              <ShieldCheck size={16} color={COLORS.accentSecondary} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{t("parametres.deuxFacteurs")}</p>
                <p className="text-[11px]" style={{ color: COLORS.textMuted }}>{t("parametres.deuxFacteursDesc")}</p>
              </div>
              {facteur ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: COLORS.accentSecondary, color: COLORS.background }}>{t("parametres.mfaActive")}</span>
              ) : null}
            </div>
            {!facteur && !enrolement && (
              <button onClick={activerMfa} disabled={mfaEnCours} className="rounded-lg py-2.5 text-sm font-semibold" style={{ background: COLORS.accentPrimary, color: COLORS.background, opacity: mfaEnCours ? 0.6 : 1 }}>
                {t("parametres.mfaActiver")}
              </button>
            )}
            {enrolement && (
              <div className="flex flex-col gap-2 items-center">
                <p className="text-[11px] self-start" style={{ color: COLORS.textMuted }}>{t("parametres.mfaScanner")}</p>
                <img src={enrolement.qr} alt="QR code 2FA" className="w-40 h-40 rounded-lg bg-white p-1" />
                <code className="text-[11px] break-all px-2 py-1 rounded" style={{ background: COLORS.background, border: `1px solid ${COLORS.border}` }}>{enrolement.secret}</code>
                <input
                  value={codeMfa}
                  onChange={(e) => setCodeMfa(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder={t("parametres.mfaCode")}
                  className="w-full rounded-lg px-3 py-2 text-center text-lg tracking-widest"
                  style={champ}
                />
                <button onClick={confirmerMfa} disabled={mfaEnCours || codeMfa.length !== 6} className="w-full rounded-lg py-2.5 text-sm font-semibold" style={{ background: COLORS.accentPrimary, color: COLORS.background, opacity: mfaEnCours || codeMfa.length !== 6 ? 0.6 : 1 }}>
                  {t("parametres.mfaConfirmer")}
                </button>
                <button onClick={() => setEnrolement(null)} className="text-[11px] font-semibold" style={{ color: COLORS.textMuted }}>{t("suppression.annuler")}</button>
              </div>
            )}
            {facteur && (
              <button onClick={() => setPinMfaOuvert(true)} className="rounded-lg py-2.5 text-sm font-semibold" style={{ border: "1px solid #B23A2E", color: "#B23A2E" }}>
                {t("parametres.mfaDesactiver")}
              </button>
            )}
          </div>
        </section>

        {/* Notifications */}
        <section className="flex flex-col gap-2">
          {titreSection(t("parametres.sectionNotifs"))}
          <div className="rounded-xl px-3 py-1" style={carte}>
            {pushSupporte() && ligne(t("parametres.pushAppareil"), null, pushActif, basculerPush, pushEnCours)}
            {ligne(t("parametres.notifCommandes"), t("parametres.notifCommandesDesc"), p ? p.notif_commandes : true, () => maj({ notif_commandes: !p.notif_commandes }), !p)}
            {ligne(t("parametres.notifMessages"), t("parametres.notifMessagesDesc"), p ? p.notif_messages : true, () => maj({ notif_messages: !p.notif_messages }), !p)}
            {ligne(t("parametres.notifPromos"), t("parametres.notifPromosDesc"), p ? p.notif_promotions : true, () => maj({ notif_promotions: !p.notif_promotions }), !p)}
          </div>
          <p className="text-[11px] flex items-start gap-1" style={{ color: COLORS.textMuted }}><Bell size={12} className="mt-0.5 shrink-0" />{t("parametres.notifImportantes")}</p>
        </section>

        {/* Conformité et clôture */}
        <section className="flex flex-col gap-2">
          {titreSection(t("parametres.sectionConformite"))}
          {lienRow("/cgu", FileText, t("parametres.cgu"))}
          {lienRow("/confidentialite", FileText, t("parametres.confidentialite"))}
          <button
            onClick={() => setAfficherSuppression(true)}
            className="w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 mt-1"
            style={{ border: "1px solid #B23A2E", color: "#B23A2E" }}
          >
            <Trash2 size={15} /> {t("parametres.supprimerCompte")}
          </button>
        </section>
      </main>

      <ConfirmationPIN obligatoire ouvert={pinMdpOuvert} theme={theme} onAnnuler={() => setPinMdpOuvert(false)} onSuccess={changerMdp} />
      <ConfirmationPIN obligatoire ouvert={pinMfaOuvert} theme={theme} onAnnuler={() => setPinMfaOuvert(false)} onSuccess={desactiverMfa} />
      <SuppressionCompte ouvert={afficherSuppression} onFermer={() => setAfficherSuppression(false)} COLORS={COLORS} />
    </div>
  );
}
