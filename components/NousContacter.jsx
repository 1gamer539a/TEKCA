"use client";

import React, { useState } from "react";
import {
  ArrowLeft, Sun, Moon, AlertTriangle, HelpCircle, CreditCard,
  Store as StoreIcon, Send, CheckCircle2
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

const MOTIFS = [
  { id: "litige", label: "Litige avec un vendeur", icon: AlertTriangle },
  { id: "paiement", label: "Problème de paiement", icon: CreditCard },
  { id: "vendeur", label: "Signaler un vendeur", icon: StoreIcon },
  { id: "autre", label: "Autre question", icon: HelpCircle },
];

/*
  Passe par la route serveur /api/signalements/creer (pas d'écriture
  directe en base) : dès qu'un vendeur est visé (motif "litige" ou
  "vendeur"), son portefeuille est automatiquement gelé côté serveur
  jusqu'à résolution par l'équipe.
*/
export default function NousContacter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const commandeId = searchParams.get("commande");
  const vendeurId = searchParams.get("vendeur");
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];
  const [motif, setMotif] = useState(null);
  const [message, setMessage] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  const envoyer = async () => {
    if (!motif || !message.trim()) return;
    setErreur(null);
    setEnvoiEnCours(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const reponse = await fetch("/api/signalements/creer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ motif, message, commandeId, vendeurConcerneId: vendeurId }),
      });
      const data = await reponse.json();
      if (!reponse.ok) throw new Error(data.error || "Échec de l'envoi.");
      setEnvoye(true);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoiEnCours(false);
    }
  };

  if (envoye) {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }} className="flex flex-col items-center justify-center px-6 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.accentPrimary}` }}>
          <CheckCircle2 size={22} color={COLORS.accentPrimary} />
        </div>
        <p className="font-bold text-lg">Message envoyé à l'équipe</p>
        <p className="text-sm mt-2" style={{ color: COLORS.textMuted }}>
          Nous reviendrons vers toi rapidement. Tu peux suivre la réponse dans tes messages.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">Nous contacter</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-10 flex flex-col gap-4">
        <p className="text-xs" style={{ color: COLORS.textMuted }}>
          Ce canal est différent du chat avec un vendeur — il arrive directement à notre équipe.
        </p>

        <div>
          <label className="text-sm font-semibold block mb-2">Motif</label>
          <div className="grid grid-cols-2 gap-2">
            {MOTIFS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setMotif(id)}
                className="rounded-xl p-3 flex flex-col items-start gap-2"
                style={{
                  background: COLORS.surface,
                  border: `1px solid ${motif === id ? COLORS.accentPrimary : COLORS.border}`,
                }}
              >
                <Icon size={18} color={COLORS.accentPrimary} />
                <span className="text-xs font-semibold text-left">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold block mb-2">Ton message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Décris ta situation en détail..."
            className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
            style={{ background: COLORS.surface, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
          />
        </div>

        <button
          onClick={envoyer}
          disabled={!motif || !message.trim() || envoiEnCours}
          className="w-full rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
          style={{
            background: motif && message.trim() ? COLORS.accentPrimary : COLORS.border,
            color: motif && message.trim() ? COLORS.background : COLORS.textMuted,
          }}
        >
          <Send size={16} /> {envoiEnCours ? "Envoi..." : "Envoyer à l'équipe"}
        </button>
        {erreur && <p className="text-xs" style={{ color: "#B23A2E" }}>{erreur}</p>}
      </main>
    </div>
  );
}
