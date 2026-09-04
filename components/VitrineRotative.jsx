"use client";

import React, { useState, useEffect } from "react";

/*
  Illustrations faites maison — génériques, sans marque, sans logo.
  Utilisées comme motif de fond qui change toutes les 5 secondes
  derrière le hero et le bandeau vendeur de la page d'accueil.
*/
const DEGRADES_VITRINE = (
  <defs>
    <linearGradient id="degOrangeClair" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#F4924F" />
      <stop offset="100%" stopColor="#C6461E" />
    </linearGradient>
    <linearGradient id="degOrangeFonce" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#C6461E" />
      <stop offset="100%" stopColor="#7A2A10" />
    </linearGradient>
    <linearGradient id="degVerre" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.35" />
      <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
    </linearGradient>
  </defs>
);

function ObjetBaskets() {
  return (
    <svg viewBox="0 0 200 200" width="150" height="150">
      {DEGRADES_VITRINE}
      <ellipse cx="100" cy="172" rx="78" ry="7" fill="#000" opacity="0.15" />
      <path d="M28 150 C28 130 40 112 62 100 C80 90 92 82 100 68 C106 78 118 86 134 90 C158 96 172 110 172 132 C172 144 164 150 150 150 Z" fill="url(#degOrangeClair)" />
      <path d="M28 150 C28 138 34 128 46 122 C58 130 74 134 92 132 C114 130 132 122 146 112 C160 118 172 124 172 132 C172 144 164 150 150 150 Z" fill="url(#degOrangeFonce)" />
      <path d="M100 68 C112 74 118 84 118 96 M126 84 C132 90 136 98 136 106 M144 96 C150 100 154 106 156 114" stroke="#FFF3E8" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M28 150 C28 158 34 163 46 163 L154 163 C164 163 172 158 172 150 L172 146 C172 152 162 156 150 156 L46 156 C36 156 28 152 28 146 Z" fill="#1A1108" />
    </svg>
  );
}

function ObjetTelephone() {
  return (
    <svg viewBox="0 0 200 200" width="130" height="150">
      {DEGRADES_VITRINE}
      <rect x="55" y="16" width="90" height="168" rx="20" fill="url(#degOrangeFonce)" />
      <rect x="61" y="24" width="78" height="152" rx="13" fill="#1A1108" />
      <rect x="65" y="29" width="70" height="140" rx="9" fill="url(#degOrangeClair)" opacity="0.9" />
      <rect x="65" y="29" width="70" height="70" rx="9" fill="url(#degVerre)" />
      <circle cx="118" cy="42" r="6" fill="#1A1108" opacity="0.6" />
      <circle cx="118" cy="42" r="3" fill="#0B0A0A" />
      <rect x="90" y="172" width="20" height="4" rx="2" fill="#1A1108" opacity="0.5" />
    </svg>
  );
}

function ObjetJeuMobile() {
  return (
    <svg viewBox="0 0 200 200" width="150" height="150">
      {DEGRADES_VITRINE}
      <rect x="66" y="10" width="68" height="128" rx="16" fill="url(#degOrangeFonce)" />
      <rect x="72" y="17" width="56" height="114" rx="10" fill="#1A1108" />
      <rect x="76" y="21" width="48" height="106" rx="7" fill="url(#degOrangeClair)" opacity="0.9" />
      <circle cx="100" cy="55" r="14" fill="none" stroke="#FFF3E8" strokeWidth="3" opacity="0.85" />
      <path d="M100 47 L100 63 M92 55 L108 55" stroke="#FFF3E8" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
      <circle cx="88" cy="95" r="5" fill="#FFF3E8" opacity="0.8" />
      <circle cx="112" cy="95" r="5" fill="#FFF3E8" opacity="0.5" />
      <path d="M40 150 C40 136 50 126 64 126 C78 126 84 136 84 148 C84 160 76 168 62 168 C48 168 40 162 40 150 Z" fill="url(#degOrangeClair)" />
      <path d="M116 148 C116 136 122 126 136 126 C150 126 160 136 160 150 C160 162 152 168 138 168 C124 168 116 160 116 148 Z" fill="url(#degOrangeClair)" />
      <circle cx="58" cy="140" r="6" fill="#1A1108" opacity="0.5" />
      <circle cx="70" cy="152" r="6" fill="#1A1108" opacity="0.5" />
      <circle cx="132" cy="140" r="5" fill="#1A1108" opacity="0.5" />
      <circle cx="146" cy="140" r="5" fill="#1A1108" opacity="0.5" />
      <circle cx="139" cy="153" r="5" fill="#1A1108" opacity="0.5" />
    </svg>
  );
}

