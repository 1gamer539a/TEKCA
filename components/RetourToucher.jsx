"use client";

import { useEffect } from "react";

/*
  Deux comportements globaux :

  1) RETOUR AU TOUCHER — un bouton, un lien ou un menu affiche un effet
     visible (enfoncé, assombri, contour orange) pendant au moins ~170 ms,
     même pour un tapotement très court : l'utilisateur voit que son doigt
     a bien été pris en compte. Les styles sont dans app/globals.css
     ([data-appui]).

  2) RETOUR ARRIÈRE — quand on revient d'une page externe (Google,
     Facebook…) avec la flèche « retour » du navigateur, certains
     navigateurs restaurent la page EXACTEMENT comme elle était, y compris
     un état « Patiente un instant… » ou « Vérification… » qui ne se
     termine jamais. On recharge alors la page pour repartir d'un état sain.
*/
export default function RetourToucher() {
  useEffect(() => {
    const MIN_MS = 170;
    const cible = (e) => (e.target instanceof Element ? e.target.closest('button, a[href], [role="button"], summary, label[for]') : null);

    const debut = (e) => {
      const el = cible(e);
      if (!el || el.disabled) return;
      el.setAttribute("data-appui", String(Date.now()));
      setTimeout(() => el.removeAttribute("data-appui"), 900); // filet de sécurité
    };
    const fin = () => {
      document.querySelectorAll("[data-appui]").forEach((el) => {
        const ecoule = Date.now() - Number(el.getAttribute("data-appui") || 0);
        setTimeout(() => el.removeAttribute("data-appui"), Math.max(0, MIN_MS - ecoule));
      });
    };
    const apresRetour = (e) => {
      if (e.persisted) window.location.reload();
    };

    document.addEventListener("pointerdown", debut, { passive: true });
    document.addEventListener("pointerup", fin, { passive: true });
    document.addEventListener("pointercancel", fin, { passive: true });
    window.addEventListener("pageshow", apresRetour);
    return () => {
      document.removeEventListener("pointerdown", debut);
      document.removeEventListener("pointerup", fin);
      document.removeEventListener("pointercancel", fin);
      window.removeEventListener("pageshow", apresRetour);
    };
  }, []);
  return null;
}
