"use client";

import React, { useState, useEffect } from "react";
import { X, Download, Share } from "lucide-react";
import { supabase } from "../lib/supabase";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

function estInstalle() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  if (window.navigator.standalone === true) return true; // Safari iOS
  return false;
}

function estIOS() {
  return typeof window !== "undefined" && /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/*
  Invite à installer TEKÇA sur l'écran d'accueil, à chaque connexion,
  TANT QUE l'app n'est pas déjà installée (détection fiable via
  display-mode: standalone / navigator.standalone — dès que
  l'utilisateur a vraiment installé l'app, ce composant ne se
  déclenche plus jamais, sur aucun appareil).

  Deux chemins distincts, le web ne permettant pas de déclencher une
  installation programmatique partout :
  - Android/Chrome/Edge : événement natif "beforeinstallprompt" capté
    au plus tôt, déclenche le vrai popup d'installation du navigateur.
  - iOS Safari (aucun événement natif n'existe) : instructions
    manuelles ("Partager" -> "Sur l'écran d'accueil").

  Monté une seule fois dans LayoutRacine.jsx.
*/
export default function InvitationInstallationPWA({ theme = "clair" }) {
  const COLORS = THEMES[theme] || THEMES.clair;
  const [visible, setVisible] = useState(false);
  const [eventInstall, setEventInstall] = useState(null);
  const [surIOS, setSurIOS] = useState(false);

  useEffect(() => {
    if (estInstalle()) return;

    const capterEvenement = (e) => {
      e.preventDefault();
      setEventInstall(e);
    };
    window.addEventListener("beforeinstallprompt", capterEvenement);

    const verifierConnexion = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || estInstalle()) return;
      // Léger délai pour laisser EnqueteAttribution.jsx (l'enquête de
      // bienvenue) s'afficher en premier si elle doit apparaître —
      // évite deux modals plein écran superposés pour un nouveau compte.
      setTimeout(() => {
        if (!estInstalle()) {
          setSurIOS(estIOS());
          setVisible(true);
        }
      }, 1800);
    };
    verifierConnexion();

    // Se redéclenche aussi à chaque connexion effective dans cet
    // onglet (pas seulement au premier chargement de page).
    const { data: ecouteur } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" && !estInstalle()) {
        setSurIOS(estIOS());
        setVisible(true);
      }
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", capterEvenement);
      ecouteur?.subscription?.unsubscribe();
    };
  }, []);

  if (!visible) return null;

  const installer = async () => {
    if (!eventInstall) return;
    eventInstall.prompt();
    await eventInstall.userChoice;
    setEventInstall(null);
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6" style={{ background: COLORS.background, color: COLORS.textPrimary }}>
        <div className="flex justify-between items-start mb-2">
          <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <Download size={19} color={COLORS.accentPrimary} />
          </div>
          <button onClick={() => setVisible(false)} aria-label="Fermer">
            <X size={20} color={COLORS.textMuted} />
          </button>
        </div>

        <p className="text-base font-bold mb-1">Installe TEKÇA sur ton téléphone</p>
        <p className="text-xs mb-4" style={{ color: COLORS.textMuted }}>
          Accès plus rapide, plein écran, et notifications qui arrivent vraiment — même app fermée.
        </p>

        {surIOS ? (
          <div className="rounded-xl p-3 flex flex-col gap-2 mb-1" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center gap-2 text-xs">
              <Share size={15} color={COLORS.accentPrimary} className="flex-shrink-0" />
              1. Appuie sur <strong>Partager</strong> en bas de Safari
            </div>
            <div className="text-xs pl-[23px]">2. Choisis <strong>Sur l'écran d'accueil</strong></div>
          </div>
        ) : eventInstall ? (
          <button
            onClick={installer}
            className="w-full h-12 rounded-full font-semibold text-sm"
            style={{ background: COLORS.accentPrimary, color: COLORS.background }}
          >
            Installer l'application
          </button>
        ) : (
          <div className="rounded-xl p-3 text-xs" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.textMuted }}>
            Ouvre le menu de ton navigateur (⋮ ou ...) puis choisis "Installer l'application" ou "Ajouter à l'écran d'accueil".
          </div>
        )}

        <button onClick={() => setVisible(false)} className="w-full text-center text-xs mt-3" style={{ color: COLORS.textMuted }}>
          Plus tard
        </button>
      </div>
    </div>
  );
}
