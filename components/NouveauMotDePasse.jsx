"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Sun, Moon, Lock, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { useTheme } from "../lib/ThemeContext";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

/*
  Page ouverte par le lien « mot de passe oublié ». Le serveur (/auth/callback) a déjà
  validé le lien et posé le cookie de récupération ; ici l'utilisateur choisit son
  nouveau mot de passe. À la fin, toutes ses sessions sont fermées : il se reconnecte.
*/
export default function NouveauMotDePasse() {
  const router = useRouter();
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const COLORS = THEMES[theme];

  const [session, setSession] = useState(undefined); // undefined = vérification en cours
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [voir, setVoir] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [lienExpire, setLienExpire] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [doubleAuth, setDoubleAuth] = useState(false); // compte protégé par la 2FA : pas de réinitialisation par email seul

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setSession(false);
      const { data: niveaux } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (niveaux && niveaux.nextLevel === "aal2" && niveaux.currentLevel !== "aal2") {
        // Un simple email ne doit jamais suffire à contourner la double authentification.
        await supabase.auth.signOut();
        setDoubleAuth(true);
      }
      setSession(true);
    })();
  }, []);

  const enregistrer = async () => {
    setErreur(null);
    if (nouveau.length < 8) return setErreur(t("auth.mdpTropCourt"));
    if (nouveau !== confirmation) return setErreur(t("auth.mdpDifferents"));
    setEnCours(true);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const reponse = await fetch("/api/auth/nouveau-mot-de-passe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s?.access_token}` },
        body: JSON.stringify({ nouveauMotDePasse: nouveau }),
      });
      const data = await reponse.json().catch(() => ({}));
      if (!reponse.ok) {
        if (data.code === "lien_expire" || data.code === "session") setLienExpire(true);
        else if (reponse.status === 401) setLienExpire(true);
        setErreur(data.error || t("auth.nouveauMdpErreur"));
        setEnCours(false);
        return;
      }
      // Toutes les sessions sont fermées côté serveur : on nettoie celle de ce navigateur.
      await supabase.auth.signOut();
      window.location.assign("/auth?mdp=modifie");
    } catch {
      setErreur(t("auth.nouveauMdpErreur"));
      setEnCours(false);
    }
  };

  const champ = { background: COLORS.surface, border: `1px solid ${COLORS.border}` };

  return (
    <div className="min-h-screen" style={{ background: COLORS.background, color: COLORS.textPrimary }}>
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3" style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}>
        <button onClick={() => router.push("/auth")} aria-label={t("common.retour")}><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">{t("auth.nouveauMdpTitre")}</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label={t("common.changerTheme")}>
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-24 pb-10">
        {session === undefined && <p className="text-sm text-center mt-10" style={{ color: COLORS.textMuted }}>{t("auth.unInstant")}</p>}

        {(session === false || lienExpire) && (
          <div className="flex flex-col items-center text-center gap-3 mt-8">
            <ShieldAlert size={44} color="#B23A2E" />
            <p className="text-base font-bold">{t("auth.lienInvalideTitre")}</p>
            <p className="text-sm" style={{ color: COLORS.textMuted }}>{t("auth.lienInvalide")}</p>
            <button onClick={() => router.push("/auth/mot-de-passe-oublie")} className="rounded-xl px-5 py-2.5 font-bold text-sm mt-2" style={{ background: COLORS.accentPrimary, color: "#fff" }}>
              {t("auth.oubliEnvoyer")}
            </button>
          </div>
        )}

        {session === true && doubleAuth && (
          <div className="flex flex-col items-center text-center gap-3 mt-8">
            <ShieldAlert size={44} color={COLORS.accentSecondary} />
            <p className="text-base font-bold">{t("auth.mdp2faTitre")}</p>
            <p className="text-sm" style={{ color: COLORS.textMuted }}>{t("auth.mdp2fa")}</p>
          </div>
        )}

        {session === true && !doubleAuth && !lienExpire && (
          <>
            <p className="text-sm mb-5" style={{ color: COLORS.textMuted }}>{t("auth.nouveauMdpDescription")}</p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 rounded-xl px-3 py-3" style={champ}>
                <Lock size={16} color={COLORS.textMuted} />
                <input type={voir ? "text" : "password"} autoComplete="new-password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} placeholder={t("parametres.nouveauMotDePasse")} className="flex-1 bg-transparent outline-none text-sm" style={{ color: COLORS.textPrimary }} />
                <button onClick={() => setVoir(!voir)} aria-label={t("auth.afficherMotDePasse")}>
                  {voir ? <EyeOff size={16} color={COLORS.textMuted} /> : <Eye size={16} color={COLORS.textMuted} />}
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-xl px-3 py-3" style={champ}>
                <Lock size={16} color={COLORS.textMuted} />
                <input type={voir ? "text" : "password"} autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") enregistrer(); }} placeholder={t("parametres.confirmerMotDePasse")} className="flex-1 bg-transparent outline-none text-sm" style={{ color: COLORS.textPrimary }} />
              </div>
              {erreur && <p className="text-xs" style={{ color: "#B23A2E" }}>{erreur}</p>}
              <button onClick={enregistrer} disabled={enCours} className="w-full rounded-xl py-3 font-bold text-sm" style={{ background: COLORS.accentPrimary, color: "#fff", opacity: enCours ? 0.6 : 1 }}>
                {enCours ? t("auth.unInstant") : t("auth.nouveauMdpEnregistrer")}
              </button>
              <p className="text-[11px] text-center" style={{ color: COLORS.textMuted }}>{t("auth.nouveauMdpInfoSessions")}</p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
