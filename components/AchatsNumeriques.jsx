"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Sun, Moon, Lock, Copy, Check, AlertCircle, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";
import ConfirmationPIN from "./ConfirmationPIN";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

/*
  Page "Mes achats numériques" — liste les codes des produits achetés
  via le Coffre-fort numérique (recharges, abonnements, ebooks,
  templates). Volontairement gardée derrière une saisie de PIN à
  CHAQUE ouverture (pas seulement la session Supabase) : ces codes
  ont une valeur monétaire directe (un abonnement Netflix ou 100
  diamants Free Fire revendables), donc on redemande une confirmation
  explicite, comme avant un paiement — voir ConfirmationPIN.jsx.
*/
export default function AchatsNumeriques() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const COLORS = THEMES[theme];
  const [pinVerifie, setPinVerifie] = useState(false);
  const [achats, setAchats] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [codeCopie, setCodeCopie] = useState(null);

  useEffect(() => {
    if (!pinVerifie) return;
    const charger = async () => {
      setChargement(true);
      setErreur(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const reponse = await fetch("/api/achats-numeriques", {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        const data = await reponse.json();
        if (!reponse.ok) throw new Error(data.error || "Erreur de chargement.");
        setAchats(data.achats || []);
      } catch (e) {
        setErreur(e.message || "Impossible de charger tes achats.");
      } finally {
        setChargement(false);
      }
    };
    charger();
  }, [pinVerifie]);

  const copierCode = (code) => {
    navigator.clipboard?.writeText(code);
    setCodeCopie(code);
    setTimeout(() => setCodeCopie(null), 1500);
  };

  return (
    <div className="min-h-screen pb-24" style={{ background: COLORS.background, color: COLORS.textPrimary }}>
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3" style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}>
        <button onClick={() => router.back()} aria-label="Retour">
          <ArrowLeft size={20} />
        </button>
        <p className="font-bold text-sm">Mes achats numériques</p>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {!pinVerifie ? (
        <div className="flex flex-col items-center text-center gap-3 px-6 py-16">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <Lock size={22} color={COLORS.accentPrimary} />
          </div>
          <p className="text-sm font-semibold">Tes codes sont protégés</p>
          <p className="text-xs max-w-xs" style={{ color: COLORS.textMuted }}>
            Saisis ton code PIN pour voir les codes de tes achats numériques.
          </p>
        </div>
      ) : (
        <main className="px-4 py-4 flex flex-col gap-3">
          {chargement && <p className="text-sm text-center py-10" style={{ color: COLORS.textMuted }}>Chargement...</p>}
          {erreur && (
            <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: COLORS.surface, border: "1px solid #B23A2E" }}>
              <AlertCircle size={16} color="#B23A2E" />
              <p className="text-xs" style={{ color: "#B23A2E" }}>{erreur}</p>
            </div>
          )}
          {!chargement && !erreur && achats.length === 0 && (
            <div className="flex flex-col items-center text-center gap-2 py-16">
              <KeyRound size={28} color={COLORS.textMuted} />
              <p className="text-sm font-semibold">Aucun achat numérique pour l'instant</p>
              <p className="text-xs" style={{ color: COLORS.textMuted }}>
                Tes codes de recharge, abonnements, ebooks et templates apparaîtront ici après achat.
              </p>
            </div>
          )}
          {achats.map((a) => (
            <div key={a.commandeId} className="rounded-xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <p className="text-sm font-semibold">{a.produit}</p>
              <p className="text-[11px] mt-0.5" style={{ color: COLORS.textMuted }}>
                Acheté le {new Date(a.dateAchat).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · {a.boutique}
              </p>
              <button
                onClick={() => copierCode(a.code)}
                className="w-full mt-3 rounded-lg py-2.5 flex items-center justify-center gap-2 font-mono text-sm tracking-widest"
                style={{ background: COLORS.background, color: COLORS.accentSecondary, border: `1px solid ${COLORS.border}` }}
              >
                {a.code}
                {codeCopie === a.code ? <Check size={14} color={COLORS.accentSecondary} /> : <Copy size={14} color={COLORS.textMuted} />}
              </button>
              <Link
                href={`/contact?commande=${a.commandeId}`}
                className="block text-center text-[11px] mt-2"
                style={{ color: COLORS.textMuted }}
              >
                Signaler un problème avec ce code
              </Link>
            </div>
          ))}
        </main>
      )}

      <ConfirmationPIN
        ouvert={!pinVerifie}
        theme={theme}
        titre="Entre ton PIN pour voir tes codes"
        onSuccess={() => setPinVerifie(true)}
        onAnnuler={() => router.back()}
      />
    </div>
  );
}
