"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Power, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabase";
import ConfirmationPIN from "./ConfirmationPIN";

/*
  Onglet « Maintenance » de la Salle de surveillance : arrêt d'urgence de TEKÇA.
  Activé : tous les utilisateurs voient la page de maintenance, aucune
  opération d'argent ne passe (seule la notification de paiement du prestataire
  reste ouverte, pour créditer les paiements déjà faits). L'équipe garde l'accès.
  Plan B si cet écran est inaccessible : voir migration_maintenance.sql.
*/
async function appel(methode, corps) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch("/api/admin/maintenance", {
    method: methode,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: methode === "PUT" ? JSON.stringify(corps) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Action refusée.");
  return d;
}

export default function AdminMaintenance({ COLORS, theme }) {
  const [etat, setEtat] = useState(null);
  const [message, setMessage] = useState("");
  const [enAttente, setEnAttente] = useState(null); // true = activer, false = désactiver
  const [erreur, setErreur] = useState(null);
  const [info, setInfo] = useState(null);

  const charger = useCallback(async () => {
    try {
      const d = await appel("GET");
      setEtat(d);
      setMessage(d.message || "");
    } catch (e) {
      setErreur(e.message);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const appliquer = async (pin) => {
    const actif = enAttente;
    setEnAttente(null);
    setErreur(null);
    setInfo(null);
    try {
      await appel("PUT", { actif, message, pin });
      setInfo(actif ? "TEKÇA est arrêté. Les utilisateurs voient la page de maintenance." : "TEKÇA est remis en service.");
      charger();
    } catch (e) {
      setErreur(e.message);
    }
  };

  const actif = !!etat?.actif;
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: COLORS.surface, border: `2px solid ${actif ? "#B23A2E" : COLORS.border}` }}>
        <div className="flex items-center gap-3">
          <Power size={22} color={actif ? "#B23A2E" : "#3A8A5C"} />
          <div>
            <p className="text-sm font-bold">{etat === null ? "Chargement…" : actif ? "TEKÇA est ARRÊTÉ (maintenance)" : "TEKÇA est en service"}</p>
            {actif && etat.activeDepuis && (
              <p className="text-[11px]" style={{ color: COLORS.textMuted }}>
                Depuis le {new Date(etat.activeDepuis).toLocaleString("fr-FR")}{etat.activePar ? ` · par ${etat.activePar}` : ""}
              </p>
            )}
          </div>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Message affiché aux utilisateurs (facultatif), par ex. : Retour prévu vers 18 h."
          className="rounded-lg px-3 py-2 text-xs"
          style={{ background: COLORS.background, border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary }}
        />
        <button
          onClick={() => setEnAttente(!actif)}
          disabled={etat === null}
          className="rounded-xl py-3 text-sm font-bold"
          style={{ background: actif ? "#3A8A5C" : "#B23A2E", color: "#FFFFFF", opacity: etat === null ? 0.6 : 1 }}
        >
          {actif ? "Remettre TEKÇA en service" : "Arrêter tout TEKÇA"}
        </button>
        {info && <p className="text-[11px] font-semibold" style={{ color: COLORS.accentSecondary }}>{info}</p>}
        {erreur && <p className="text-[11px] font-semibold" style={{ color: "#B23A2E" }}>{erreur}</p>}
      </div>

      <div className="rounded-xl p-3 flex flex-col gap-1" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <p className="text-xs font-bold flex items-center gap-1"><AlertTriangle size={13} color={COLORS.accentSecondary} /> À savoir</p>
        <p className="text-[11px]" style={{ color: COLORS.textMuted }}>• Les pages et les opérations d'argent (recharge, retrait, transfert, commandes) sont bloquées pour tous, sauf pour l'équipe.</p>
        <p className="text-[11px]" style={{ color: COLORS.textMuted }}>• Les paiements déjà effectués chez le prestataire continuent d'être crédités.</p>
        <p className="text-[11px]" style={{ color: COLORS.textMuted }}>• Cet arrêt ne coupe pas l'accès direct à Supabase : en cas d'attaque sur la base, coupe aussi les clés ou mets le projet en pause dans Supabase.</p>
        <p className="text-[11px]" style={{ color: COLORS.textMuted }}>• Plan B si cet écran est inaccessible : la ligne SQL est dans le fichier migration_maintenance.sql.</p>
      </div>

      <ConfirmationPIN
        obligatoire
        ouvert={enAttente !== null}
        theme={theme}
        titre={enAttente ? "Confirme : ARRÊTER tout TEKÇA" : "Confirme : remettre en service"}
        onAnnuler={() => setEnAttente(null)}
        onSuccess={appliquer}
      />
    </div>
  );
}