function ObjetManette() {
  return (
    <svg viewBox="0 0 200 200" width="170" height="120">
      {DEGRADES_VITRINE}
      <path d="M40 90 C30 90 20 100 18 116 C16 132 24 150 38 152 C48 153 54 144 60 132 L140 132 C146 144 152 153 162 152 C176 150 184 132 182 116 C180 100 170 90 160 90 C150 90 145 96 138 100 L62 100 C55 96 50 90 40 90 Z" fill="url(#degOrangeFonce)" />
      <path d="M40 92 C31 92 22 101 20 116 C18 130 25 147 38 149 C47 150 53 142 58 131 L142 131 C147 142 153 150 162 149 C175 147 182 130 180 116 C178 101 169 92 160 92 C151 92 146 98 139 102 L61 102 C54 98 49 92 40 92 Z" fill="url(#degOrangeClair)" opacity="0.9" />
      <path d="M58 108 L58 124 M50 116 L66 116" stroke="#1A1108" strokeWidth="5" strokeLinecap="round" opacity="0.75" />
      <circle cx="150" cy="106" r="5" fill="#1A1108" opacity="0.7" />
      <circle cx="164" cy="112" r="5" fill="#1A1108" opacity="0.55" />
      <circle cx="150" cy="120" r="5" fill="#1A1108" opacity="0.55" />
      <circle cx="136" cy="112" r="5" fill="#1A1108" opacity="0.55" />
      <circle cx="100" cy="112" r="7" fill="#1A1108" opacity="0.5" />
    </svg>
  );
}

function ObjetLivre() {
  return (
    <svg viewBox="0 0 200 200" width="160" height="130">
      {DEGRADES_VITRINE}
      <path d="M100 50 C84 40 56 36 34 40 L34 148 C56 144 84 148 100 158 Z" fill="url(#degOrangeFonce)" />
      <path d="M100 50 C116 40 144 36 166 40 L166 148 C144 144 116 148 100 158 Z" fill="url(#degOrangeClair)" />
      <path d="M100 50 L100 158" stroke="#1A1108" strokeWidth="2" opacity="0.4" />
      <path d="M44 56 C58 52 78 52 92 58 M44 70 C58 66 78 66 92 72 M44 84 C58 80 78 80 92 86" stroke="#FFF3E8" strokeWidth="2" strokeLinecap="round" opacity="0.6" fill="none" />
      <path d="M108 58 C122 52 142 52 156 56 M108 72 C122 66 142 66 156 70 M108 86 C122 80 142 80 156 84" stroke="#7A2A10" strokeWidth="2" strokeLinecap="round" opacity="0.5" fill="none" />
    </svg>
  );
}

