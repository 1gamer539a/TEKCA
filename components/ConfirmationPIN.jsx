"use client";

import React, { useState } from "react";
import { X, Lock, Delete } from "lucide-react";
import { supabase } from "../lib/supabase";

const LONGUEUR_PIN = 4;

/*
  Modal générique de confirmation par code PIN, à afficher juste
  avant toute action qui déplace de l'argent (paiement panier,
  retrait, transfert, recharge, souscription d'abonnement).

  Usage :
    <ConfirmationPIN
      ouvert={afficherPin}
      onSuccess={() => { setAfficherPin(false); executerLePaiement(); }}
      onAnnuler={() => setAfficherPin(false)}
    />

  Volontairement séparé de CreationPIN.jsx (page pleine, utilisée
  pour la création initiale et pour la vérification de session) :
  ici il s'agit d'une confirmation ponctuelle, affichée par-dessus
  l'écran en cours (panier, portefeuille, abonnements...) sans
  perdre l'état de la page (montant saisi, panier, etc.).
*/
export default function ConfirmationPIN({ ouvert, onSuccess, onAnnuler, theme = "clair" }) {
  const [pin, setPin] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(false);
  const [messageErreur, setMessageErreur] = useState(null);

  const THEMES = {
    sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
    clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
  };
  const COLORS = THEMES[theme] || THEMES.clair;

  if (!ouvert) return null;

  const verifier = async (pinComplet) => {
    setEnCours(true);
    setErreur(false);
    setMessageErreur(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const reponse = await fetch("/api/securite/pin/verifier", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ pin: pinComplet }),
      });
      const data = await reponse.json();
      if (!reponse.ok) {
        setErreur(true);
        setMessageErreur(data.error || "Code incorrect.");
        setTimeout(() => { setPin(""); setErreur(false); }, 800);
        setEnCours(false);
        return;
      }
      setPin("");
      onSuccess();
    } catch (e) {
      setErreur(true);
      setMessageErreur("Erreur réseau, réessaie.");
      setEnCours(false);
    }
  };

  const ajouterChiffre = (chiffre) => {
    if (enCours) return;
    setErreur(false);
    setMessageErreur(null);
    const nouveau = pin.length < LONGUEUR_PIN ? pin + chiffre : pin;
    setPin(nouveau);
    if (nouveau.length === LONGUEUR_PIN) verifier(nouveau);
  };

  const effacer = () => { if (!enCours) setPin(pin.slice(0, -1)); };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 flex flex-col items-center"
        style={{ background: COLORS.background, color: COLORS.textPrimary }}
      >
        <div className="w-full flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">Confirme le paiement</span>
          <button onClick={onAnnuler} aria-label="Annuler" disabled={enCours}>
            <X size={20} color={COLORS.textMuted} />
          </button>
        </div>

        <div className="w-12 h-12 rounded-full flex items-center justify-center my-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <Lock size={20} color={COLORS.accentPrimary} />
        </div>

        <p className="text-xs text-center" style={{ color: COLORS.textMuted }}>
          Entre ton code PIN pour valider ce paiement.
        </p>

        <div className="flex gap-3 my-5">
          {Array.from({ length: LONGUEUR_PIN }).map((_, i) => (
            <div
              key={i}
              className="w-3.5 h-3.5 rounded-full"
              style={{
                background: i < pin.length ? (erreur ? "#B23A2E" : COLORS.accentPrimary) : "transparent",
                border: `2px solid ${erreur ? "#B23A2E" : i < pin.length ? COLORS.accentPrimary : COLORS.border}`,
              }}
            />
          ))}
        </div>

        {messageErreur && <p className="text-xs mb-2" style={{ color: "#B23A2E" }}>{messageErreur}</p>}

        <div className="grid grid-cols-3 gap-3 w-full max-w-[260px]">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((c) => (
            <button
              key={c}
              onClick={() => ajouterChiffre(c)}
              disabled={enCours}
              className="h-14 rounded-full text-lg font-semibold"
              style={{ background: COLORS.surface, color: COLORS.textPrimary }}
            >
              {c}
            </button>
          ))}
          <div />
          <button
            onClick={() => ajouterChiffre("0")}
            disabled={enCours}
            className="h-14 rounded-full text-lg font-semibold"
            style={{ background: COLORS.surface, color: COLORS.textPrimary }}
          >
            0
          </button>
          <button onClick={effacer} disabled={enCours} className="h-14 rounded-full flex items-center justify-center" style={{ color: COLORS.textMuted }}>
            <Delete size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
