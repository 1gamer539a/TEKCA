"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

const OPTIONS = [
  { valeur: "bouche_a_oreille", label: "Bouche-à-oreille / Recommandation d'un ami" },
  { valeur: "reseaux_sociaux", label: "Réseaux sociaux (TikTok, Facebook, Instagram, WhatsApp)" },
  { valeur: "recherche_google", label: "Recherche Google" },
  { valeur: "evenement", label: "Événement / Salon (ex: JIBC 2026)" },
  { valeur: "autre", label: "Autre" },
];

/*
  Enquête "comment as-tu connu TEKÇA ?" — voir
  migration_attributions_feedback.sql (table user_attributions).

  Se remonte à CHAQUE connexion tant que l'utilisateur n'a jamais
  répondu (vérifié via une lecture de user_attributions à chaque
  montage, pas juste une fois en session) : dès qu'une ligne existe
  pour cet utilisateur, le modal ne réapparaît plus jamais — aucune
  policy update/delete n'existe sur cette table, la réponse est
  définitive.

  Monté une seule fois dans LayoutRacine.jsx, comme BoutonIAFlottant.
*/
export default function EnqueteAttribution({ theme = "clair" }) {
  const COLORS = THEMES[theme] || THEMES.clair;
  const [visible, setVisible] = useState(false);
  const [userId, setUserId] = useState(null);
  const [choix, setChoix] = useState(null);
  const [details, setDetails] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    const verifier = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: reponseExistante } = await supabase
        .from("user_attributions")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      if (!reponseExistante || reponseExistante.length === 0) {
        setUserId(user.id);
        setVisible(true);
      }
    };
    verifier();
  }, []);

  if (!visible) return null;

  const valider = async () => {
    if (!choix) return;
    setEnvoiEnCours(true);
    setErreur(null);
    const { error } = await supabase.from("user_attributions").insert({
      user_id: userId,
      channel: choix,
      details: choix === "autre" ? details.trim() || null : null,
    });
    setEnvoiEnCours(false);
    if (error) {
      setErreur("Impossible d'enregistrer ta réponse, réessaie.");
      return;
    }
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 flex flex-col" style={{ background: COLORS.background, color: COLORS.textPrimary }}>
        <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <Sparkles size={19} color={COLORS.accentPrimary} />
        </div>

        <p className="text-base font-bold mb-1">Bienvenue sur TEKÇA ! 👋</p>
        <p className="text-xs mb-4" style={{ color: COLORS.textMuted }}>
          Aidez-nous à améliorer la plateforme : comment avez-vous connu TEKÇA ?
        </p>

        <div className="flex flex-col gap-2 mb-3">
          {OPTIONS.map((o) => (
            <button
              key={o.valeur}
              onClick={() => setChoix(o.valeur)}
              className="text-left rounded-xl px-3 py-2.5 text-xs font-medium flex items-center gap-2"
              style={{
                background: choix === o.valeur ? COLORS.accentPrimary + "22" : COLORS.surface,
                border: `1.5px solid ${choix === o.valeur ? COLORS.accentPrimary : COLORS.border}`,
                color: COLORS.textPrimary,
              }}
            >
              <span
                className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
                style={{ border: `2px solid ${choix === o.valeur ? COLORS.accentPrimary : COLORS.border}` }}
              >
                {choix === o.valeur && <span className="w-2 h-2 rounded-full" style={{ background: COLORS.accentPrimary }} />}
              </span>
              {o.label}
            </button>
          ))}
        </div>

        {choix === "autre" && (
          <input
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Précisez comment vous nous avez découvert..."
            className="rounded-lg px-3 py-2.5 text-xs outline-none mb-3"
            style={{ background: COLORS.surface, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
          />
        )}

        {erreur && <p className="text-xs mb-2" style={{ color: "#B23A2E" }}>{erreur}</p>}

        <button
          onClick={valider}
          disabled={!choix || envoiEnCours}
          className="w-full h-12 rounded-full font-semibold text-sm flex items-center justify-center gap-2"
          style={{
            background: choix ? COLORS.accentPrimary : COLORS.surface,
            color: choix ? COLORS.background : COLORS.textMuted,
          }}
        >
          {envoiEnCours ? <Loader2 size={16} className="animate-spin" /> : "Valider et continuer"}
        </button>
      </div>
    </div>
  );
}
