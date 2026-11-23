"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const fmt = (n) => Number(n || 0).toLocaleString("fr-FR");
const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const libelleMois = (ym) => {
  const [a, m] = ym.split("-");
  return `${MOIS_COURTS[Number(m) - 1]} ${String(a).slice(2)}`;
};
const moisSuivant = (ym, k) => {
  const [a, m] = ym.split("-").map(Number);
  const d = new Date(a, m - 1 + k, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Régression linéaire simple (moindres carrés) sur les points (0..n-1).
function tendance(valeurs, horizon = 3) {
  const n = valeurs.length;
  if (n < 2) return { prevus: Array(horizon).fill(valeurs[0] || 0), pente: 0 };
  const moyX = (n - 1) / 2;
  const moyY = valeurs.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  valeurs.forEach((y, x) => { num += (x - moyX) * (y - moyY); den += (x - moyX) ** 2; });
  const pente = den === 0 ? 0 : num / den;
  const origine = moyY - pente * moyX;
  const prevus = Array.from({ length: horizon }, (_, k) => Math.max(0, Math.round(origine + pente * (n + k))));
  return { prevus, pente };
}

function Barres({ COLORS, titre, mois, valeurs, prevus, unite }) {
  const tout = [...valeurs, ...prevus];
  const max = Math.max(1, ...tout);
  return (
    <div className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
      <p className="text-xs font-semibold mb-2">{titre}</p>
      <div className="flex items-end gap-1" style={{ height: 90 }}>
        {tout.map((v, i) => {
          const estPrevu = i >= valeurs.length;
          return (
            <div key={i} className="flex-1 flex flex-col justify-end items-center" style={{ height: "100%" }} title={`${libelleMois(mois[i])} : ${fmt(v)} ${unite}${estPrevu ? " (prévision)" : ""}`}>
              <div
                style={{
                  width: "100%",
                  height: `${Math.max(2, (v / max) * 100)}%`,
                  background: estPrevu ? "transparent" : COLORS.accentPrimary,
                  border: estPrevu ? `1px dashed ${COLORS.accentSecondary}` : "none",
                  borderRadius: 3,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 mt-1">
        {mois.map((m, i) => (
          <span key={m} className="flex-1 text-center" style={{ fontSize: 8, color: i >= valeurs.length ? COLORS.accentSecondary : COLORS.textMuted }}>
            {libelleMois(m).split(" ")[0]}
          </span>
        ))}
      </div>
      <p className="text-[10px] mt-1" style={{ color: COLORS.textMuted }}>
        Prévision (pointillés) : {prevus.map((v) => fmt(v)).join(" · ")} {unite}
      </p>
    </div>
  );
}

function Liste({ COLORS, titre, lignes }) {
  const max = Math.max(1, ...lignes.map((l) => l.valeur));
  return (
    <div className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
      <p className="text-xs font-semibold mb-2">{titre}</p>
      {lignes.length === 0 && <p className="text-[11px]" style={{ color: COLORS.textMuted }}>Pas encore de données.</p>}
      {lignes.map((l) => (
        <div key={l.nom} className="mb-1.5">
          <div className="flex justify-between text-[11px]"><span>{l.nom}</span><span style={{ color: COLORS.textMuted }}>{fmt(l.valeur)}</span></div>
          <div style={{ height: 4, background: COLORS.background, borderRadius: 2 }}>
            <div style={{ height: 4, width: `${(l.valeur / max) * 100}%`, background: COLORS.accentSecondary, borderRadius: 2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/*
  Onglet "Analyses" — rôle DATA. Lecture seule, chiffres AGRÉGÉS uniquement
  (fonction SQL stats_data : aucun nom, email, téléphone ni solde individuel).
  Les prévisions sont une simple tendance linéaire sur les 12 derniers mois :
  une aide à la décision, pas une garantie.
*/
export default function AdminAnalyses({ COLORS }) {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState(null);

  const charger = async () => {
    setErreur(null);
    const { data, error } = await supabase.rpc("stats_data");
    if (error) {
      setErreur(`Impossible de charger les analyses : ${error.message || "erreur inconnue"}. Si le message parle d'une colonne ou d'une fonction, exécute migration_fix_stats_data.sql dans Supabase.`);
      return;
    }
    setDonnees(data);
  };
  useEffect(() => { charger(); }, []);

  const calc = useMemo(() => {
    if (!donnees?.mensuel) return null;
    const mois = donnees.mensuel.map((m) => m.mois);
    const serie = (cle) => donnees.mensuel.map((m) => Number(m[cle] || 0));
    const mp = [1, 2, 3].map((k) => moisSuivant(mois[mois.length - 1], k));
    const moisAvecActivite = donnees.mensuel.filter((m) => Number(m.commandes) > 0 || Number(m.inscriptions) > 0).length;
    return {
      moisTous: [...mois, ...mp],
      ca: { v: serie("ca"), p: tendance(serie("ca")).prevus, pente: tendance(serie("ca")).pente },
      commandes: { v: serie("commandes"), p: tendance(serie("commandes")).prevus },
      inscriptions: { v: serie("inscriptions"), p: tendance(serie("inscriptions")).prevus },
      moisAvecActivite,
    };
  }, [donnees]);

  const carte = { background: COLORS.surface, border: `1px solid ${COLORS.border}` };
  if (erreur) return <p className="text-xs" style={{ color: "#B23A2E" }}>{erreur}</p>;
  if (!donnees || !calc) return <p className="text-sm text-center py-10" style={{ color: COLORS.textMuted }}>Chargement des analyses…</p>;
  const t = donnees.totaux;

  const cartes = [
    ["Utilisateurs", fmt(t.utilisateurs)],
    ["Vendeurs validés", fmt(t.vendeurs_valides)],
    ["Commandes", fmt(t.commandes)],
    ["Livrées", fmt(t.commandes_livrees)],
    ["CA livré (FCFA)", fmt(t.ca_livre)],
    ["Commissions (FCFA)", fmt(t.commissions)],
    ["Fonds en séquestre", fmt(t.fonds_sequestres)],
    ["Fonds en portefeuilles", fmt(t.fonds_wallets)],
  ];

  return (
    <>
      <p className="text-[11px]" style={{ color: COLORS.textMuted }}>
        Vue d'ensemble en lecture seule — chiffres agrégés, aucune donnée personnelle. Généré le {new Date(donnees.genere_le).toLocaleString("fr-FR")}.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {cartes.map(([libelle, valeur]) => (
          <div key={libelle} className="rounded-xl p-3" style={carte}>
            <p className="text-[10px]" style={{ color: COLORS.textMuted }}>{libelle}</p>
            <p className="text-base font-bold" style={{ color: COLORS.accentPrimary }}>{valeur}</p>
          </div>
        ))}
      </div>

      {calc.moisAvecActivite < 4 && (
        <p className="text-[11px] rounded-lg p-2" style={{ background: COLORS.surface, border: `1px dashed ${COLORS.accentSecondary}`, color: COLORS.accentSecondary }}>
          Historique encore court ({calc.moisAvecActivite} mois d'activité) : les prévisions ci-dessous sont peu fiables.
        </p>
      )}

      <Barres COLORS={COLORS} titre="Chiffre d'affaires livré par mois" mois={calc.moisTous} valeurs={calc.ca.v} prevus={calc.ca.p} unite="FCFA" />
      <Barres COLORS={COLORS} titre="Commandes par mois" mois={calc.moisTous} valeurs={calc.commandes.v} prevus={calc.commandes.p} unite="commandes" />
      <Barres COLORS={COLORS} titre="Nouvelles inscriptions par mois" mois={calc.moisTous} valeurs={calc.inscriptions.v} prevus={calc.inscriptions.p} unite="inscrits" />

      <Liste COLORS={COLORS} titre="Utilisateurs par pays (top 10)" lignes={(donnees.par_pays || []).map((l) => ({ nom: l.pays, valeur: Number(l.utilisateurs) }))} />
      <Liste COLORS={COLORS} titre="Catégories les plus commandées" lignes={(donnees.par_categorie || []).map((l) => ({ nom: String(l.categorie || "").replace("_", " "), valeur: Number(l.commandes) }))} />
      <Liste COLORS={COLORS} titre="Commandes par statut" lignes={(donnees.par_statut || []).map((l) => ({ nom: l.statut, valeur: Number(l.commandes) }))} />

      <p className="text-[10px]" style={{ color: COLORS.textMuted }}>
        Méthode : tendance linéaire (moindres carrés) sur 12 mois, projetée sur 3 mois. Elle ignore la saisonnalité, les promotions et les événements ponctuels.
      </p>
      <button onClick={charger} className="text-[11px] font-semibold self-start" style={{ color: COLORS.accentPrimary }}>Actualiser</button>
    </>
  );
}
