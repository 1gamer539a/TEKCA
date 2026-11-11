"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Sun, Moon, Mail, MailCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { useTheme } from "../lib/ThemeContext";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

/*
  « Mot de passe oublié ? » — l'utilisateur saisit son email ; il reçoit un lien
  (envoyé par Supabase via Resend) qui ouvre /auth/nouveau-mot-de-passe.
  Le message de confirmation est TOUJOURS le même, que l'email ait un compte ou
  non : on ne révèle jamais quels emails sont inscrits.
*/
export default function OubliMotDePasse() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const COLORS = THEMES[theme];

  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [erreur, setErreur] = useState(searchParams.get("erreur") === "lien_invalide" ? t("auth.oubliLienInvalide") : null);
  const [envoye, setEnvoye] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [attente, setAttente] = useState(0); // secondes avant de pouvoir redemander un email

  useEffect(() => {
    if (attente <= 0) return;
    const minuterie = setTimeout(() => setAttente((a) => a - 1), 1000);
    return () => clearTimeout(minuterie);
  }, [attente]);

  const envoyer = async () => {
    setErreur(null);
    const adresse = email.trim();
    if (!adresse || !adresse.includes("@")) {
      setErreur(t("auth.oubliEmailInvalide"));
      return;
    }
    setEnCours(true);
    try {
      // 1) Limites anti-abus (par adresse IP et par email)
      const limite = await fetch("/api/auth/limite-oubli", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adresse }),
      });
      if (limite.status === 429) {
        const d = await limite.json().catch(() => ({}));
        setErreur(d.error || t("auth.oubliTropDeDemandes"));
        setEnCours(false);
        return;
      }
      // 2) Envoi du lien (Supabase → Resend). Pas d'erreur pour un email inconnu : c'est voulu.
      const { error } = await supabase.auth.resetPasswordForEmail(adresse, {
        redirectTo: `${window.location.origin}/auth/callback?recuperation=1`,
      });
      if (error) {
        setErreur(t("auth.oubliErreurEnvoi"));
        setEnCours(false);
        return;
      }
      setEnvoye(true);
      setAttente(60);
    } catch {
      setErreur(t("auth.oubliErreurEnvoi"));
    }
    setEnCours(false);
  };

  return (
    <div className="min-h-screen" style={{ background: COLORS.background, color: COLORS.textPrimary }}>
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3" style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}>
        <button onClick={() => router.push("/auth")} aria-label={t("common.retour")}><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">{t("auth.oubliTitre")}</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label={t("common.changerTheme")}>
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-24 pb-10">
        {envoye ? (
          <div className="flex flex-col items-center text-center gap-3 mt-6">
            <MailCheck size={48} color={COLORS.accentSecondary} />
            <p className="text-base font-bold">{t("auth.oubliEnvoyeTitre")}</p>
            <p className="text-sm" style={{ color: COLORS.textMuted }}>{t("auth.oubliEnvoye")}</p>
            <p className="text-xs" style={{ color: COLORS.textMuted }}>{t("auth.oubliSpam")}</p>
            <button
              onClick={envoyer}
              disabled={attente > 0 || enCours}
              className="text-xs font-semibold mt-2"
              style={{ color: COLORS.accentPrimary, opacity: attente > 0 ? 0.5 : 1 }}
            >
              {attente > 0 ? t("auth.oubliRenvoyerDans", { secondes: attente }) : t("auth.oubliRenvoyer")}
            </button>
            {erreur && <p className="text-xs" style={{ color: "#B23A2E" }}>{erreur}</p>}
          </div>
        ) : (
          <>
            <p className="text-sm mb-5" style={{ color: COLORS.textMuted }}>{t("auth.oubliDescription")}</p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 rounded-xl px-3 py-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <Mail size={16} color={COLORS.textMuted} />
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") envoyer(); }}
                  placeholder={t("auth.email")}
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: COLORS.textPrimary }}
                />
              </div>
              {erreur && <p className="text-xs" style={{ color: "#B23A2E" }}>{erreur}</p>}
              <button
                onClick={envoyer}
                disabled={enCours}
                className="w-full rounded-xl py-3 font-bold text-sm"
                style={{ background: COLORS.accentPrimary, color: "#fff", opacity: enCours ? 0.6 : 1 }}
              >
                {enCours ? t("auth.unInstant") : t("auth.oubliEnvoyer")}
              </button>
              <button onClick={() => router.push("/auth")} className="text-xs text-center" style={{ color: COLORS.accentSecondary }}>
                {t("auth.oubliRetour")}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
