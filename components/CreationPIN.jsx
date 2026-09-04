"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sun, Moon, Lock, Delete } from "lucide-react";
import { useRouter } from "next/navigation";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

const LONGUEUR_PIN = 4;

/*
  Utilisé à deux moments : (1) création du PIN après inscription,
  (2) saisie du PIN pour déverrouiller l'app / confirmer un paiement.
  Le PIN est hashé côté serveur (jamais stocké en clair) — colonne
  users.code_pin_hash dans le schéma.
*/
export default function CreationPIN({ mode = "creation" }) {
  const router = useRouter();
  const router = useRouter(); // "creation" | "saisie"
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];
  const [etape, setEtape] = useState(mode === "creation" ? "premier" : "saisie"); // premier | confirmation | saisie
  const [pin, setPin] = useState("");
  const [pinConfirmation, setPinConfirmation] = useState("");
  const [erreur, setErreur] = useState(false);

  const pinActif = etape === "confirmation" ? pinConfirmation : pin;

  const ajouterChiffre = (chiffre) => {
    setErreur(false);
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

  React.useEffect(() => {
    if (etape === "premier" && pin.length === LONGUEUR_PIN) {
      setTimeout(() => setEtape("confirmation"), 200);
    }
    if (etape === "confirmation" && pinConfirmation.length === LONGUEUR_PIN) {
      if (pinConfirmation === pin) {
        // Ici : hash + sauvegarde users.code_pin_hash
        router.push("/securite/identite");
      } else {
        setErreur(true);
        setTimeout(() => { setPin(""); setPinConfirmation(""); setEtape("premier"); }, 600);
      }
    }
    if (etape === "saisie" && pin.length === LONGUEUR_PIN) {
      // Ici : vérification contre users.code_pin_hash
    }
  }, [pin, pinConfirmation, etape]);

  const titres = {
    premier: "Crée ton code PIN",
    confirmation: "Confirme ton code PIN",
    saisie: "Entre ton code PIN",
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
          <Lock size={22} color={COLORS.accentPrimary} />
        </div>
        <p className="font-bold text-lg mb-1">{titres[etape]}</p>
        <p className="text-xs mb-6 text-center" style={{ color: COLORS.textMuted }}>
          {mode === "creation" ? "Ce code te sera demandé pour confirmer tes paiements." : "Entre ton code pour continuer."}
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

        {/* Clavier numérique */}
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              onClick={() => ajouterChiffre(String(n))}
              className="w-16 h-16 rounded-full text-xl font-semibold"
              style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary }}
            >
              {n}
            </button>
          ))}
          <div />
          <button
            onClick={() => ajouterChiffre("0")}
            className="w-16 h-16 rounded-full text-xl font-semibold"
            style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary }}
          >
            0
          </button>
          <button onClick={effacer} className="w-16 h-16 rounded-full flex items-center justify-center" aria-label="Effacer">
            <Delete size={20} color={COLORS.textMuted} />
          </button>
        </div>
      </main>
    </div>
  );
}
