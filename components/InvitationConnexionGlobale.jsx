"use client";

import React, { useEffect, useState } from "react";
import CarteConnexionRequise from "./CarteConnexionRequise";
import { EVENEMENT_CONNEXION } from "../lib/connexion";

/*
  Fenêtre « Connexion requise », montée UNE fois dans app/layout.jsx : n'importe quel écran
  l'ouvre avec demanderConnexion(raison) / exigerConnexion(...) (lib/connexion.js).
*/
export default function InvitationConnexionGlobale() {
  const [invitation, setInvitation] = useState(null); // { raison, suite }

  useEffect(() => {
    const ouvrir = (e) => setInvitation(e.detail || { raison: "defaut" });
    window.addEventListener(EVENEMENT_CONNEXION, ouvrir);
    return () => window.removeEventListener(EVENEMENT_CONNEXION, ouvrir);
  }, []);

  if (!invitation) return null;
  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center px-4 pb-6"
      style={{ zIndex: 110, background: "rgba(0,0,0,0.6)" }}
      onClick={() => setInvitation(null)}
      role="dialog"
      aria-modal="true"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
        <CarteConnexionRequise raison={invitation.raison} suite={invitation.suite} onFermer={() => setInvitation(null)} />
      </div>
    </div>
  );
}
