"use client";

import React, { useState } from "react";
import { MessageSquarePlus, X } from "lucide-react";
import FormulaireFeedback from "./FormulaireFeedback";

/*
  Bouton flottant "avis", positionné à gauche pour ne jamais gêner
  BoutonIAFlottant.jsx (draggable à droite) ni NavigationBas.jsx
  (bottom-0). Monté une seule fois dans LayoutRacine.jsx.

  Le formulaire est aussi accessible en page dédiée (/feedback,
  voir app/feedback/page.jsx) — les deux partagent FormulaireFeedback
  pour ne pas dupliquer la logique d'envoi.
*/
export default function BoutonFeedbackFlottant({ COLORS }) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        aria-label="Donner mon avis"
        className="fixed z-50 flex items-center justify-center rounded-full shadow-lg"
        style={{ left: 16, bottom: 76, width: 48, height: 48, background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
      >
        <MessageSquarePlus size={20} color={COLORS.accentPrimary} />
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="w-full sm:max-w-sm max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-6" style={{ background: COLORS.background, color: COLORS.textPrimary }}>
            <div className="flex justify-end mb-1">
              <button onClick={() => setOuvert(false)} aria-label="Fermer">
                <X size={20} color={COLORS.textMuted} />
              </button>
            </div>
            <FormulaireFeedback COLORS={COLORS} onEnvoye={() => setOuvert(false)} />
          </div>
        </div>
      )}
    </>
  );
}
