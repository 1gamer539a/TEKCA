"use client";

import React, { useState } from "react";
import { Copy, Check, Share2 } from "lucide-react";

/*
  Lien public de la boutique + « Copier » et « Partager sur WhatsApp ».
  Le vendeur le colle dans sa bio Instagram, un statut WhatsApp, une carte…
*/
export default function LienBoutique({ COLORS, t, lien, nomBoutique }) {
  const [copie, setCopie] = useState(false);
  if (!lien) return null;

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(lien);
    } catch {
      // Navigateur sans accès au presse-papier : repli par sélection d'un champ caché.
      const champ = document.createElement("textarea");
      champ.value = lien;
      champ.style.position = "fixed";
      champ.style.opacity = "0";
      document.body.appendChild(champ);
      champ.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(champ);
    }
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  };

  const partagerWhatsapp = () => {
    const message = t("dashboard.messagePartage", { nom: nomBoutique || "TEKÇA", lien });
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="rounded-xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
      <p className="text-xs font-semibold mb-1">{t("dashboard.lienBoutique")}</p>
      <p className="text-[11px] mb-2" style={{ color: COLORS.textMuted }}>{t("dashboard.lienBoutiqueDesc")}</p>
      <p
        className="text-xs rounded-lg px-3 py-2 mb-2 break-all"
        style={{ background: COLORS.background, border: `1px solid ${COLORS.border}`, color: COLORS.accentSecondary }}
      >
        {lien}
      </p>
      <div className="flex gap-2">
        <button
          onClick={copier}
          className="flex-1 rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
          style={{ background: COLORS.accentPrimary, color: COLORS.background }}
        >
          {copie ? <Check size={14} /> : <Copy size={14} />}
          {copie ? t("dashboard.lienCopie") : t("dashboard.copierLien")}
        </button>
        <button
          onClick={partagerWhatsapp}
          className="flex-1 rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
          style={{ background: "#25D366", color: "#fff" }}
        >
          <Share2 size={14} />
          {t("dashboard.partagerWhatsapp")}
        </button>
      </div>
    </div>
  );
}
