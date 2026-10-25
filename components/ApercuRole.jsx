"use client";

import React from "react";
import { PERMISSIONS } from "../lib/permissions";

const fmt = (n) => Number(n || 0).toLocaleString("fr-FR");

function Carte({ COLORS, libelle, valeur, alerte }) {
  return (
    <div className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${alerte ? "#B23A2E" : COLORS.border}` }}>
      <p className="text-[10px]" style={{ color: COLORS.textMuted }}>{libelle}</p>
      <p className="text-base font-bold" style={{ color: alerte ? "#B23A2E" : COLORS.accentPrimary }}>{valeur}</p>
    </div>
  );
}

/*
  Mini vue d'ensemble d'un membre d'équipe : uniquement les chiffres des
  domaines qui lui sont attribués (l'admin principal a la vue complète).
  Les chiffres viennent des données déjà chargées (donc déjà filtrées par
  les droits de la base) — rien de plus n'est demandé au serveur.
*/
export default function ApercuRole({ COLORS, peut, d, aller }) {
  const blocs = [];

  if (peut("support")) {
    blocs.push({
      id: "support",
      cartes: [
        ["Signalements ouverts", d.signalementsOuverts, d.signalementsOuverts > 0],
        ["Nouveaux avis", d.avisNouveaux, d.avisNouveaux > 0],
        ["Messages de chat récents", d.chats, false],
        ["Questions FAQ", d.faqs, false],
      ],
      onglet: "signalements",
    });
  }
  if (peut("kyc")) {
    blocs.push({
      id: "kyc",
      cartes: [
        ["Vérifications d'identité en attente", d.kycEnAttente, d.kycEnAttente > 0],
        ["Vendeurs à valider", d.vendeursEnAttente, d.vendeursEnAttente > 0],
        ["Vendeurs suspendus", d.vendeursSuspendus, false],
      ],
      onglet: "kyc",
    });
  }
  if (peut("catalogue")) {
    blocs.push({
      id: "catalogue",
      cartes: [
        ["Produits à valider", d.produitsEnAttente, d.produitsEnAttente > 0],
        ["Attente la plus longue", d.produitPlusAncienJours === null ? "—" : `${d.produitPlusAncienJours} j`, d.produitPlusAncienJours >= 2],
      ],
      onglet: "produits",
    });
  }
  if (peut("finance")) {
    blocs.push({
      id: "finance",
      cartes: [
        ["Retraits à traiter", d.retraitsNb, d.retraitsNb > 0],
        ["Montant à verser (FCFA)", fmt(d.retraitsMontant), false],
        ["Fonds en séquestre (FCFA)", fmt(d.fondsSequestres), false],
        ["Fonds en portefeuilles (FCFA)", fmt(d.fondsDisponibles), false],
      ],
      onglet: "retraits",
    });
  }
  if (peut("marketing")) {
    blocs.push({
      id: "marketing",
      cartes: [
        ["Bannières", d.bannieres, false],
        ["Codes promo", d.codesPromo, false],
        ["Événements en cours", d.tournoisEnCours, false],
        ["Modules de formation", d.modulesFormation, false],
      ],
      onglet: "marketing",
    });
  }
  if (peut("technique")) {
    blocs.push({
      id: "technique",
      cartes: [
        ["Requêtes IA récentes", d.logsIa, false],
        ["Connexions échouées (30 derniers événements)", d.connexionsEchouees, d.connexionsEchouees >= 10],
      ],
      onglet: "ia_securite",
    });
  }
  if (peut("utilisateurs")) {
    blocs.push({
      id: "utilisateurs",
      cartes: [["Utilisateurs inscrits", fmt(d.nbUtilisateurs), false]],
      onglet: "utilisateurs",
    });
  }

  return (
    <>
      <p className="text-[11px]" style={{ color: COLORS.textMuted }}>
        Ton aperçu : les chiffres de ton rôle uniquement.
      </p>
      {blocs.length === 0 && (
        <p className="text-sm text-center py-10" style={{ color: COLORS.textMuted }}>Aucun chiffre à afficher pour ton rôle.</p>
      )}
      {blocs.map((b) => (
        <div key={b.id} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.textMuted }}>
              {PERMISSIONS.find((p) => p.id === b.id)?.label}
            </p>
            <button onClick={() => aller(b.onglet)} className="text-[11px] font-semibold" style={{ color: COLORS.accentPrimary }}>
              Ouvrir →
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {b.cartes.map(([libelle, valeur, alerte]) => (
              <Carte key={libelle} COLORS={COLORS} libelle={libelle} valeur={valeur} alerte={alerte} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
