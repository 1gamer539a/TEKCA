"use client";

import React, { useState, useEffect } from "react";
import { Wrench } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../lib/i18n/LanguageContext";

/*
  Page affichée à tous pendant la maintenance (voir lib/maintenance.js).
  Vérifie l'état toutes les 20 secondes : dès que le service est rétabli,
  l'utilisateur est renvoyé automatiquement vers l'accueil.
*/
export default function PageMaintenance() {
  const { t } = useLanguage();
  const [etat, setEtat] = useState({ maintenance: true, message: null, equipe: false });
  const [retabli, setRetabli] = useState(false);

  const verifier = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/etat-systeme", { cache: "no-store", headers: session ? { Authorization: `Bearer ${session.access_token}` } : {} });
      if (!r.ok) return;
      const d = await r.json();
      setEtat(d);
      if (!d.maintenance) {
        setRetabli(true);
        setTimeout(() => window.location.assign("/"), 1500);
      }
    } catch {}
  };
  useEffect(() => {
    verifier();
    const minuteur = setInterval(verifier, 20000);
    return () => clearInterval(minuteur);
  }, []);

  return (
    <div style={{ background: "#0A1220", color: "#FFFFFF", minHeight: "100vh" }} className="flex flex-col items-center justify-center px-6 text-center gap-4">
      <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "#132039", border: "1px solid #1E2D4A" }}>
        <Wrench size={34} color="#E85D2F" />
      </div>
      <h1 className="text-xl font-extrabold">{retabli ? t("maintenance.retablie") : t("maintenance.titre")}</h1>
      {!retabli && <p className="text-sm max-w-xs" style={{ color: "#8B96AD" }}>{t("maintenance.desc")}</p>}
      {!retabli && etat.message && (
        <p className="text-sm font-semibold max-w-xs rounded-xl px-4 py-3" style={{ background: "#132039", border: "1px solid #1E2D4A" }}>{etat.message}</p>
      )}
      {!retabli && (
        <button onClick={verifier} className="rounded-xl px-6 py-3 text-sm font-semibold" style={{ background: "#E85D2F", color: "#0A1220" }}>
          {t("maintenance.reessayer")}
        </button>
      )}
      {etat.equipe && (
        <button onClick={() => window.location.assign("/admin")} className="text-xs font-semibold underline" style={{ color: "#C99A3A" }}>
          {t("maintenance.accesEquipe")}
        </button>
      )}
    </div>
  );
}
