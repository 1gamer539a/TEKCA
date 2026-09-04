"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeft, Sun, Moon, Trophy, Calendar, Users, Coins, Gift,
  Lock, CheckCircle2, FileText, Mail
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../lib/supabase";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

export default function DetailTournoi() {
  const router = useRouter();
  const params = useParams();
  const tournoiId = params?.id;
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];
  const [pseudo, setPseudo] = useState("");
  const [inscrit, setInscrit] = useState(false);
  const [tournoi, setTournoi] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    if (!tournoiId) return;
    const charger = async () => {
      setChargement(true);
      const { data: t } = await supabase
        .from("tournois")
        .select("id, titre, jeu, description, type_recompense, montant_cash_prize, description_recompense, mode_inscription, frais_inscription, nb_places_max, date_debut, inscriptions_tournoi ( id )")
        .eq("id", tournoiId)
        .single();

      if (t) {
        setTournoi({
          titre: t.titre,
          jeu: t.jeu,
          description: t.description,
          type: t.type_recompense,
          recompense: t.type_recompense === "cash_prize" ? `${Number(t.montant_cash_prize || 0).toLocaleString()} FCFA` : (t.description_recompense || "Récompenses en nature"),
          inscription: t.mode_inscription,
          frais: t.frais_inscription ? `${Number(t.frais_inscription).toLocaleString()} FCFA` : null,
          places: `${t.inscriptions_tournoi?.length || 0}/${t.nb_places_max || "—"}`,
          date: new Date(t.date_debut).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
        });
      }
      setChargement(false);
    };
    charger();
  }, [tournoiId]);

  const estInvitation = tournoi?.inscription === "invitation";
  const estPayant = tournoi?.inscription === "payante";

  const inscrire = async () => {
    setErreur(null);
    if (!pseudo.trim()) return;
    setEnCours(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Connecte-toi pour t'inscrire.");

      const { error } = await supabase.from("inscriptions_tournoi").insert({
        tournoi_id: tournoiId,
        joueur_id: user.id,
        pseudo_jeu: pseudo,
        statut: estPayant ? "en_attente" : "valide",
        paiement_confirme: !estPayant,
      });
      if (error) {
        if (error.code === "23505") throw new Error("Tu es déjà inscrit à ce tournoi.");
        throw error;
      }
      setInscrit(true);
    } catch (e) {
      setErreur(e.message || "Erreur lors de l'inscription.");
    } finally {
      setEnCours(false);
    }
  };

  if (chargement) {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh" }} className="flex items-center justify-center">
        <p className="text-sm" style={{ color: COLORS.textMuted }}>Chargement...</p>
      </div>
    );
  }

  if (!tournoi) {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }} className="flex items-center justify-center px-6 text-center">
        <p className="text-sm" style={{ color: COLORS.textMuted }}>Tournoi introuvable.</p>
      </div>
    );
  }

  if (inscrit) {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }} className="flex flex-col items-center justify-center px-6 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.accentPrimary}` }}>
          <CheckCircle2 size={22} color={COLORS.accentPrimary} />
        </div>
        <p className="font-bold text-lg">Inscription confirmée !</p>
        <p className="text-sm mt-2" style={{ color: COLORS.textMuted }}>
          Rendez-vous le {tournoi.date} — les infos de connexion au lobby arriveront dans tes notifications.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">Tournoi</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-10 flex flex-col gap-4">
        <div className="h-32 rounded-2xl flex items-center justify-center" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <Trophy size={36} color={COLORS.accentSecondary} />
        </div>

        <div>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: COLORS.surface, color: COLORS.accentSecondary, border: `1px solid ${COLORS.border}` }}>
            {tournoi.jeu}
          </span>
          <p className="text-xl font-extrabold mt-2">{tournoi.titre}</p>
          <p className="text-xs flex items-center gap-1 mt-1" style={{ color: COLORS.textMuted }}>
            <Calendar size={12} /> {tournoi.date}
          </p>
        </div>

        <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <div className="flex items-center gap-2 mb-1">
            {tournoi.type === "cash_prize" ? <Coins size={16} color={COLORS.accentPrimary} /> : <Gift size={16} color={COLORS.accentPrimary} />}
            <span className="text-sm font-bold" style={{ color: COLORS.accentPrimary }}>{tournoi.recompense}</span>
          </div>
        </div>

        {tournoi.description && (
          <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <p className="text-xs font-semibold mb-1 flex items-center gap-1"><FileText size={13} /> Règles / description</p>
            <p className="text-xs" style={{ color: COLORS.textMuted }}>{tournoi.description}</p>
          </div>
        )}

        <div className="rounded-xl px-3 py-2 flex items-center justify-between text-xs" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <span className="flex items-center gap-1" style={{ color: COLORS.textMuted }}><Users size={12} /> Places</span>
          <span style={{ color: COLORS.textPrimary }}>{tournoi.places}</span>
        </div>

        {/* Bloc inscription — s'adapte selon le mode */}
        {estInvitation ? (
          <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <Lock size={18} color={COLORS.textMuted} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Sur invitation uniquement</p>
              <p className="text-[11px] mt-1" style={{ color: COLORS.textMuted }}>
                Ce tournoi est réservé aux joueurs invités par l'organisation.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <label className="text-xs font-semibold block mb-1">Ton pseudo en jeu</label>
            <input
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              placeholder="Pseudo Free Fire"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-3"
              style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
            />
            {estPayant && (
              <div className="flex items-center justify-between rounded-lg px-3 py-2 mb-3" style={{ background: COLORS.background, border: `1px solid ${COLORS.border}` }}>
                <span className="text-xs" style={{ color: COLORS.textMuted }}>Frais d'inscription</span>
                <span className="text-sm font-bold" style={{ color: COLORS.accentPrimary }}>{tournoi.frais}</span>
              </div>
            )}
            {erreur && <p className="text-xs mb-2" style={{ color: "#B23A2E" }}>{erreur}</p>}
            <button
              onClick={inscrire}
              disabled={!pseudo || enCours}
              className="w-full rounded-xl py-3 font-semibold"
              style={{
                background: pseudo ? COLORS.accentPrimary : COLORS.border,
                color: pseudo ? COLORS.background : COLORS.textMuted,
              }}
            >
              {enCours ? "Inscription..." : estPayant ? "Payer et s'inscrire" : "S'inscrire au tournoi"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