function ObjetCasque() {
  return (
    <svg viewBox="0 0 200 200" width="150" height="140">
      {DEGRADES_VITRINE}
      <path d="M40 108 C40 66 66 38 100 38 C134 38 160 66 160 108" fill="none" stroke="url(#degOrangeFonce)" strokeWidth="12" strokeLinecap="round" />
      <ellipse cx="42" cy="128" rx="22" ry="30" fill="url(#degOrangeClair)" />
      <ellipse cx="158" cy="128" rx="22" ry="30" fill="url(#degOrangeClair)" />
      <ellipse cx="42" cy="128" rx="12" ry="18" fill="#1A1108" opacity="0.55" />
      <ellipse cx="158" cy="128" rx="12" ry="18" fill="#1A1108" opacity="0.55" />
      <path d="M158 150 C158 168 148 178 134 178" fill="none" stroke="url(#degOrangeFonce)" strokeWidth="6" strokeLinecap="round" />
      <circle cx="132" cy="179" r="5" fill="#1A1108" opacity="0.6" />
    </svg>
  );
}

function ObjetEcran() {
  return (
    <svg viewBox="0 0 200 200" width="160" height="130">
      {DEGRADES_VITRINE}
      <rect x="30" y="36" width="140" height="98" rx="8" fill="url(#degOrangeFonce)" />
      <rect x="38" y="44" width="124" height="82" rx="4" fill="#1A1108" />
      <rect x="41" y="47" width="118" height="76" fill="url(#degOrangeClair)" opacity="0.85" />
      <path d="M84 78 L120 92 L84 106 Z" fill="#FFF3E8" opacity="0.85" />
      <rect x="90" y="134" width="20" height="18" fill="url(#degOrangeFonce)" />
      <rect x="66" y="152" width="68" height="8" rx="4" fill="url(#degOrangeFonce)" />
    </svg>
  );
}

function ObjetGemme() {
  return (
    <svg viewBox="0 0 200 200" width="140" height="140">
      {DEGRADES_VITRINE}
      <path d="M100 30 L142 66 L120 160 L80 160 L58 66 Z" fill="url(#degOrangeClair)" />
      <path d="M100 30 L142 66 L100 90 Z" fill="url(#degOrangeFonce)" opacity="0.9" />
      <path d="M100 30 L58 66 L100 90 Z" fill="url(#degOrangeClair)" opacity="0.7" />
      <path d="M58 66 L100 90 L80 160 Z" fill="url(#degOrangeFonce)" opacity="0.7" />
      <path d="M142 66 L100 90 L120 160 Z" fill="url(#degOrangeFonce)" opacity="0.85" />
      <path d="M100 90 L80 160 M100 90 L120 160 M100 90 L100 30" stroke="#FFF3E8" strokeWidth="1.5" opacity="0.5" />
    </svg>
  );
}

function ObjetMontre() {
  return (
    <svg viewBox="0 0 200 200" width="130" height="160">
      {DEGRADES_VITRINE}
      <path d="M82 20 L118 20 L114 58 L86 58 Z" fill="url(#degOrangeFonce)" />
      <path d="M82 180 L118 180 L114 142 L86 142 Z" fill="url(#degOrangeFonce)" />
      <rect x="66" y="56" width="68" height="88" rx="16" fill="url(#degOrangeFonce)" />
      <rect x="74" y="64" width="52" height="72" rx="10" fill="#1A1108" />
      <rect x="78" y="68" width="44" height="64" rx="7" fill="url(#degOrangeClair)" opacity="0.9" />
      <line x1="100" y1="100" x2="100" y2="80" stroke="#1A1108" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      <line x1="100" y1="100" x2="114" y2="100" stroke="#1A1108" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      <circle cx="100" cy="100" r="3" fill="#1A1108" opacity="0.8" />
    </svg>
  );
}

function ObjetSac() {
  return (
    <svg viewBox="0 0 200 200" width="150" height="150">
      {DEGRADES_VITRINE}
      <path d="M70 60 C70 38 82 24 100 24 C118 24 130 38 130 60" fill="none" stroke="url(#degOrangeFonce)" strokeWidth="8" />
      <path d="M46 66 L154 66 L146 168 C146 176 138 182 128 182 L72 182 C62 182 54 176 54 168 Z" fill="url(#degOrangeClair)" />
      <path d="M46 66 L154 66 L150 90 L50 90 Z" fill="url(#degOrangeFonce)" opacity="0.8" />
      <rect x="86" y="104" width="28" height="20" rx="4" fill="#1A1108" opacity="0.4" />
    </svg>
  );
}

