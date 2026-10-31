"use client";

import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, Lock, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabase";
import ConfirmationPIN from "./ConfirmationPIN";

/*
  Onglet "Séquestres" de la Salle de surveillance : l'équipe voit l'argent
  encore bloqué et décide à la main de le libérer au vendeur ou de
  rembourser l'acheteur. Toute la logique et les contrôles (rôle admin,
  PIN, verrou anti-double-traitement) sont dans /api/admin/sequestres.
*/
async function appel(methode, corps) {
  const { data: { session } } = await supabase.auth.getSession();
  const reponse = await fetch("/api/admin/sequestres", {
    method: methode,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: methode === "POST" ? JSON.stringify(corps) : undefined,
  });
  const data = await reponse.json();
  if (!reponse.ok) throw new Error(data.error || "Action refusée.");
  return data;
}

const fcfa = (n) => `${Number(n || 0).toLocaleString("fr-FR")} FCFA`;
const dateCourte = (d) => (d ? new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—");

export default function AdminSequestres({ COLORS, theme }) {
  const [liste, setListe] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [notes, setNotes] = useState({});
  const [enAttente, setEnAttente] = useState(null); // { sequestre, action }
  const [enCours, setEnCours] = useState(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const data = await appel("GET");
      setListe(data.sequestres || []);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const executer = async (pin) => {
    const { sequestre, action } = enAttente;
    setEnAttente(null);
    setEnCours(sequestre.id);
    setErreur(null);
    setMessage(null);
    try {
      await appel("POST", { sequestreId: sequestre.id, action, pin, note: notes[sequestre.id] || "" });
      setListe((l) => l.filter((s) => s.id !== sequestre.id));
      setMessage(action === "liberer" ? "Paiement libéré au vendeur." : "Acheteur remboursé.");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  };

  const carte = { background: COLORS.surface, border: `1px solid ${COLORS.border}` };
  const maintenant = Date.now();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold" style={{ color: COLORS.textMuted }}>
          {liste.length} séquestre(s) bloqué(s) · {fcfa(liste.reduce((s, x) => s + x.montantProduit + x.fraisProtection, 0))}
        </p>
        <button onClick={charger} className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: COLORS.accentPrimary }}>
          <RefreshCw size={12} /> Actualiser
        </button>
      </div>

      {message && <p className="text-[11px] font-semibold" style={{ color: COLORS.accentSecondary }}>{message}</p>}
      {erreur && <p className="text-[11px] font-semibold" style={{ color: "#B23A2E" }}>{erreur}</p>}
      {chargement && <p className="text-xs" style={{ color: COLORS.textMuted }}>Chargement…</p>}
      {!chargement && liste.length === 0 && !erreur && (
        <p className="text-xs" style={{ color: COLORS.textMuted }}>Aucun séquestre en attente.</p>
      )}

      {liste.map((s) => {
        const depasse = s.dateLimite && new Date(s.dateLimite).getTime() < maintenant;
        return (
          <div key={s.id} className="rounded-xl p-3 flex flex-col gap-2" style={carte}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold">{s.produit}{s.quantite > 1 ? ` ×${s.quantite}` : ""}</p>
                <p className="text-[11px]" style={{ color: COLORS.textMuted }}>Acheteur : {s.acheteur} · Vendeur : {s.vendeur}</p>
                <p className="text-[11px]" style={{ color: COLORS.textMuted }}>Payé le {dateCourte(s.datePaiement)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {s.statut === "litige" && (
                  <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: "#B23A2E" }}><AlertTriangle size={11} /> Litige</span>
                )}
                {depasse && <span className="text-[10px] font-bold" style={{ color: COLORS.accentSecondary }}>Délai 48 h dépassé</span>}
                {s.codeLivraison?.bloque && (
                  <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: "#B23A2E" }}><Lock size={11} /> Code bloqué</span>
                )}
              </div>
            </div>

            <div className="text-[11px] grid grid-cols-2 gap-x-3 gap-y-0.5" style={{ color: COLORS.textMuted }}>
              <span>Payé par l'acheteur</span><span className="text-right font-semibold" style={{ color: COLORS.textPrimary }}>{fcfa(s.montantTotal)}</span>
              <span>Dont frais de protection</span><span className="text-right">{fcfa(s.fraisProtection)}</span>
              <span>Commission TEKÇA</span><span className="text-right">{fcfa(s.commission)}</span>
              <span>Reçu par le vendeur si libéré</span><span className="text-right font-semibold" style={{ color: COLORS.textPrimary }}>{fcfa(s.netVendeur)}</span>
            </div>

            <input
              value={notes[s.id] || ""}
              onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
              placeholder="Note interne (facultatif) : raison de la décision"
              maxLength={300}
              className="rounded-lg px-2 py-1.5 text-xs"
              style={{ background: COLORS.background, border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary }}
            />
            <div className="flex gap-2">
              <button
                disabled={enCours === s.id}
                onClick={() => setEnAttente({ sequestre: s, action: "liberer" })}
                className="flex-1 text-[11px] font-semibold py-2 rounded-lg"
                style={{ background: COLORS.accentPrimary, color: COLORS.background }}
              >
                {enCours === s.id ? "…" : "Libérer au vendeur"}
              </button>
              <button
                disabled={enCours === s.id}
                onClick={() => setEnAttente({ sequestre: s, action: "rembourser" })}
                className="flex-1 text-[11px] font-semibold py-2 rounded-lg"
                style={{ background: "transparent", color: "#B23A2E", border: "1px solid #B23A2E" }}
              >
                Rembourser l'acheteur
              </button>
            </div>
          </div>
        );
      })}

      <ConfirmationPIN
        ouvert={!!enAttente}
        theme={theme}
        titre={enAttente?.action === "liberer" ? "Confirme : libérer au vendeur" : "Confirme : rembourser l'acheteur"}
        onAnnuler={() => setEnAttente(null)}
        onSuccess={executer}
      />
    </div>
  );
}
