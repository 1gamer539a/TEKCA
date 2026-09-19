"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, X } from "lucide-react";

/*
  A intégrer une seule fois, tout en bas du layout racine de l'app
  (ex: dans le _app / layout Next.js), pour qu'il apparaisse sur
  TOUTES les pages du site, peu importe où l'utilisateur navigue —
  façon AssistiveTouch iPhone. Le bouton est draggable verticalement
  pour ne jamais gêner le contenu ou le bottom nav.

  CORRECTIF — le bouton était un simple rond statique. Il "respire"
  maintenant (halo animé en continu, comme une pastille vivante) et
  s'étend périodiquement en pilule avec un texte, façon Dynamic
  Island de l'iPhone, avant de se rétracter — pour rappeler sa
  présence sans être intrusif (pas de son, pas de vibration, juste un
  mouvement discret toutes les ~20s, et jamais pendant un drag).
*/
export default function BoutonIAFlottant({ COLORS, onOpen }) {
  const [position, setPosition] = useState({ x: null, y: 480 });
  const [etendu, setEtendu] = useState(false);
  const dragRef = useRef(false);
  const aBougeRef = useRef(false);

  useEffect(() => {
    const intervalle = setInterval(() => {
      if (dragRef.current) return;
      setEtendu(true);
      setTimeout(() => setEtendu(false), 2600);
    }, 20000);
    return () => clearInterval(intervalle);
  }, []);

  const demarrerDrag = (e) => {
    dragRef.current = true;
    aBougeRef.current = false;
  };

  const pendantDrag = (e) => {
    if (!dragRef.current) return;
    aBougeRef.current = true;
    setEtendu(false);
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    setPosition((p) => ({ ...p, y: Math.max(80, Math.min(window.innerHeight - 140, y)) }));
  };

  const arreterDrag = () => {
    dragRef.current = false;
  };

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
        onTouchStart={demarrerDrag}
        onTouchMove={pendantDrag}
        onTouchEnd={arreterDrag}
        aria-label="Ouvrir l'assistant IA"
        className="fixed z-50 flex items-center rounded-full shadow-lg overflow-hidden"
        style={{
          right: 16,
          top: position.y,
          height: 56,
          width: etendu ? 190 : 56,
          background: COLORS.accentPrimary,
          transition: "width 420ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          animation: etendu ? "none" : "tekcaHaloRespire 3.2s ease-in-out infinite",
        }}
      >
        <span className="flex items-center justify-center flex-shrink-0" style={{ width: 56, height: 56 }}>
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