function ObjetOrdinateur() {
  return (
    <svg viewBox="0 0 200 200" width="170" height="130">
      {DEGRADES_VITRINE}
      <path d="M56 44 L144 44 C148 44 150 47 150 50 L150 122 L50 122 L50 50 C50 47 52 44 56 44 Z" fill="url(#degOrangeFonce)" />
      <rect x="57" y="51" width="86" height="64" fill="url(#degOrangeClair)" opacity="0.9" />
      <rect x="57" y="51" width="86" height="64" fill="url(#degVerre)" />
      <path d="M24 122 L176 122 L188 148 C189 152 186 156 181 156 L19 156 C14 156 11 152 12 148 Z" fill="url(#degOrangeFonce)" />
      <path d="M24 122 L176 122 L182 134 L18 134 Z" fill="url(#degOrangeClair)" opacity="0.8" />
    </svg>
  );
}

function ObjetVetement() {
  return (
    <svg viewBox="0 0 200 200" width="160" height="150">
      {DEGRADES_VITRINE}
      <path d="M76 34 L124 34 L150 58 L134 78 L124 68 L124 168 L76 168 L76 68 L66 78 L50 58 Z" fill="url(#degOrangeClair)" />
      <path d="M76 34 C76 48 88 56 100 56 C112 56 124 48 124 34" fill="none" stroke="url(#degOrangeFonce)" strokeWidth="6" />
      <path d="M76 68 L76 168 L94 168 L94 74 Z" fill="url(#degOrangeFonce)" opacity="0.35" />
    </svg>
  );
}

const VITRINE_ITEMS = [
  { label: "Baskets", Illustration: ObjetBaskets },
  { label: "iPhone", Illustration: ObjetTelephone },
  { label: "Jeu mobile", Illustration: ObjetJeuMobile },
  { label: "PlayStation", Illustration: ObjetManette },
  { label: "Livres", Illustration: ObjetLivre },
  { label: "Casque gaming", Illustration: ObjetCasque },
  { label: "Abonnements", Illustration: ObjetEcran },
  { label: "Recharges", Illustration: ObjetGemme },
  { label: "Montres", Illustration: ObjetMontre },
  { label: "Sacs", Illustration: ObjetSac },
  { label: "Ordinateurs", Illustration: ObjetOrdinateur },
  { label: "Vêtements", Illustration: ObjetVetement },
];

/*
  Hook partagé pour que le hero ET le bandeau vendeur affichent le
  MÊME élément au même moment (changement synchronisé toutes les 5s).
*/
export function useVitrineIndex() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const intervalle = setInterval(() => {
      setIndex((i) => (i + 1) % VITRINE_ITEMS.length);
    }, 5000);
    return () => clearInterval(intervalle);
  }, []);
  return index;
}

export function VitrineRotative({ theme, index }) {
  const item = VITRINE_ITEMS[index % VITRINE_ITEMS.length];
  const Illustration = item.Illustration;
  const opaciteIcone = theme === "sombre" ? 0.5 : 0.32;
  const opaciteLabel = theme === "sombre" ? 0.55 : 0.4;

  return (
    <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none" style={{ zIndex: 0 }}>
      <div key={item.label} className="absolute inset-0 flex flex-col items-center justify-center gap-2 takca-vitrine-entree">
        <div style={{ opacity: opaciteIcone }}>
          <Illustration />
        </div>
        <span
          className="text-xs font-bold uppercase tracking-[0.2em]"
          style={{ opacity: opaciteLabel, color: "#E85D2F" }}
        >
          {item.label}
        </span>
      </div>
    </div>
  );
}
