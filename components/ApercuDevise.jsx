"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../lib/i18n/LanguageContext";

/*
  Sous le champ « montant » (toujours en FCFA) d'une recharge ou d'un
  retrait : montre l'équivalent dans la devise du pays de l'utilisateur
  quand ce n'est pas du FCFA. Le taux est fixé côté serveur au moment de la
  validation ; ceci n'est qu'un aperçu.
*/
export default function ApercuDevise({ montant, pays, sens, COLORS }) {
  const { t } = useLanguage();
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let actif = true;
    const minuteur = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const r = await fetch(`/api/wallet/taux?pays=${encodeURIComponent(pays)}&montant=${encodeURIComponent(montant || "")}&sens=${sens}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const d = await r.json();
        if (actif) setInfo(r.ok ? d : null);
      } catch {
        if (actif) setInfo(null);
      }
    }, 400);
    return () => { actif = false; clearTimeout(minuteur); };
  }, [montant, pays, sens]);

  if (!info || info.fcfa) return null;
  if (!info.disponible) {
    return <p className="text-[11px] font-semibold" style={{ color: "#B23A2E" }}>{t("wallet.tauxIndisponible", { devise: info.devise })}</p>;
  }
  if (info.montantLocal === null || info.montantLocal === undefined) return null;
  return (
    <p className="text-[11px]" style={{ color: COLORS.textMuted }}>
      {t(sens === "retrait" ? "wallet.apercuRetrait" : "wallet.apercuRecharge", { montant: Number(info.montantLocal).toLocaleString(), devise: info.devise })}
    </p>
  );
}
