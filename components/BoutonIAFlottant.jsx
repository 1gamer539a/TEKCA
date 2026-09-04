"use client";

import React, { useState, useRef } from "react";
import { Sparkles, X } from "lucide-react";

/*
  A intégrer une seule fois, tout en bas du layout racine de l'app
  (ex: dans le _app / layout Next.js), pour qu'il apparaisse sur
  TOUTES les pages du site, peu importe où l'utilisateur navigue —
  façon AssistiveTouch iPhone. Le bouton est draggable verticalement
  pour ne jamais gêner le contenu ou le bottom nav.
*/
export default function BoutonIAFlottant({ COLORS, onOpen }) {
  const [position, setPosition] = useState({ x: null, y: 480 });
  const dragRef = useRef(false);

  const demarrerDrag = (e) => {
    dragRef.current = true;
  };

  const pendantDrag = (e) => {
    if (!dragRef.current) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    setPosition((p) => ({ ...p, y: Math.max(80, Math.min(window.innerHeight - 140, y)) }));
  };

  const arreterDrag = () => {
    dragRef.current = false;
  };

  return (
    <button
      onClick={onOpen}
      onMouseDown={demarrerDrag}
      onMouseMove={pendantDrag}
      onMouseUp={arreterDrag}
      onTouchStart={demarrerDrag}
      onTouchMove={pendantDrag}
      onTouchEnd={arreterDrag}
      aria-label="Ouvrir l'assistant IA"
      className="fixed z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
      style={{
        right: 16,
        top: position.y,
        background: COLORS.accentPrimary,
        boxShadow: `0 4px 16px rgba(0,0,0,0.4)`,
      }}
    >
      <Sparkles size={24} color={COLORS.background} />
    </button>
  );
}
