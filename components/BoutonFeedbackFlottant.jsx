"use client";

import React, { useState, useRef } from "react";
import { MessageSquarePlus, X } from "lucide-react";
import FormulaireFeedback from "./FormulaireFeedback";
import { useLanguage } from "../lib/i18n/LanguageContext";

const TAILLE = 48;
const MARGE = 12;

/*
  Bouton flottant "avis", librement déplaçable sur tout l'écran
  (X et Y) façon AssistiveTouch iPhone — même esprit que
  BoutonIAFlottant.jsx, sauf que celui-ci ne drague qu'en vertical ;
  ici on drague dans les deux axes et on "snap" au bord gauche ou
  droit le plus proche au relâchement, comme le vrai AssistiveTouch.

  Position de départ : bas-gauche, pour ne jamais gêner
  BoutonIAFlottant.jsx (à droite) ni NavigationBas.jsx (bottom-0) —
  mais l'utilisateur peut ensuite le déplacer n'importe où.

  Monté une seule fois dans LayoutRacine.jsx.
*/
export default function BoutonFeedbackFlottant({ COLORS }) {
  const { t } = useLanguage();
  const [ouvert, setOuvert] = useState(false);
  const [position, setPosition] = useState({ x: MARGE, y: null }); // y=null tant que non mesuré
  const dragRef = useRef(false);
  const aBougeRef = useRef(false);

  const positionInitiale = () => {
    if (position.y !== null) return;
    setPosition({ x: MARGE, y: window.innerHeight - 156 });
  };

  const demarrerDrag = () => {
    positionInitiale();
    dragRef.current = true;
    aBougeRef.current = false;
  };

  const pendantDrag = (e) => {
    if (!dragRef.current) return;
    aBougeRef.current = true;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    setPosition({
      x: Math.max(MARGE, Math.min(window.innerWidth - TAILLE - MARGE, x - TAILLE / 2)),
      y: Math.max(80, Math.min(window.innerHeight - TAILLE - 90, y - TAILLE / 2)),
    });
  };

  const arreterDrag = () => {
    if (!dragRef.current) return;
    dragRef.current = false;
    if (aBougeRef.current) {
      // Snap au bord le plus proche, comme AssistiveTouch
      setPosition((p) => {
        const milieu = window.innerWidth / 2;
        const collerAGauche = (p.x + TAILLE / 2) < milieu;
        return { ...p, x: collerAGauche ? MARGE : window.innerWidth - TAILLE - MARGE };
      });
    }
  };

  return (
    <>
      <button
        onClick={() => { if (!aBougeRef.current) setOuvert(true); }}
        onMouseDown={demarrerDrag}
        onMouseMove={pendantDrag}
        onMouseUp={arreterDrag}
        onMouseLeave={arreterDrag}
        onTouchStart={demarrerDrag}
        onTouchMove={pendantDrag}
        onTouchEnd={arreterDrag}
        aria-label={t("divers.donnerMonAvis")}
        className="fixed z-50 flex items-center justify-center rounded-full shadow-lg"
        style={{
          left: position.x,
          top: position.y === null ? undefined : position.y,
          bottom: position.y === null ? 76 : undefined,
          width: TAILLE,
          height: TAILLE,
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          transition: dragRef.current ? "none" : "left 260ms ease, top 260ms ease",
        }}
      >
        <MessageSquarePlus size={20} color={COLORS.accentPrimary} />
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="w-full sm:max-w-sm max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-6" style={{ background: COLORS.background, color: COLORS.textPrimary }}>
            <div className="flex justify-end mb-1">
              <button onClick={() => setOuvert(false)} aria-label={t("pwa.fermer")}>
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
