"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";

/*
  Un onglet ou une appli DÉJÀ ouverts continuent de fonctionner sans recharger
  la page. Toutes les 45 secondes (et au retour sur l'appli), on vérifie le
  mode maintenance : s'il est actif et que la personne n'est pas de l'équipe,
  on l'envoie sur la page de maintenance.
*/
export default function SurveillanceMaintenance() {
  const chemin = usePathname();
  useEffect(() => {
    if (chemin.startsWith("/maintenance") || chemin.startsWith("/auth")) return;
    let actif = true;
    const verifier = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const r = await fetch("/api/etat-systeme", { cache: "no-store", headers: session ? { Authorization: `Bearer ${session.access_token}` } : {} });
        if (!r.ok || !actif) return;
        const d = await r.json();
        if (d.maintenance && !d.equipe) window.location.assign("/maintenance");
      } catch {}
    };
    verifier();
    const minuteur = setInterval(verifier, 45000);
    document.addEventListener("visibilitychange", verifier);
    return () => { actif = false; clearInterval(minuteur); document.removeEventListener("visibilitychange", verifier); };
  }, [chemin]);
  return null;
}
