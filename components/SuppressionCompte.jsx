"use client";

import React, { useState, useEffect } from "react";
import { X, Trash2, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../lib/i18n/LanguageContext";

/*
  Fenêtre « Supprimer mon compte » : vérifie d'abord ce qui bloque
  (solde, commandes en cours), puis demande le mot de passe (ou le PIN
  pour les comptes sans mot de passe) avant d'appeler
  /api/compte/supprimer. Voir cette route pour ce que la suppression fait.
*/
export default function SuppressionCompte({ ouvert, onFermer, COLORS }) {
  const { t } = useLanguage();
  const [etat, setEtat] = useState({ chargement: true, methode: "motdepasse", blocages: [] });
  const [secret, setSecret] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  const entetes = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` };
  };

  useEffect(() => {
    if (!ouvert) return;
    setSecret("");
    setErreur(null);
    setEtat({ chargement: true, methode: "motdepasse", blocages: [] });
    (async () => {
      try {
        const r = await fetch("/api/compte/supprimer", { headers: await entetes() });
        const d = await r.json();
        setEtat({ chargement: false, methode: d.methode || "motdepasse", blocages: d.blocages || [] });
      } catch {
        setEtat({ chargement: false, methode: "motdepasse", blocages: [] });
      }
    })();
  }, [ouvert]);

  if (!ouvert) return null;

  const supprimer = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      const corps = etat.methode === "motdepasse" ? { motDePasse: secret } : { pin: secret };
      const r = await fetch("/api/compte/supprimer", { method: "POST", headers: await entetes(), body: JSON.stringify(corps) });
      const d = await r.json();
      if (!r.ok) {
        if (d.blocages?.length) setEtat((e) => ({ ...e, blocages: d.blocages }));
        setErreur(d.error || t("suppression.erreur"));
        return;
      }
      await supabase.auth.signOut().catch(() => {});
      window.location.href = "/";
    } catch {
      setErreur(t("suppression.erreur"));
    } finally {
      setEnCours(false);
    }
  };

  const MESSAGES = {
    solde: t("suppression.blocageSolde"),
    commandes_acheteur: t("suppression.blocageAcheteur"),
    commandes_vendeur: t("suppression.blocageVendeur"),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-3" style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}>
        <div className="flex items-center justify-between">
          <p className="font-bold flex items-center gap-2" style={{ color: "#B23A2E" }}><Trash2 size={18} /> {t("suppression.titre")}</p>
          <button onClick={onFermer} aria-label={t("suppression.annuler")}><X size={20} color={COLORS.textMuted} /></button>
        </div>
        <p className="text-xs" style={{ color: COLORS.textMuted }}>{t("suppression.avertissement")}</p>

        {etat.chargement && <p className="text-xs" style={{ color: COLORS.textMuted }}>{t("suppression.chargement")}</p>}

        {!etat.chargement && etat.blocages.length > 0 && (
          <div className="rounded-xl p-3 flex flex-col gap-1" style={{ border: "1px solid #B23A2E" }}>
            {etat.blocages.map((b) => <p key={b} className="text-xs font-semibold" style={{ color: "#B23A2E" }}>• {MESSAGES[b] || b}</p>)}
          </div>
        )}

        {!etat.chargement && etat.blocages.length === 0 && (
          <>
            <input
              type="password"
              inputMode={etat.methode === "pin" ? "numeric" : "text"}
              autoComplete="current-password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={etat.methode === "motdepasse" ? t("suppression.motDePasse") : t("suppression.codePin")}
              className="rounded-lg px-3 py-2 text-sm"
              style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary }}
            />
            {erreur && <p className="text-xs font-semibold" style={{ color: "#B23A2E" }}>{erreur}</p>}
            <button
              onClick={supprimer}
              disabled={enCours || !secret}
              className="rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
              style={{ background: "#B23A2E", color: "#FFFFFF", opacity: enCours || !secret ? 0.6 : 1 }}
            >
              {enCours ? <><Loader2 size={16} className="animate-spin" /> {t("suppression.enCours")}</> : t("suppression.confirmer")}
            </button>
          </>
        )}
        <button onClick={onFermer} className="text-xs font-semibold py-1" style={{ color: COLORS.textMuted }}>{t("suppression.annuler")}</button>
      </div>
    </div>
  );
}
