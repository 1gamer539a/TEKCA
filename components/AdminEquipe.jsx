"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { PERMISSIONS, POSTES } from "../lib/permissions";

async function appel(methode, corps) {
  const { data: { session } } = await supabase.auth.getSession();
  const reponse = await fetch("/api/admin/equipe", {
    method: methode,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: methode === "GET" ? undefined : JSON.stringify(corps),
  });
  const data = await reponse.json();
  if (!reponse.ok) throw new Error(data.error || "Action refusée.");
  return data;
}

/*
  Onglet "Équipe" — visible UNIQUEMENT par l'admin principal. Il choisit
  l'email d'un compte TEKÇA existant et les domaines qu'il peut voir ;
  tout le reste reste invisible (interface) ET inaccessible (serveur + base).
*/
export default function AdminEquipe({ COLORS }) {
  const [membres, setMembres] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [email, setEmail] = useState("");
  const [poste, setPoste] = useState("relation_client");
  const [permissions, setPermissions] = useState(POSTES.relation_client.permissions);
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [journal, setJournal] = useState([]);

  const chargerJournal = async () => {
    const { data } = await supabase
      .from("journal_securite")
      .select("id, type, details, date_creation, users:user_id ( nom )")
      .in("type", ["equipe_attribution", "equipe_revocation"])
      .order("date_creation", { ascending: false })
      .limit(100);
    setJournal(data || []);
  };

  // Export CSV du journal des changements de rôles (à conserver : traçabilité).
  const exporterJournal = () => {
    const echapper = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lignes = [["Date", "Action", "Par", "Détails"].map(echapper).join(";")].concat(
      journal.map((j) =>
        [new Date(j.date_creation).toLocaleString("fr-FR"), j.type === "equipe_attribution" ? "Attribution" : "Retrait", j.users?.nom || "", j.details].map(echapper).join(";")
      )
    );
    const blob = new Blob(["\uFEFF" + lignes.join("\n")], { type: "text/csv;charset=utf-8" });
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(blob);
    lien.download = `journal-equipe-${new Date().toISOString().slice(0, 10)}.csv`;
    lien.click();
    URL.revokeObjectURL(lien.href);
  };

  const charger = async () => {
    try {
      const data = await appel("GET");
      setMembres(data.membres || []);
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    }
    setChargement(false);
  };
  useEffect(() => { charger(); chargerJournal(); }, []);

  const choisirPoste = (cle) => {
    setPoste(cle);
    if (cle !== "personnalise") setPermissions(POSTES[cle].permissions);
  };
  const basculer = (id) => {
    setPoste("personnalise");
    setPermissions((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const enregistrer = async () => {
    setMessage(null);
    setEnCours(true);
    try {
      const data = await appel("POST", { email, permissions, poste, pin });
      setMessage({ ok: true, texte: `${data.membre?.nom || data.membre?.email} : rôle enregistré.` });
      setEmail("");
      setPin("");
      await charger();
      await chargerJournal();
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    }
    setEnCours(false);
  };

  const retirer = async (m) => {
    if (!pin) { setMessage({ ok: false, texte: "Saisis ton code PIN en bas du formulaire pour confirmer." }); return; }
    if (!window.confirm(`Retirer l'accès équipe à ${m.nom || m.email} ?`)) return;
    setMessage(null);
    setEnCours(true);
    try {
      await appel("DELETE", { userId: m.id, pin });
      setPin("");
      setMessage({ ok: true, texte: "Accès retiré." });
      await charger();
      await chargerJournal();
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    }
    setEnCours(false);
  };

  const modifier = (m) => {
    setEmail(m.email || "");
    setPoste(m.poste && POSTES[m.poste] ? m.poste : "personnalise");
    setPermissions(m.permissions || []);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const carte = { background: COLORS.surface, border: `1px solid ${COLORS.border}` };
  const champ = { background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` };

  return (
    <>
      <p className="text-[11px]" style={{ color: COLORS.textMuted }}>
        Donne à un membre de l'équipe l'accès à un domaine précis. Il ne verra que les onglets de son rôle ; la
        vue d'ensemble et cet onglet te restent réservés. La personne doit déjà avoir un compte TEKÇA.
      </p>

      <div className="rounded-xl p-3 flex flex-col gap-2" style={carte}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email du compte TEKÇA"
          autoComplete="off"
          className="rounded-lg px-3 py-2 text-xs outline-none"
          style={champ}
        />
        <select value={poste} onChange={(e) => choisirPoste(e.target.value)} className="rounded-lg px-3 py-2 text-xs outline-none" style={champ}>
          {Object.entries(POSTES).map(([cle, p]) => (
            <option key={cle} value={cle}>{p.label}</option>
          ))}
        </select>
        <div className="flex flex-col gap-1.5">
          {PERMISSIONS.map((p) => (
            <label key={p.id} className="flex items-start gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={permissions.includes(p.id)} onChange={() => basculer(p.id)} className="mt-0.5" />
              <span>
                <span className="font-semibold">{p.label}</span>
                <span className="block text-[10px]" style={{ color: COLORS.textMuted }}>{p.description}</span>
              </span>
            </label>
          ))}
        </div>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Ton code PIN (confirmation)"
          autoComplete="off"
          className="rounded-lg px-3 py-2 text-xs outline-none"
          style={champ}
        />
        <button
          onClick={enregistrer}
          disabled={enCours || !email || permissions.length === 0 || !pin}
          className="rounded-lg py-2 text-xs font-semibold"
          style={{ background: COLORS.accentPrimary, color: "#fff", opacity: enCours || !email || permissions.length === 0 || !pin ? 0.5 : 1 }}
        >
          {enCours ? "Enregistrement…" : "Enregistrer le rôle"}
        </button>
        {message && (
          <p className="text-[11px]" style={{ color: message.ok ? "#3A8A5C" : "#B23A2E" }}>{message.texte}</p>
        )}
      </div>

      <p className="text-xs font-semibold mt-1">Membres de l'équipe ({membres.length})</p>
      {chargement && <p className="text-[11px]" style={{ color: COLORS.textMuted }}>Chargement…</p>}
      {!chargement && membres.length === 0 && (
        <p className="text-[11px]" style={{ color: COLORS.textMuted }}>Aucun membre pour l'instant.</p>
      )}
      {membres.map((m) => (
        <div key={m.id} className="rounded-xl p-3" style={carte}>
          <p className="text-sm font-semibold">{m.nom || "—"}</p>
          <p className="text-[11px]" style={{ color: COLORS.textMuted }}>{m.email}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {m.permissions.length === 0 && (
              <span className="text-[10px]" style={{ color: "#B23A2E" }}>Aucun domaine — aucun accès</span>
            )}
            {m.permissions.map((id) => (
              <span key={id} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: COLORS.background, border: `1px solid ${COLORS.border}`, color: COLORS.accentSecondary }}>
                {PERMISSIONS.find((p) => p.id === id)?.label || id}
              </span>
            ))}
          </div>
          <div className="flex gap-3 mt-2">
            <button onClick={() => modifier(m)} className="text-[11px] font-semibold" style={{ color: COLORS.accentPrimary }}>Modifier</button>
            <button onClick={() => retirer(m)} disabled={enCours} className="text-[11px] font-semibold" style={{ color: "#B23A2E" }}>Retirer l'accès</button>
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between mt-2">
        <p className="text-xs font-semibold">Historique des changements ({journal.length})</p>
        <button onClick={exporterJournal} disabled={journal.length === 0} className="text-[11px] font-semibold" style={{ color: COLORS.accentPrimary, opacity: journal.length === 0 ? 0.4 : 1 }}>
          Exporter en CSV
        </button>
      </div>
      {journal.length === 0 && <p className="text-[11px]" style={{ color: COLORS.textMuted }}>Aucun changement enregistré.</p>}
      {journal.slice(0, 15).map((j) => (
        <div key={j.id} className="rounded-lg px-3 py-2 text-[11px]" style={carte}>
          <span className="font-semibold">{j.type === "equipe_attribution" ? "Attribution" : "Retrait"}</span>
          <span style={{ color: COLORS.textMuted }}> · {new Date(j.date_creation).toLocaleString("fr-FR")}</span>
          <p style={{ color: COLORS.textMuted }}>{j.details}</p>
        </div>
      ))}
    </>
  );
}
