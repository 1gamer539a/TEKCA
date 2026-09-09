"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeft, Sun, Moon, Mic, Send, Sparkles, Lock, Zap,
  MessageSquare, Wand2, Crown, Image as ImageIcon
} from "lucide-react";
import { supabase } from "../lib/supabase";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

const SUGGESTIONS_RAPIDES = [
  { label: "Sensibilité Free Fire", icon: Wand2, generation: true, lourde: true },
  { label: "Code lobby GTA", icon: Wand2, generation: true, lourde: false },
  { label: "Générer une image (avatar guilde)", icon: Wand2, generation: true, lourde: true },
  { label: "Où en est ma commande ?", icon: MessageSquare, generation: false },
  { label: "Comment devenir vendeur ?", icon: MessageSquare, generation: false },
];

const LIMITE_FREE_PAR_JOUR = 3;

export default function IAAssistant({ onFermer }) {
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];

  const [forfait, setForfait] = useState("free");
  const [generationsUtilisees, setGenerationsUtilisees] = useState(0);
  const [saisie, setSaisie] = useState("");
  const [messages, setMessages] = useState([
    { role: "ia", texte: "Salut 👋 Je suis ton assistant gaming. Pose-moi une question, ou demande-moi une génération (sensibilité, code lobby...)." },
  ]);
  const [modalPremium, setModalPremium] = useState(false);
  const [enTrainDecrire, setEnTrainDecrire] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const initUtilisateur = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: abo } = await supabase
        .from("ia_abonnements")
        .select("forfait")
        .eq("user_id", user.id)
        .order("date_debut", { ascending: false })
        .limit(1)
        .single();
      if (abo) setForfait(abo.forfait);

      const debutJournee = new Date();
      debutJournee.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("ia_generations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("date_creation", debutJournee.toISOString());
      setGenerationsUtilisees(count || 0);
    };
    initUtilisateur();
  }, []);

  const limiteAtteinte = forfait === "free" && generationsUtilisees >= LIMITE_FREE_PAR_JOUR;

  const envoyer = async (texte, item = {}) => {
    const { generation = false, lourde = false } = item;
    if (!texte.trim() || enTrainDecrire) return;
    if (generation && lourde && limiteAtteinte) {
      setModalPremium(true);
      return;
    }

    const nouveauxMessages = [...messages, { role: "user", texte }];
    setMessages(nouveauxMessages);
    setSaisie("");
    setEnTrainDecrire(true);

    if (generation && lourde) {
      setGenerationsUtilisees((n) => n + 1);
      if (userId) {
        await supabase.from("ia_generations").insert({ user_id: userId, type_generation: texte });
      }
    }

    try {
      const historique = nouveauxMessages
        .filter((m) => m.role !== "ia" || nouveauxMessages.indexOf(m) !== 0) // exclut le message d'accueil
        .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.texte }));

      const reponse = await fetch("/api/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historique, generation }),
      });
      const data = await reponse.json();

      setMessages((m) => [
        ...m,
        { role: "ia", texte: data.texte || data.error || "Une erreur est survenue." },
      ]);
    } catch (e) {
      setMessages((m) => [...m, { role: "ia", texte: "Connexion à l'IA impossible pour le moment." }]);
    } finally {
      setEnTrainDecrire(false);
    }
  };

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }} className="flex flex-col">
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={onFermer} aria-label="Fermer l'assistant IA"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold flex items-center gap-1">
          <Sparkles size={15} color={COLORS.accentPrimary} /> IA Assistant
        </span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      {/* Bandeau statut forfait */}
      <div
        className="fixed top-14 left-0 right-0 z-30 flex items-center justify-between px-4 py-2"
        style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <div className="flex items-center gap-2">
          {forfait === "premium" ? (
            <Crown size={14} color={COLORS.accentPrimary} />
          ) : (
            <Zap size={14} color={COLORS.accentSecondary} />
          )}
          <span className="text-xs" style={{ color: COLORS.textPrimary }}>
            {forfait === "premium"
              ? "Premium — générations illimitées"
              : `Générations lourdes (images...) : ${generationsUtilisees}/${LIMITE_FREE_PAR_JOUR} aujourd'hui`}
          </span>
        </div>
        {forfait === "free" && (
          <button onClick={() => setModalPremium(true)} className="text-[11px] font-semibold" style={{ color: COLORS.accentPrimary }}>
            Passer Premium
          </button>
        )}
      </div>

      {/* FIL DE CHAT */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 pt-28 pb-40 flex flex-col gap-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="rounded-2xl px-3 py-2 text-sm max-w-[80%]"
              style={{
                background: m.role === "user" ? COLORS.accentPrimary : COLORS.surface,
                color: m.role === "user" ? COLORS.background : COLORS.textPrimary,
                border: m.role === "ia" ? `1px solid ${COLORS.border}` : "none",
              }}
            >
              {m.texte}
            </div>
          </div>
        ))}

        {enTrainDecrire && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-3 py-2 text-sm" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.textMuted }}>
              L'IA écrit...
            </div>
          </div>
        )}

        {/* Suggestions rapides */}
        <div className="flex flex-wrap gap-2 mt-2">
          {SUGGESTIONS_RAPIDES.map((item) => (
            <button
              key={item.label}
              onClick={() => envoyer(item.label, item)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full"
              style={{ background: COLORS.surface, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
            >
              <item.icon size={12} color={item.generation ? COLORS.accentPrimary : COLORS.accentSecondary} />
              {item.label}
              {item.lourde && limiteAtteinte && <Lock size={10} color={COLORS.textMuted} />}
            </button>
          ))}
        </div>
      </main>

      {/* BARRE DE SAISIE */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 px-4 py-3"
        style={{ background: COLORS.background, borderTop: `1px solid ${COLORS.border}` }}
      >
        <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <button aria-label="Joindre une image">
            <ImageIcon size={18} color={COLORS.accentSecondary} />
          </button>
          <input
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && envoyer(saisie)}
            placeholder={enTrainDecrire ? "L'IA répond..." : "Écris ou parle à l'IA..."}
            disabled={enTrainDecrire}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: COLORS.textPrimary }}
          />
          <button aria-label="Message vocal">
            <Mic size={18} color={COLORS.accentSecondary} />
          </button>
          <button onClick={() => envoyer(saisie)} disabled={enTrainDecrire} aria-label="Envoyer">
            <Send size={18} color={enTrainDecrire ? COLORS.textMuted : COLORS.accentPrimary} />
          </button>
        </div>
      </div>

      {/* MODAL UPSELL PREMIUM */}
      {modalPremium && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center gap-2 mb-2">
              <Crown size={20} color={COLORS.accentPrimary} />
              <p className="font-bold text-base">Passe en Premium</p>
            </div>
            <p className="text-sm mb-4" style={{ color: COLORS.textMuted }}>
              Tu as atteint tes {LIMITE_FREE_PAR_JOUR} générations gratuites du jour. Débloque les générations illimitées avec un forfait Premium.
            </p>
            <div className="flex flex-col gap-2 mb-4">
              {[
                { nom: "Basique", prix: "2 000 FCFA/mois" },
                { nom: "Pro", prix: "5 000 FCFA/mois" },
                { nom: "Ultra", prix: "10 000 FCFA/mois" },
              ].map((f) => (
                <button
                  key={f.nom}
                  onClick={() => { setForfait("premium"); setModalPremium(false); }}
                  className="rounded-xl p-3 flex items-center justify-between"
                  style={{ background: COLORS.background, border: `1px solid ${COLORS.border}` }}
                >
                  <span className="text-sm font-semibold">{f.nom}</span>
                  <span className="text-sm" style={{ color: COLORS.accentPrimary }}>{f.prix}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setModalPremium(false)}
              className="w-full text-center text-xs py-2"
              style={{ color: COLORS.textMuted }}
            >
              Plus tard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
