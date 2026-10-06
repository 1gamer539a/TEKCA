"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { chargerParametres } from "../lib/parametres-client";

/*
  Réglage « À chaque ouverture » du verrouillage PIN.
  Le cookie PIN survit à la fermeture d'un onglet (c'est un cookie du
  navigateur) ; on utilise donc sessionStorage, propre à chaque onglet et
  vidé à sa fermeture : dans un onglet fraîchement ouvert, si l'utilisateur
  a choisi « À chaque ouverture », on retire le cookie PIN et on recharge,
  ce qui renvoie vers l'écran du code PIN. Ne fait rien pour les autres
  réglages (verrouillage par inactivité, géré par le middleware).
*/
export default function GardePIN() {
  const chemin = usePathname();
  useEffect(() => {
    (async () => {
      try {
        if (sessionStorage.getItem("tekca_onglet_ouvert")) return;
        sessionStorage.setItem("tekca_onglet_ouvert", "1");
        if (chemin.startsWith("/securite") || chemin.startsWith("/auth")) return;
        const parametres = await chargerParametres();
        if (parametres && parametres.pin_delai_minutes === 0) {
          await fetch("/api/securite/pin/deconnecter", { method: "POST" });
          window.location.reload();
        }
      } catch {
        /* jamais bloquant */
      }
    })();
  }, []); // une seule fois par onglet

  // CORRECTIF — « Patiente un instant » à vie : quand on part vers Google, une
  // page de paiement… puis qu'on revient avec la flèche retour, le navigateur
  // restaure la page figée (bfcache) avec son chargement en cours, et plus rien
  // ne se passe. À chaque retour par ce cache, on recharge la page : l'état
  // repart propre (écran de connexion, portefeuille, saisie du PIN…).
  useEffect(() => {
    const auRetour = (e) => { if (e.persisted) window.location.reload(); };
    window.addEventListener("pageshow", auRetour);
    // Petite vibration au toucher d'un bouton (téléphones qui la gèrent).
    const auToucher = (e) => {
      if (e.target.closest && e.target.closest("button:not(:disabled), a[href]")) navigator.vibrate?.(8);
    };
    window.addEventListener("pointerdown", auToucher, { passive: true });
    return () => {
      window.removeEventListener("pageshow", auRetour);
      window.removeEventListener("pointerdown", auToucher);
    };
  }, []);
  return null;
}
