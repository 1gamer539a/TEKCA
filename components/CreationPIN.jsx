"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Sun, Moon, Lock, Delete, Loader2, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";
import { useLanguage } from "../lib/i18n/LanguageContext";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

const LONGUEUR_PIN = 4;

/*
  Utilisé à deux moments : (1) création du PIN après inscription,
  (2) saisie du PIN pour déverrouiller l'app / confirmer un paiement.
  Le PIN est hashé côté serveur (jamais stocké en clair) — colonne
  users.code_pin_hash dans le schéma. CORRECTIF — les deux appels
  API (création + vérification) étaient des TODO jamais branchés ;
  le PIN saisi n'était donc jamais réellement enregistré ni vérifié.
*/
export default function CreationPIN({ mode: modeProp }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = modeProp || (searchParams.get("mode") === "verification" ? "verification" : "creation");
  const suite = searchParams.get("suite") || "/";
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const COLORS = THEMES[theme];
  const [etape, setEtape] = useState(mode === "creation" ? "premier" : "saisie"); // premier | confirmation | saisie
  const [pin, setPin] = useState("");
  const [pinConfirmation, setPinConfirmation] = useState("");
  const [erreur, setErreur] = useState(false);
  const [messageErreur, setMessageErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const pinActif = etape === "confirmation" ? pinConfirmation : pin;

  const appelApi = async (endpoint, body) => {
    // CORRECTIF — l'utilisateur signalait que ça "ne faisait rien" au
    // premier essai, sans donner l'air de charger, ce qui donnait
    // l'impression d'un bug. On distingue maintenant deux cas :
    //  - un problème PASSAGER (session pas encore chargée, requête
    //    réseau qui échoue) : on réessaie plusieurs fois en gardant le
    //    bouton en train de tourner, quel que soit le temps que ça
    //    prend, plutôt que d'abandonner après un seul essai rapide.
    //  - une VRAIE réponse du serveur ("code incorrect" etc.) : ça,
    //    en revanche, on ne le réessaie jamais — c'est une réponse
    //    définitive, pas un souci de connexion.
    const MAX_ESSAIS = 5;
    for (let essai = 1; essai <= MAX_ESSAIS; essai++) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        if (essai < MAX_ESSAIS) {
          await new Promise((r) => setTimeout(r, essai * 500));
          continue;
        }
        return { ok: false, data: { error: t("pin.connexionInstable") } };
      }

      try {
        const reponse = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify(body),
        });
        return { ok: reponse.ok, data: await reponse.json() };
      } catch {
        // Erreur réseau (pas une réponse du serveur) — on retente.
        if (essai < MAX_ESSAIS) {
          await new Promise((r) => setTimeout(r, essai * 500));
          continue;
        }
        return { ok: false, data: { error: t("pin.connexionInstable") } };
      }
    }
  };

  const ajouterChiffre = (chiffre) => {
    setErreur(false);
    // CORRECTIF DIAGNOSTIC — messageErreur n'est plus effacé ici.
    // Avant, taper le premier chiffre d'une nouvelle tentative
    // effaçait instantanément le vrai message d'erreur renvoyé par
    // le serveur, avant même d'avoir pu le lire — ce qui donnait
    // l'impression d'un échec "silencieux" à chaque fois. Il ne
    // s'efface maintenant qu'au moment où une nouvelle tentative est
    // réellement soumise (voir soumettreVerification/soumettreConfirmation).
    if (etape === "premier" || etape === "saisie") {
      if (pin.length < LONGUEUR_PIN) setPin(pin + chiffre);
    } else {
      if (pinConfirmation.length < LONGUEUR_PIN) setPinConfirmation(pinConfirmation + chiffre);
    }
  };

  const effacer = () => {
    if (etape === "premier" || etape === "saisie") setPin(pin.slice(0, -1));
    else setPinConfirmation(pinConfirmation.slice(0, -1));
  };

  const valider = () => {
    if (etape === "confirmation" && pinConfirmation.length === LONGUEUR_PIN) {
      soumettreConfirmation();
    }
    if (etape === "saisie" && pin.length === LONGUEUR_PIN) {
      soumettreVerification();
    }
  };

  const soumettreConfirmation = async () => {
    setMessageErreur(null);
    if (pinConfirmation !== pin) {
      setErreur(true);
      setTimeout(() => { setPin(""); setPinConfirmation(""); setEtape("premier"); }, 600);
      return;
    }
    setEnCours(true);
    const { ok, data } = await appelApi("/api/securite/pin/creer", { pin });
    setEnCours(false);
    if (ok) {
      router.push("/securite/identite");
    } else {
      setErreur(true);
      setMessageErreur(data.error || t("pin.impossibleEnregistrer"));
      setTimeout(() => { setPin(""); setPinConfirmation(""); setEtape("premier"); setErreur(false); }, 1200);
    }
  };

  const soumettreVerification = async () => {
    setMessageErreur(null);
    setEnCours(true);
    const { ok, data } = await appelApi("/api/securite/pin/verifier", { pin });
    setEnCours(false);
    if (ok) {
      // CORRECTIF — router.back() ne fonctionnait pas ici : cette
      // page est atteinte par une redirection SERVEUR du
      // middleware (pas par une navigation depuis l'app), donc il
      // n'y a pas toujours d'entrée d'historique à laquelle
      // "revenir". On redirige explicitement vers `suite` (la
      // page que l'utilisateur voulait initialement ouvrir).
      router.replace(suite);
    } else {
      setErreur(true);
      setMessageErreur(data.error || t("pin.codeIncorrect"));
      // Délai augmenté (800ms -> 2s) pour laisser le temps de lire le
      // message réel avant que le champ ne se réinitialise.
      setTimeout(() => { setPin(""); setErreur(false); }, 2000);
    }
  };

  // "premier" avance seul vers "confirmation" — pas d'appel réseau,
  // donc pas d'attente à rendre prévisible ici. "confirmation" et
  // "saisie", eux, appellent le serveur : ils attendent un tap sur
  // "Valider" (voir bouton plus bas) plutôt que de soumettre seuls
  // dès le 4e chiffre.
  React.useEffect(() => {
    if (etape === "premier" && pin.length === LONGUEUR_PIN) {
      setTimeout(() => setEtape("confirmation"), 200);
    }
  }, [pin, etape]);

  const titres = {
    premier: t("pin.creeTonCode"),
    confirmation: t("pin.confirmeTonCode"),
    saisie: t("pin.entreTonCode"),
  };

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }} className="flex flex-col">
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label={t("common.retour")} style={{ visibility: mode === "verification" ? "hidden" : "visible" }}>
          <ArrowLeft size={22} color={COLORS.textPrimary} />
        </button>
        <span className="text-sm font-semibold">{t("compte.sectionSecurite")}</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label={t("common.changerTheme")}>
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-16">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <Lock size={22} color={COLORS.accentPrimary} />
        </div>
        <p className="font-bold text-lg mb-1">{titres[etape]}</p>
        <p className="text-xs mb-6 text-center" style={{ color: COLORS.textMuted }}>
          {mode === "creation" ? t("pin.demandeConfirmerPaiements") : t("pin.entreCodePourContinuer")}
        </p>

        {/* Points du PIN */}
        <div className="flex gap-3 mb-8">
          {Array.from({ length: LONGUEUR_PIN }).map((_, i) => (
            <div
              key={i}
              className="w-4 h-4 rounded-full"
              style={{
                background: i < pinActif.length ? (erreur ? "#B23A2E" : COLORS.accentPrimary) : "transparent",
                border: `1.5px solid ${erreur ? "#B23A2E" : COLORS.border}`,
              }}
            />
          ))}
        </div>

        {enCours && (
          <p className="text-xs flex items-center justify-center gap-1.5 mb-4" style={{ color: COLORS.textMuted }}>
            <Loader2 size={13} className="animate-spin" /> {t("pin.verificationEnCoursMot")}
          </p>
        )}
        {messageErreur && (
          <p className="text-xs mb-4 text-center" style={{ color: "#B23A2E" }}>{messageErreur}</p>
        )}

        {/* Clavier numérique */}
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              onClick={() => ajouterChiffre(String(n))}
              disabled={enCours}
              className="w-16 h-16 rounded-full text-xl font-semibold"
              style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary }}
            >
              {n}
            </button>
          ))}
          <div />
          <button
            onClick={() => ajouterChiffre("0")}
            disabled={enCours}
            className="w-16 h-16 rounded-full text-xl font-semibold"
            style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary }}
          >
            0
          </button>
          <button onClick={effacer} disabled={enCours} className="w-16 h-16 rounded-full flex items-center justify-center" aria-label={t("pin.effacerAria")}>
            <Delete size={20} color={COLORS.textMuted} />
          </button>
        </div>

        {/* CORRECTIF — "premier" avance seul (pas de réseau), mais
            "confirmation" et "saisie" attendent ce bouton explicite
            au lieu de soumettre seuls dès le 4e chiffre. */}
        {etape !== "premier" && (
          <button
            onClick={valider}
            disabled={enCours || pinActif.length !== LONGUEUR_PIN}
            className="w-full max-w-[260px] mt-5 h-12 rounded-full font-semibold text-sm flex items-center justify-center gap-2"
            style={{
              background: pinActif.length === LONGUEUR_PIN ? COLORS.accentPrimary : COLORS.surface,
              color: pinActif.length === LONGUEUR_PIN ? COLORS.background : COLORS.textMuted,
            }}
          >
            <Check size={16} /> {t("dashboard.valider")}
          </button>
        )}
      </main>
    </div>
  );
}
