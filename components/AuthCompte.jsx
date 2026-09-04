"use client";

import React, { useState } from "react";
import { ArrowLeft, Sun, Moon, Phone, Lock, User, Mail, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../lib/i18n/LanguageContext";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

/*
  Un seul compte (table `users`) sert pour tout : achats, vente,
  chat, IA premium, etc. Pas de compte séparé par univers.
*/
export default function AuthCompte() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];
  const [mode, setMode] = useState("connexion"); // connexion | inscription
  const [voirMdp, setVoirMdp] = useState(false);

  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [captchaCoche, setCaptchaCoche] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [succes, setSucces] = useState(false);
  const [champsInvalides, setChampsInvalides] = useState([]);
  const [enCoursSocial, setEnCoursSocial] = useState(null); // "google" | "facebook" | "apple" | null

  /*
    Message volontairement générique dans tous les cas d'échec de
    connexion (mauvais mot de passe OU email inexistant) — ne jamais
    distinguer les deux, ça permettrait à un attaquant de deviner
    quels emails ont un compte (énumération de comptes).
  */
  const MESSAGE_ECHEC_CONNEXION = t("auth.identifiantsIncorrects");

  const seConnecter = async () => {
    setErreur(null);
    setChampsInvalides([]);
    if (!email || !motDePasse) {
      setErreur(t("auth.champsRequisConnexion"));
      setChampsInvalides([!email && "email", !motDePasse && "motDePasse"].filter(Boolean));
      return;
    }
    setEnCours(true);
    try {
      // Vérifie le rate limiting AVANT de tenter la connexion —
      // bloque après trop d'échecs récents sur ce compte ou cette IP.
      const reponseLimite = await fetch("/api/auth/verifier-limite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const donneesLimite = await reponseLimite.json();
      if (donneesLimite.bloque) {
        setErreur(donneesLimite.message);
        setEnCours(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
      if (error) {
        // Journalise l'échec pour le rate limiting, sans jamais
        // révéler à l'utilisateur la raison exacte du refus.
        fetch("/api/auth/journaliser-echec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }).catch(() => {});
        setErreur(MESSAGE_ECHEC_CONNEXION);
        setEnCours(false);
        return;
      }

      setSucces(true);
      setTimeout(() => router.push(searchParams.get("suite") || "/"), 900);
    } catch (e) {
      setErreur(MESSAGE_ECHEC_CONNEXION);
      setEnCours(false);
    }
  };

  const creerCompte = async () => {
    setErreur(null);
    setChampsInvalides([]);
    if (!nom || !email || !motDePasse) {
      setErreur(t("auth.champsRequisInscription"));
      setChampsInvalides([!nom && "nom", !email && "email", !motDePasse && "motDePasse"].filter(Boolean));
      return;
    }
    setEnCours(true);
    try {
      // Le mot de passe est haché par Supabase Auth (bcrypt), jamais
      // par notre code — voir auth_setup.sql pour le trigger qui crée
      // automatiquement la ligne public.users correspondante.
      const { error } = await supabase.auth.signUp({
        email,
        password: motDePasse,
        options: { data: { nom, telephone } },
      });
      if (error) {
        // Message générique ici aussi : ne pas confirmer qu'un email
        // est déjà utilisé (même logique d'énumération qu'à la connexion).
        setErreur(t("auth.compteImpossible"));
        setEnCours(false);
        return;
      }

      setSucces(true);
      setTimeout(() => router.push("/securite/pin"), 900);
    } catch (e) {
      setErreur(t("auth.compteImpossible"));
      setEnCours(false);
    }
  };

  /*
    Google/Facebook/Apple doivent d'abord être activés comme
    fournisseurs dans Supabase Auth (Dashboard → Authentication →
    Providers) avec leurs clés respectives, sinon signInWithOAuth
    renvoie une erreur — le code ici est prêt, la config externe reste
    à faire côté Supabase.
  */
  const connexionSociale = async (fournisseur) => {
    setErreur(null);
    setEnCoursSocial(fournisseur);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: fournisseur,
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) {
      setErreur(t("auth.compteImpossible"));
      setEnCoursSocial(null);
    }
    // En cas de succès, Supabase redirige lui-même vers le fournisseur —
    // pas besoin de router.push ici.
  };

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <style>{`
        @keyframes tekcaCheckDraw { from { stroke-dashoffset: 48; } to { stroke-dashoffset: 0; } }
        @keyframes tekcaPopIn { 0% { opacity: 0; transform: scale(0.85) translateY(8px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes tekcaShake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-4px); } 40% { transform: translateX(4px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }
        @keyframes tekcaSpin { to { transform: rotate(360deg); } }
        .tekca-pop { animation: tekcaPopIn 0.4s ease-out both; }
        .tekca-shake { animation: tekcaShake 0.4s ease-in-out; }
      `}</style>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">{mode === "connexion" ? t("auth.titreConnexion") : t("auth.titreInscription")}</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label={t("common.changerTheme")}>
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-24 pb-10 relative">
        {succes && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 tekca-pop" style={{ background: COLORS.background }}>
            <svg width="56" height="56" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="24" fill="none" stroke="#3A8A5C" strokeWidth="2.5" opacity="0.3" />
              <path d="M15 27l7 7 15-15" fill="none" stroke="#3A8A5C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="48" style={{ animation: "tekcaCheckDraw 0.5s ease-in-out" }} />
            </svg>
            <p className="text-base font-bold mt-4">{mode === "connexion" ? "Connexion réussie" : "Compte créé !"}</p>
            <p className="text-xs mt-1 text-center" style={{ color: COLORS.textMuted }}>
              {mode === "connexion" ? "Redirection..." : "Redirection vers la création de ton code PIN..."}
            </p>
          </div>
        )}

        <p className="text-xl font-extrabold mb-1">
          {mode === "connexion" ? "Content de te revoir 👋" : "Rejoins l'écosystème"}
        </p>
        <p className="text-sm mb-6" style={{ color: COLORS.textMuted }}>
          Un seul compte pour acheter, vendre, discuter et utiliser l'IA.
        </p>

        <div className="flex flex-col gap-3">
          {/* Connexion sociale */}
          <button
            onClick={() => connexionSociale("google")}
            disabled={!!enCoursSocial}
            className="w-full rounded-xl py-2.5 font-semibold flex items-center justify-center gap-2 text-sm"
            style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.82z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A11.99 11.99 0 0 0 12 24z" />
              <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.27A11.99 11.99 0 0 0 0 12c0 1.93.46 3.76 1.27 5.39z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.61l4 3.11C6.22 6.86 8.87 4.75 12 4.75z" />
            </svg>
            {enCoursSocial === "google" ? t("auth.unInstant") : "Continuer avec Google"}
          </button>
          <button
            onClick={() => connexionSociale("facebook")}
            disabled={!!enCoursSocial}
            className="w-full rounded-xl py-2.5 font-semibold flex items-center justify-center gap-2 text-sm"
            style={{ background: "#1877F2", color: "#fff" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
              <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.26h3.32l-.53 3.49h-2.79V24c5.74-.91 10.13-5.9 10.13-11.93z" />
            </svg>
            {enCoursSocial === "facebook" ? t("auth.unInstant") : "Continuer avec Facebook"}
          </button>
          <button
            onClick={() => connexionSociale("apple")}
            disabled={!!enCoursSocial}
            className="w-full rounded-xl py-2.5 font-semibold flex items-center justify-center gap-2 text-sm"
            style={{ background: theme === "sombre" ? "#fff" : "#111", color: theme === "sombre" ? "#111" : "#fff" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={theme === "sombre" ? "#111" : "#fff"}>
              <path d="M16.36 1c.15 1.05-.29 2.1-.94 2.86-.68.78-1.78 1.38-2.86 1.3-.16-1.02.34-2.08.98-2.79.71-.78 1.9-1.36 2.82-1.37zm3.36 6.14c-1.55-.09-2.87.87-3.61.87-.75 0-1.86-.85-3.06-.83-1.57.03-3.02.91-3.83 2.32-.81 1.4-1.09 3.47-.34 5.02.7 1.43 2.03 2.34 3.51 2.47 1.06.08 2.07-.58 2.75-.58.69 0 1.72.72 2.86.62 1.48-.12 2.41-1.19 3.07-2.59.42-.8.7-1.7.85-2.64-2.25-1.08-3.68-3.13-3.68-5.54 0-.98.35-1.89.95-2.55-1.37-.25-2.65.21-3.48 1.1z" />
            </svg>
            {enCoursSocial === "apple" ? t("auth.unInstant") : "Continuer avec Apple"}
          </button>

          <div className="flex items-center gap-2 my-1">
            <div className="flex-1 h-px" style={{ background: COLORS.border }} />
            <span className="text-[11px]" style={{ color: COLORS.textMuted }}>{t("common.ou")}</span>
            <div className="flex-1 h-px" style={{ background: COLORS.border }} />
          </div>

          {mode === "inscription" && (
            <div>
              <label className="text-xs font-semibold block mb-1">{t("auth.nomComplet")}</label>
              <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: COLORS.surface, border: `1px solid ${champsInvalides.includes("nom") ? "#B23A2E" : COLORS.border}` }}>
                <User size={16} color={COLORS.textMuted} />
                <input
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder={t("auth.tonNom")}
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: COLORS.textPrimary }}
                />
              </div>
            </div>
          )}

          {mode === "inscription" && (
            <div>
              <label className="text-xs font-semibold block mb-1">{t("auth.email")}</label>
              <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: COLORS.surface, border: `1px solid ${champsInvalides.includes("email") ? "#B23A2E" : COLORS.border}` }}>
                <Mail size={16} color={COLORS.textMuted} />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ton@email.com"
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: COLORS.textPrimary }}
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold block mb-1">{t("auth.telephone")}</label>
            <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <Phone size={16} color={COLORS.textMuted} />
              <input
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="+242 06 000 00 00"
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: COLORS.textPrimary }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1">{t("auth.motDePasse")}</label>
            <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: COLORS.surface, border: `1px solid ${champsInvalides.includes("motDePasse") ? "#B23A2E" : COLORS.border}` }}>
              <Lock size={16} color={COLORS.textMuted} />
              <input
                type={voirMdp ? "text" : "password"}
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                placeholder="••••••••"
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: COLORS.textPrimary }}
              />
              <button onClick={() => setVoirMdp(!voirMdp)} aria-label={t("auth.afficherMotDePasse")}>
                {voirMdp ? <EyeOff size={16} color={COLORS.textMuted} /> : <Eye size={16} color={COLORS.textMuted} />}
              </button>
            </div>
          </div>

          {mode === "connexion" && (
            <button className="text-xs text-right" style={{ color: COLORS.accentSecondary }}>
              {t("auth.motDePasseOublie")}
            </button>
          )}

          {/* Vérification anti-robot */}
          {/*
            ⚠️ Case à cocher de démonstration uniquement — elle
            n'effectue aucune vérification réelle. Avant mise en
            production, remplace-la par un vrai CAPTCHA (Cloudflare
            Turnstile ou hCaptcha, tous deux supportés nativement par
            Supabase Auth) pour empêcher les scripts automatisés
            d'atteindre même la vérification de rate limiting.
          */}
          <button
            onClick={() => setCaptchaCoche(!captchaCoche)}
            className="flex items-center gap-2 rounded-lg px-3 py-2.5"
            style={{ background: COLORS.surface, border: `1px solid ${captchaCoche ? COLORS.accentPrimary : COLORS.border}` }}
          >
            <div
              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
              style={{ background: captchaCoche ? COLORS.accentPrimary : COLORS.background, border: `1px solid ${COLORS.border}` }}
            >
              {captchaCoche && <ShieldCheck size={13} color={COLORS.background} />}
            </div>
            <span className="text-xs" style={{ color: COLORS.textPrimary }}>Je ne suis pas un robot</span>
          </button>

          {erreur && (
            <p className="tekca-shake text-xs rounded-lg px-3 py-2" style={{ background: "rgba(178,58,46,0.12)", color: "#B23A2E" }}>
              {erreur}
            </p>
          )}

          <button
            disabled={!captchaCoche || enCours}
            onClick={mode === "connexion" ? seConnecter : creerCompte}
            className="w-full rounded-xl py-3 font-semibold mt-2 flex items-center justify-center gap-2"
            style={{
              background: captchaCoche && !enCours ? COLORS.accentPrimary : COLORS.border,
              color: captchaCoche && !enCours ? COLORS.background : COLORS.textMuted,
            }}
          >
            {enCours && (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ animation: "tekcaSpin 0.7s linear infinite" }}>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            {enCours ? t("auth.unInstant") : mode === "connexion" ? t("auth.boutonConnexion") : t("auth.boutonInscription")}
          </button>
        </div>

        <p className="text-xs text-center mt-6" style={{ color: COLORS.textMuted }}>
          {mode === "connexion" ? t("auth.questionPasDeCompte") : t("auth.questionDejaCompte")}{" "}
          <button
            onClick={() => setMode(mode === "connexion" ? "inscription" : "connexion")}
            className="font-semibold"
            style={{ color: COLORS.accentPrimary }}
          >
            {mode === "connexion" ? t("auth.titreInscription") : t("auth.boutonConnexion")}
          </button>
        </p>
      </main>
    </div>
  );
}
