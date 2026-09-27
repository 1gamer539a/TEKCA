"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useTheme } from "../lib/ThemeContext";

const COLORS = { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" };

/*
  CORRECTIF — le lien "Politique de livraison & retours" dans Mon
  Compte pointait par erreur vers /contact. Contenu écrit à partir du
  fonctionnement réel déjà en place dans le code (séquestre wallet,
  code de confirmation à 6 caractères, statuts de commande) plutôt
  que du texte générique.
*/
const SECTIONS = [
  {
    titre: "Produits numériques (recharges, abonnements, comptes)",
    texte:
      "La livraison est automatique et immédiate dès que le paiement est confirmé. Aucun code de confirmation n'est nécessaire pour ce type de produit.",
  },
  {
    titre: "Produits physiques (vêtements, accessoires)",
    texte:
      "Le montant payé est mis de côté (séquestre) et n'est versé au vendeur qu'après confirmation de la réception. À la commande, tu reçois un code à 6 caractères (lettres et chiffres) : donne-le au vendeur uniquement au moment où tu récupères le produit en main propre. Ce code déclenche le versement au vendeur — ne le communique jamais avant d'avoir le produit entre les mains.",
  },
  {
    titre: "Délais",
    texte:
      "Les délais de remise en main propre sont à convenir directement avec le vendeur via la messagerie de la plateforme. TEKÇA n'assure pas le transport physique du produit.",
  },
  {
    titre: "Litiges et retours",
    texte:
      "Si le produit reçu ne correspond pas à la description, ne donne pas le code de confirmation et signale immédiatement le problème via \"Nous contacter\" en précisant la commande concernée. Le portefeuille du vendeur est automatiquement gelé le temps que l'équipe examine la situation.",
  },
  {
    titre: "Remboursement",
    texte:
      "Tant que le code de confirmation n'a pas été communiqué, l'argent reste en séquestre et n'a pas été versé au vendeur — un remboursement à l'acheteur reste possible en cas de litige confirmé par l'équipe.",
  },
];

export default function PolitiqueLivraison() {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-base">Politique de livraison & retours</h1>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-24 flex flex-col gap-5">
        {SECTIONS.map((s) => (
          <div key={s.titre}>
            <h2 className="font-bold text-sm mb-1" style={{ color: COLORS.accentPrimary }}>{s.titre}</h2>
            <p className="text-sm" style={{ color: COLORS.textMuted }}>{s.texte}</p>
          </div>
        ))}
      </main>
    </div>
  );
}
