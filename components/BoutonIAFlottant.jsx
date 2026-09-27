"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sparkles } from "lucide-react";

const TAILLE = 56;
const TAILLE_ETENDUE = 190;
const MARGE = 16;

/*
  A intégrer une seule fois, tout en bas du layout racine de l'app,
  pour qu'il apparaisse sur TOUTES les pages — façon AssistiveTouch
  iPhone. Déplacement libre en 2D (X et Y) avec aimantation au bord
  gauche ou droit le plus proche au relâchement — même comportement
  que BoutonFeedbackFlottant.jsx, pour que les deux bulles flottantes
  de l'app se comportent de façon cohérente.

  L'animation "pilule" (halo qui respire + extension périodique avec
  texte, façon Dynamic Island) est conservée : quand la bulle est
  collée au bord DROIT et s'étend, elle grandit vers la GAUCHE plutôt
  que de déborder de l'écran (voir styleLeft plus bas).
*/
export default function BoutonIAFlottant({ COLORS, onOpen }) {
  const [position, setPosition] = useState({ x: null, y: 480 });
  const [colleADroite, setColleADroite] = useState(true);
  const [etendu, setEtendu] = useState(false);
  const dragRef = useRef(false);
  const aBougeRef = useRef(false);

  useEffect(() => {
    if (position.x === null && typeof window !== "undefined") {
      setPosition((p) => ({ ...p, x: window.innerWidth - TAILLE - MARGE }));
    }
  }, [position.x]);

  useEffect(() => {
    const intervalle = setInterval(() => {
      if (dragRef.current) return;
      setEtendu(true);
      setTimeout(() => setEtendu(false), 2600);
    }, 20000);
    return () => clearInterval(intervalle);
  }, []);

  const demarrerDrag = () => {
    dragRef.current = true;
    aBougeRef.current = false;
    setEtendu(false);
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
      setPosition((p) => {
        const milieu = window.innerWidth / 2;
        const versGauche = (p.x + TAILLE / 2) < milieu;
        setColleADroite(!versGauche);
        return { ...p, x: versGauche ? MARGE : window.innerWidth - TAILLE - MARGE };
      });
    }
  };

  if (position.x === null) return null;

  // Quand collé à droite, la pilule grandit vers la gauche (on
  // décale "left" du surplus de largeur) pour ne jamais déborder de
  // l'écran ; collée à gauche, elle grandit normalement vers la droite.
  const largeur = etendu ? TAILLE_ETENDUE : TAILLE;
  const gauche = etendu && colleADroite ? position.x - (TAILLE_ETENDUE - TAILLE) : position.x;

  return (
    <>
      <style>{`
        @keyframes tekcaHaloRespire {
          0%, 100% { box-shadow: 0 4px 16px rgba(0,0,0,0.4), 0 0 0 0 rgba(232,93,47,0.45); }
          50% { box-shadow: 0 4px 16px rgba(0,0,0,0.4), 0 0 0 10px rgba(232,93,47,0); }
        }
      `}</style>
      <button
        onClick={() => { if (!aBougeRef.current) onOpen(); }}
        onMouseDown={demarrerDrag}
        onMouseMove={pendantDrag}
        onMouseUp={arreterDrag}
        onMouseLeave={arreterDrag}
        onTouchStart={demarrerDrag}
        onTouchMove={pendantDrag}
        onTouchEnd={arreterDrag}
        aria-label="Ouvrir l'assistant IA"
        className="fixed z-50 flex items-center rounded-full shadow-lg overflow-hidden"
        style={{
          left: gauche,
          top: position.y,
          height: TAILLE,
          width: largeur,
          background: COLORS.accentPrimary,
          transition: dragRef.current ? "none" : "left 420ms cubic-bezier(0.34, 1.56, 0.64, 1), top 260ms ease, width 420ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          animation: etendu ? "none" : "tekcaHaloRespire 3.2s ease-in-out infinite",
        }}
      >
        <span className="flex items-center justify-center flex-shrink-0" style={{ width: TAILLE, height: TAILLE }}>
          <Sparkles size={24} color={COLORS.background} />
        </span>
        <span
          className="text-xs font-semibold whitespace-nowrap pr-4"
          style={{ color: COLORS.background, opacity: etendu ? 1 : 0, transition: "opacity 200ms ease 200ms" }}
        >
          Besoin d'aide ?
        </span>
      </button>
    </>
  );
}
