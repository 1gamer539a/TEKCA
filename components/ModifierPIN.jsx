"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sun, Moon, Lock, Delete, CheckCircle2, Loader2, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

const LONGUEUR_PIN = 4;

/*
  Changer un PIN existant demande, dans l'ordre : (1) l'ancien code
  — vérifié côté serveur par /api/securite/pin/modifier lui-même,
  jamais côté client seul, pour ne pas pouvoir être contourné — puis
  (2) le nouveau code et (3) sa confirmation, avant l'appel API final
  qui envoie ancienPin + nouveauPin ensemble.
*/
export default function ModifierPIN() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const COLORS = THEMES[theme];
  const [etape, setEtape] = useState("ancien"); // ancien | nouveau | confirmation | succes
  const [ancienPin, setAncienPin] = useState("");
  const [nouveauPin, setNouveauPin] = useState("");
  const [confirmationPin, setConfirmationPin] = useState("");
  const [erreur, setErreur] = useState(false);
  const [messageErreur, setMessageErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const pinActif = etape === "ancien" ? ancienPin : etape === "nouveau" ? nouveauPin : confirmationPin;

  const ajouterChiffre = (chiffre) => {
    setErreur(false);
    setMessageErreur(null);
    if (etape === "ancien" && ancienPin.length < LONGUEUR_PIN) setAncienPin(ancienPin + chiffre);
    else if (etape === "nouveau" && nouveauPin.length < LONGUEUR_PIN) setNouveauPin(nouveauPin + chiffre);
    else if (etape === "confirmation" && confirmationPin.length < LONGUEUR_PIN) setConfirmationPin(confirmationPin + chiffre);
  };

  const effacer = () => {
    if (etape === "ancien") setAncienPin(ancienPin.slice(0, -1));
    else if (etape === "nouveau") setNouveauPin(nouveauPin.slice(0, -1));
    else setConfirmationPin(confirmationPin.slice(0, -1));
  };

  const soumettre = async (nouveauPinFinal) => {
    setEnCours(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const reponse = await fetch("/api/securite/pin/modifier", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ ancienPin, nouveauPin: nouveauPinFinal }),
      });
      const data = await reponse.json();
      setEnCours(false);
      if (!reponse.ok) {
        setErreur(true);
        setMessageErreur(data.error || "Impossible de changer le code PIN.");
        // Un ancien code refusé par le serveur ramène à la première
        // étape — c'est le serveur qui a la vérité, pas une
        // supposition faite ici côté client.
        setTimeout(() => {
          setAncienPin("");
          setNouveauPin("");
          setConfirmationPin("");
          setEtape("ancien");
          setErreur(false);
        }, 1200);
        return;
      }
      setEtape("succes");
      setTimeout(() => router.push("/compte"), 1500);
    } catch (e) {
      setEnCours(false);
      setErreur(true);
      setMessageErreur("Erreur réseau, réessaie.");
    }
  };

  React.useEffect(() => {
    if (etape === "ancien" && ancienPin.length === LONGUEUR_PIN) {
      setTimeout(() => setEtape("nouveau"), 200);
    }
    if (etape === "nouveau" && nouveauPin.length === LONGUEUR_PIN) {
      setTimeout(() => setEtape("confirmation"), 200);
    }
  }, [ancienPin, nouveauPin, etape]);

  const valider = () => {
    if (etape !== "confirmation" || confirmationPin.length !== LONGUEUR_PIN) return;
    if (confirmationPin === nouveauPin) {
      soumettre(confirmationPin);
    } else {
      setErreur(true);
      setTimeout(() => { setNouveauPin(""); setConfirmationPin(""); setEtape("nouveau"); setErreur(false); }, 600);
    }
  };

  const titres = {
    ancien: "Entre ton code PIN actuel",
    nouveau: "Choisis un nouveau code",
    confirmation: "Confirme le nouveau code",
    succes: "Code PIN modifié",
  };

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }} className="flex flex-col">
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">Sécurité</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-16">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          {etape === "succes" ? <CheckCircle2 size={22} color="#3A8A5C" /> : <Lock size={22} color={COLORS.accentPrimary} />}
        </div>
        <p className="font-bold text-lg mb-1">{titres[etape]}</p>

        {etape !== "succes" && (
          <>
            <div className="flex gap-3 mb-8 mt-5">
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
                <Loader2 size={13} className="animate-spin" /> Vérification...
              </p>
            )}
            {messageErreur && <p className="text-xs mb-4 text-center" style={{ color: "#B23A2E" }}>{messageErreur}</p>}

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
              <button onClick={effacer} disabled={enCours} className="w-16 h-16 rounded-full flex items-center justify-center" aria-label="Effacer">
                <Delete size={20} color={COLORS.textMuted} />
              </button>
            </div>

            {etape === "confirmation" && (
              <button
                onClick={valider}
                disabled={enCours || confirmationPin.length !== LONGUEUR_PIN}
                className="w-full max-w-[260px] mt-5 h-12 rounded-full font-semibold text-sm flex items-center justify-center gap-2"
                style={{
                  background: confirmationPin.length === LONGUEUR_PIN ? COLORS.accentPrimary : COLORS.surface,
                  color: confirmationPin.length === LONGUEUR_PIN ? COLORS.background : COLORS.textMuted,
                }}
              >
                <Check size={16} /> Valider
              </button>
            )}
          </>
        )}

        {etape === "succes" && (
          <p className="text-xs text-center" style={{ color: COLORS.textMuted }}>Ton code PIN a bien été mis à jour.</p>
        )}
      </main>
    </div>
  );
}
