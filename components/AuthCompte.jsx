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

  /*
    Message volontairement générique dans tous les cas d'échec de
    connexion (mauvais mot de passe OU email inexistant) — ne jamais
    distinguer les deux, ça permettrait à un attaquant de deviner
    quels emails ont un compte (énumération de comptes).
  */
  const MESSAGE_ECHEC_CONNEXION = t("auth.identifiantsIncorrects");

  const seConnecter = async () => {
    setErreur(null);
    if (!email || !motDePasse) {
      setErreur(t("auth.champsRequisConnexion"));
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

      router.push(searchParams.get("suite") || "/");
      setEnCours(false);
    }
  };

  const creerCompte = async () => {
    setErreur(null);
    if (!nom || !email || !motDePasse) {
      setErreur(t("auth.champsRequisInscription"));
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

      router.push("/securite/pin");
    } catch (e) {
      setErreur(t("auth.compteImpossible"));
      setEnCours(false);
    }
  };

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
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

      <main className="max-w-md mx-auto w-full px-4 pt-24 pb-10">
        <p className="text-xl font-extrabold mb-1">
          {mode === "connexion" ? "Content de te revoir 👋" : "Rejoins l'écosystème"}
        </p>
        <p className="text-sm mb-6" style={{ color: COLORS.textMuted }}>
          Un seul compte pour acheter, vendre, discuter et utiliser l'IA.
        </p>

        <div className="flex flex-col gap-3">
          {/* Connexion sociale */}
          <button
            className="w-full rounded-xl py-2.5 font-semibold flex items-center justify-center gap-2 text-sm"
            style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary }}
          >
            Continuer avec Google
          </button>
          <button
            className="w-full rounded-xl py-2.5 font-semibold flex items-center justify-center gap-2 text-sm"
            style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary }}
          >
            Continuer avec Facebook
          </button>

          <div className="flex items-center gap-2 my-1">
            <div className="flex-1 h-px" style={{ background: COLORS.border }} />
            <span className="text-[11px]" style={{ color: COLORS.textMuted }}>{t("common.ou")}</span>
            <div className="flex-1 h-px" style={{ background: COLORS.border }} />
          </div>

          {mode === "inscription" && (
            <div>
              <label className="text-xs font-semibold block mb-1">{t("auth.nomComplet")}</label>
              <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
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
              <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
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
            <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
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
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: "rgba(178,58,46,0.12)", color: "#B23A2E" }}>
              {erreur}
            </p>
          )}

          <button
            disabled={!captchaCoche || enCours}
            onClick={mode === "connexion" ? seConnecter : creerCompte}
            className="w-full rounded-xl py-3 font-semibold mt-2"
            style={{
              background: captchaCoche && !enCours ? COLORS.accentPrimary : COLORS.border,
              color: captchaCoche && !enCours ? COLORS.background : COLORS.textMuted,
            }}
          >
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
