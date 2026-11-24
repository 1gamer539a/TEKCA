"use client";

import React, { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../lib/i18n/LanguageContext";

const TYPES = [
  { valeur: "suggestion", cle: "typeSuggestion" },
  { valeur: "amelioration", cle: "typeAmelioration" },
  { valeur: "bug", cle: "typeBug" },
  { valeur: "autre", cle: "typeAutre" },
];

const PRIORITES = [
  { valeur: "faible", cle: "prioriteFaible", sousCle: "prioriteFaibleDesc" },
  { valeur: "moyen", cle: "prioriteMoyen", sousCle: "prioriteMoyenDesc" },
  { valeur: "eleve", cle: "prioriteEleve", sousCle: "prioriteEleveDesc" },
];

/*
  Formulaire de retour utilisateur — voir
  migration_attributions_feedback.sql (table user_feedbacks).
  Utilisé à la fois par FeedbackModal.jsx (bouton flottant) et
  app/feedback/page.jsx (page dédiée) pour ne pas dupliquer la
  logique d'envoi.
*/
export default function FormulaireFeedback({ COLORS, onEnvoye }) {
  const { t } = useLanguage();
  const [type, setType] = useState(null);
  const [priorite, setPriorite] = useState("moyen");
  const [message, setMessage] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [envoye, setEnvoye] = useState(false);

  const envoyer = async () => {
    if (!type || !message.trim()) return;
    setEnvoiEnCours(true);
    setErreur(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setErreur(t("feedback.connecteToiAvis"));
      setEnvoiEnCours(false);
      return;
    }

    const { error } = await supabase.from("user_feedbacks").insert({
      user_id: user.id,
      type,
      priority: priorite,
      message: message.trim(),
    });
    setEnvoiEnCours(false);
    if (error) {
      setErreur(t("feedback.impossibleEnvoyerAvis"));
      return;
    }
    setEnvoye(true);
    if (onEnvoye) setTimeout(onEnvoye, 1200);
  };

  if (envoye) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: COLORS.accentPrimary }}>
          <Check size={22} color={COLORS.background} />
        </div>
        <p className="text-sm font-semibold">{t("feedback.merciRetour")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-base font-bold mb-1">{t("feedback.donnezAvisTitre")}</p>
        <p className="text-xs" style={{ color: COLORS.textMuted }}>
          {t("feedback.avisDesc")}
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold mb-2">{t("feedback.typeDeRetour")}</p>
        <div className="flex flex-col gap-2">
          {TYPES.map((item) => (
            <button
              key={item.valeur}
              onClick={() => setType(item.valeur)}
              className="text-left rounded-xl px-3 py-2.5 text-xs font-medium"
              style={{
                background: type === item.valeur ? COLORS.accentPrimary + "22" : COLORS.surface,
                border: `1.5px solid ${type === item.valeur ? COLORS.accentPrimary : COLORS.border}`,
                color: COLORS.textPrimary,
              }}
            >
              {t(`feedback.${item.cle}`)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold mb-2">{t("feedback.niveauPriorite")}</p>
        <div className="flex gap-2">
          {PRIORITES.map((p) => (
            <button
              key={p.valeur}
              onClick={() => setPriorite(p.valeur)}
              className="flex-1 rounded-xl py-2 px-1 text-center"
              style={{
                background: priorite === p.valeur ? COLORS.accentPrimary + "22" : COLORS.surface,
                border: `1.5px solid ${priorite === p.valeur ? COLORS.accentPrimary : COLORS.border}`,
              }}
            >
              <p className="text-xs font-semibold" style={{ color: COLORS.textPrimary }}>{t(`feedback.${p.cle}`)}</p>
              <p className="text-[10px]" style={{ color: COLORS.textMuted }}>{t(`feedback.${p.sousCle}`)}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold mb-2">{t("feedback.messageLabel")}</p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("feedback.decrivezIdeePlaceholder")}
          rows={4}
          className="w-full rounded-lg px-3 py-2.5 text-xs outline-none resize-none"
          style={{ background: COLORS.surface, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
        />
      </div>

      {erreur && <p className="text-xs" style={{ color: "#B23A2E" }}>{erreur}</p>}

      <button
        onClick={envoyer}
        disabled={!type || !message.trim() || envoiEnCours}
        className="w-full h-12 rounded-full font-semibold text-sm flex items-center justify-center gap-2"
        style={{
          background: type && message.trim() ? COLORS.accentPrimary : COLORS.surface,
          color: type && message.trim() ? COLORS.background : COLORS.textMuted,
        }}
      >
        {envoiEnCours ? <Loader2 size={16} className="animate-spin" /> : t("feedback.envoyerMonAvis")}
      </button>
    </div>
  );
}
