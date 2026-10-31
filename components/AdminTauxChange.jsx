"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import ConfirmationPIN from "./ConfirmationPIN";

/*
  Onglet « Taux de change » de la Salle de surveillance : l'équipe saisit à
  la main combien d'unités de chaque devise valent 1 000 FCFA. Tant qu'un
  taux manque, les recharges et retraits des pays concernés sont refusés.
*/
async function appel(methode, corps) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch("/api/admin/taux-change", {
    method: methode,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: methode === "PUT" ? JSON.stringify(corps) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Action refusée.");
  return d;
}

export default function AdminTauxChange({ COLORS, theme }) {
  const [donnees, setDonnees] = useState(null);
  const [saisies, setSaisies] = useState({});
  const [enAttente, setEnAttente] = useState(null);
  const [message, setMessage] = useState(null);
  const [erreur, setErreur] = useState(null);

  const charger = useCallback(async () => {
    try {
      const d = await appel("GET");
      setDonnees(d);
      setSaisies(Object.fromEntries(d.devises.map((x) => [x.devise, x.taux ?? ""])));
    } catch (e) {
      setErreur(e.message);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const enregistrer = async (pin) => {
    const devise = enAttente;
    setEnAttente(null);
    setErreur(null);
    setMessage(null);
    try {
      await appel("PUT", { devise, unitesPour1000Fcfa: saisies[devise], pin });
      setMessage(`Taux ${devise} enregistré.`);
      charger();
    } catch (e) {
      setErreur(e.message);
    }
  };

  const carte = { background: COLORS.surface, border: `1px solid ${COLORS.border}` };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px]" style={{ color: COLORS.textMuted }}>
        Combien d'unités de la devise valent <b>1 000 FCFA</b> ? Les prix restent en FCFA ; ce taux sert à calculer le montant envoyé au prestataire de paiement. Marge appliquée automatiquement : {donnees?.margePourcent ?? 2} % (plus à la recharge, moins au retrait). Sans taux, les opérations du pays sont refusées.
      </p>
      {message && <p className="text-[11px] font-semibold" style={{ color: COLORS.accentSecondary }}>{message}</p>}
      {erreur && <p className="text-[11px] font-semibold" style={{ color: "#B23A2E" }}>{erreur}</p>}
      {!donnees && !erreur && <p className="text-xs" style={{ color: COLORS.textMuted }}>Chargement…</p>}
      {donnees?.devises.map((d) => (
        <div key={d.devise} className="rounded-xl p-3 flex flex-col gap-2" style={carte}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">{d.devise} <span className="text-[11px] font-normal" style={{ color: COLORS.textMuted }}>({d.pays.join(", ")})</span></p>
            {d.taux === null
              ? <span className="text-[10px] font-bold" style={{ color: "#B23A2E" }}>Aucun taux — opérations refusées</span>
              : <span className="text-[10px]" style={{ color: COLORS.textMuted }}>Mis à jour le {new Date(d.dateMaj).toLocaleDateString("fr-FR")}</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] whitespace-nowrap">1 000 FCFA =</span>
            <input
              type="number"
              step="any"
              value={saisies[d.devise] ?? ""}
              onChange={(e) => setSaisies((s) => ({ ...s, [d.devise]: e.target.value }))}
              className="flex-1 rounded-lg px-2 py-1.5 text-sm"
              style={{ background: COLORS.background, border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary }}
            />
            <span className="text-[11px]">{d.devise}</span>
            <button
              onClick={() => setEnAttente(d.devise)}
              disabled={!saisies[d.devise] || Number(saisies[d.devise]) <= 0}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: COLORS.accentPrimary, color: COLORS.background, opacity: !saisies[d.devise] || Number(saisies[d.devise]) <= 0 ? 0.5 : 1 }}
            >
              Enregistrer
            </button>
          </div>
        </div>
      ))}
      <ConfirmationPIN obligatoire ouvert={!!enAttente} theme={theme} titre={enAttente ? `Confirme : taux ${enAttente}` : null} onAnnuler={() => setEnAttente(null)} onSuccess={enregistrer} />
    </div>
  );
}
