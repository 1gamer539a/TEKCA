"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Sun, Moon, Send } from "lucide-react";

const extraireUrlImage = (texte) => {
  const match = texte?.match(/https?:\/\/\S+\.(jpe?g|png|webp|gif)/i);
  return match ? match[0] : null;
};
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

/*
  Fil de discussion pour une réclamation (contacts_support) — même
  principe que FilDiscussion.jsx (messagerie acheteur/vendeur), mais
  pour les échanges avec l'équipe TEKÇA. Le premier message est
  toujours contacts_support.message ; les suivants (des deux côtés)
  sont dans messages_support.
*/
export default function FilSupport() {
  const router = useRouter();
  const params = useParams();
  const contactId = params?.id;
  const { theme, setTheme } = useTheme();
  const COLORS = THEMES[theme];

  const [userId, setUserId] = useState(null);
  const [messageOrigine, setMessageOrigine] = useState(null);
  const [messages, setMessages] = useState([]);
  const [saisie, setSaisie] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [chargement, setChargement] = useState(true);
  const finDuFil = useRef(null);

  useEffect(() => {
    const charger = async () => {
      setChargement(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setChargement(false); return; }
      setUserId(user.id);

      const { data: contact } = await supabase
        .from("contacts_support")
        .select("id, message, date_creation")
        .eq("id", contactId)
        .single();
      if (contact) setMessageOrigine(contact);

      const { data: msgs } = await supabase
        .from("messages_support")
        .select("id, contenu, expediteur_id, date_creation")
        .eq("contact_id", contactId)
        .order("date_creation", { ascending: true });
      setMessages(msgs || []);
      setChargement(false);

      const canal = supabase
        .channel(`support-${contactId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages_support", filter: `contact_id=eq.${contactId}` },
          (payload) => {
            setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]));
          }
        )
        .subscribe();

      return canal;
    };

    let canalActif = null;
    charger().then((c) => { canalActif = c; });
    return () => { if (canalActif) supabase.removeChannel(canalActif); };
  }, [contactId]);

  useEffect(() => {
    finDuFil.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const envoyer = async () => {
    if (!saisie.trim() || envoiEnCours) return;
    setEnvoiEnCours(true);
    const contenu = saisie.trim();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const reponse = await fetch("/api/support/repondre", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ contactId, message: contenu }),
      });
      const data = await reponse.json();
      if (!reponse.ok) throw new Error(data.error);
      setMessages((prev) => (prev.some((m) => m.id === data.message?.id) ? prev : [...prev, { id: data.message?.id || Date.now(), contenu, expediteur_id: userId, date_creation: new Date().toISOString() }]));
      setSaisie("");
    } catch (e) {
      // silencieux volontairement : le realtime rattrapera le message
      // si l'écriture a réussi malgré une erreur réseau côté réponse
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }} className="flex flex-col">
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">Équipe TEKÇA</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-20 pb-24 flex flex-col gap-2">
        {chargement && <p className="text-xs text-center py-10" style={{ color: COLORS.textMuted }}>Chargement...</p>}

        {!chargement && messageOrigine && (
          <div className="self-start max-w-[80%] rounded-2xl rounded-bl-sm px-3 py-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            {(() => {
              const url = extraireUrlImage(messageOrigine.message);
              return url ? (
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt="Pièce jointe" className="max-w-full max-h-52 rounded-lg object-cover" />
                </a>
              ) : (
                <p className="text-sm">{messageOrigine.message}</p>
              );
            })()}
            <p className="text-[10px] mt-1" style={{ color: COLORS.textMuted }}>
              {new Date(messageOrigine.date_creation).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        )}

        {messages.map((m) => {
          const estMoi = m.expediteur_id === userId;
          return (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-2xl px-3 py-2 ${estMoi ? "self-end rounded-br-sm" : "self-start rounded-bl-sm"}`}
              style={{ background: estMoi ? COLORS.accentPrimary : COLORS.surface, color: estMoi ? COLORS.background : COLORS.textPrimary, border: estMoi ? "none" : `1px solid ${COLORS.border}` }}
            >
              <p className="text-sm">{m.contenu}</p>
              <p className="text-[10px] mt-1" style={{ color: estMoi ? "rgba(255,255,255,0.7)" : COLORS.textMuted }}>
                {new Date(m.date_creation).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          );
        })}
        <div ref={finDuFil} />
      </main>

      <div
        className="fixed bottom-0 left-0 right-0 z-40 px-4 py-3 flex items-center gap-2"
        style={{ background: COLORS.background, borderTop: `1px solid ${COLORS.border}` }}
      >
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") envoyer(); }}
          placeholder="Écrire un message..."
          className="flex-1 rounded-full px-4 py-2.5 text-sm outline-none"
          style={{ background: COLORS.surface, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
        />
        <button
          onClick={envoyer}
          disabled={!saisie.trim() || envoiEnCours}
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: COLORS.accentPrimary }}
        >
          <Send size={16} color={COLORS.background} />
        </button>
      </div>
    </div>
  );
}
