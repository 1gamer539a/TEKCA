"use client";

import React, { useState } from "react";
import { ShieldCheck, AlertTriangle, Copy, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

export default function CreationPseudo() {
  const router = useRouter();
  const COLORS = THEMES.clair;
  const [pseudo, setPseudo] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [resultat, setResultat] = useState(null); // { pseudo, identifiant } une fois créé
  const [copie, setCopie] = useState(false);

  const creer = async () => {
    setErreur(null);
    if (pseudo.length < 3) {
      setErreur("3 caractères minimum.");
      return;
    }
    setEnCours(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const reponse = await fetch("/api/identite/creer-pseudo", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ pseudo }),
      });
      const data = await reponse.json();
      if (!reponse.ok) throw new Error(data.error);
      setResultat({ pseudo: data.pseudo, identifiant: data.identifiant });
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  };

  const copier = () => {
    navigator.clipboard?.writeText(resultat.identifiant);
    setCopie(true);
    setTimeout(() => setCopie(false), 1500);
  };

  if (resultat) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: COLORS.background }}>
        <ShieldCheck size={48} color={COLORS.accentPrimary} />
        <h1 className="text-xl font-bold mt-4 text-center" style={{ color: COLORS.textPrimary }}>
          Ton identité TEKÇA est créée
        </h1>
        <p className="text-sm text-center mt-2" style={{ color: COLORS.textMuted }}>
          C'est avec cet identifiant que les autres t'enverront de l'argent — pas ton numéro de téléphone, qui reste privé.
        </p>

        <div className="w-full max-w-xs rounded-2xl p-5 mt-6 text-center" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Pseudo</p>
          <p className="text-lg font-bold" style={{ color: COLORS.textPrimary }}>@{resultat.pseudo}</p>
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${COLORS.border}` }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Identifiant TEKÇA</p>
            <div className="flex items-center justify-center gap-2 mt-1">
              <p className="text-2xl font-extrabold tracking-wider" style={{ color: COLORS.accentPrimary }}>{resultat.identifiant}</p>
              <button onClick={copier} aria-label="Copier">
                {copie ? <Check size={16} color={COLORS.accentPrimary} /> : <Copy size={16} color={COLORS.textMuted} />}
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => router.push("/")}
          className="w-full max-w-xs rounded-xl py-3 font-semibold mt-6"
          style={{ background: COLORS.accentPrimary, color: COLORS.background }}
        >
          C'est parti
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: COLORS.background }}>
      <h1 className="text-xl font-bold text-center" style={{ color: COLORS.textPrimary }}>
        Choisis ton pseudo TEKÇA
      </h1>
      <p className="text-sm text-center mt-2" style={{ color: COLORS.textMuted }}>
        Il servira, avec un identifiant unique généré juste après, à recevoir des transferts — sans jamais révéler ton numéro de téléphone.
      </p>

      <div
        className="w-full max-w-xs rounded-xl p-3 mt-5 flex items-start gap-2 text-xs"
        style={{ background: "rgba(178,58,46,0.1)", color: "#B23A2E" }}
      >
        <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
        <span>Ce pseudo est définitif. Il ne pourra jamais être modifié, même par le support.</span>
      </div>

      <input
        value={pseudo}
        onChange={(e) => setPseudo(e.target.value)}
        placeholder="ex: jean_p"
        maxLength={20}
        className="w-full max-w-xs rounded-xl px-4 py-3 mt-5 text-center text-lg outline-none"
        style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary }}
      />
      <p className="text-[11px] mt-1" style={{ color: COLORS.textMuted }}>3 à 20 caractères — lettres, chiffres, points ou underscores</p>

      {erreur && <p className="text-xs mt-3 text-center" style={{ color: "#B23A2E" }}>{erreur}</p>}

      <button
        onClick={creer}
        disabled={enCours || pseudo.length < 3}
        className="w-full max-w-xs rounded-xl py-3 font-semibold mt-5"
        style={{
          background: pseudo.length >= 3 ? COLORS.accentPrimary : COLORS.border,
          color: pseudo.length >= 3 ? COLORS.background : COLORS.textMuted,
        }}
      >
        {enCours ? "Création..." : "Valider définitivement"}
      </button>
    </div>
  );
}
