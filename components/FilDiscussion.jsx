"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, Sun, Moon, Store, Sparkles } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../lib/supabase";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

/*
  Correspond à la table `messages_chat`, filtrée par `conversation_id`
  (récupéré depuis l'URL /messages/[id]). Si le vendeur a activé
  ia_autorisee sur cette conversation, l'IA peut aussi poster des
  messages avec envoye_par_ia = true (badge "Réponse IA").
  Écoute en temps réel via Supabase Realtime pour afficher les
  nouveaux messages sans recharger la page.
*/
export default function FilDiscussion() {
  const router = useRouter();
  const params = useParams();
  const conversationId = params?.id;
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];
  const [saisie, setSaisie] = useState("");
  const [messages, setMessages] = useState([]);
  const [avertissement, setAvertissement] = useState(null);
  const [compteBloque, setCompteBloque] = useState(false);
  const [nomVendeur, setNomVendeur] = useState("Conversation");
  const [userId, setUserId] = useState(null);
  const [chargement, setChargement] = useState(true);
  const finDesMessages = useRef(null);

  useEffect(() => {
    if (!conversationId) return;

    const charger = async () => {
      setChargement(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setChargement(false); return; }
      setUserId(user.id);

      const { data: conv } = await supabase
        .from("conversations")
        .select("id, vendeurs ( nom_boutique )")
        .eq("id", conversationId)
        .single();
      if (conv) setNomVendeur(conv.vendeurs?.nom_boutique || "Vendeur");

      const { data: msgs } = await supabase
        .from("messages_chat")
        .select("id, contenu, expediteur_id, envoye_par_ia, date_creation")
        .eq("conversation_id", conversationId)
        .order("date_creation", { ascending: true });

      if (msgs) {
        setMessages(
          msgs.map((m) => ({
            id: m.id,
            role: m.expediteur_id === user.id ? "moi" : "autre",
            texte: m.contenu,
            ia: m.envoye_par_ia,
          }))
        );
      }
      setChargement(false);
    };
    charger();

    const canal = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages_chat", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [
              ...prev,
              {
                id: payload.new.id,
                role: payload.new.expediteur_id === userId ? "moi" : "autre",
                texte: payload.new.contenu,
                ia: payload.new.envoye_par_ia,
              },
            ];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [conversationId, userId]);

  useEffect(() => {
    finDesMessages.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const envoyer = async () => {
    if (!saisie.trim() || !userId || !conversationId) return;
    const contenu = saisie;
    setSaisie("");
    setAvertissement(null);

    const { data: { session } } = await supabase.auth.getSession();
    const reponse = await fetch("/api/messages/envoyer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ conversationId, contenu }),
    });
    const data = await reponse.json();

    if (!reponse.ok) {
      if (data.error === "compte_bloque") setCompteBloque(true);
      setAvertissement(data.message || "Message non envoyé.");
      return;
    }

    if (data.avertissement) setAvertissement(data.avertissement);

    setMessages((prev) =>
      prev.some((m) => m.id === data.message.id) ? prev : [...prev, { id: data.message.id, role: "moi", texte: data.message.contenu, ia: false }]
    );
  };

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }} className="flex flex-col">
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <Store size={16} color={COLORS.accentPrimary} />
        </div>
        <span className="text-sm font-semibold flex-1">{nomVendeur}</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={18} color={COLORS.accentSecondary} /> : <Moon size={18} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-4 pt-20 pb-24 flex flex-col gap-3">
        {chargement && (
          <p className="text-sm text-center py-10" style={{ color: COLORS.textMuted }}>Chargement des messages...</p>
        )}
        {!chargement && messages.length === 0 && (
          <p className="text-sm text-center py-10" style={{ color: COLORS.textMuted }}>Dis bonjour pour démarrer la conversation.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "moi" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[80%]">
              <div
                className="rounded-2xl px-3 py-2 text-sm"
                style={{
                  background: m.role === "moi" ? COLORS.accentPrimary : COLORS.surface,
                  color: m.role === "moi" ? COLORS.background : COLORS.textPrimary,
                  border: m.role === "autre" ? `1px solid ${COLORS.border}` : "none",
                }}
              >
                {m.texte}
              </div>
              {m.ia && (
                <span className="text-[10px] flex items-center gap-1 mt-1" style={{ color: COLORS.accentSecondary }}>
                  <Sparkles size={10} /> Réponse générée par l'IA du vendeur
                </span>
              )}
            </div>
          </div>
        ))}
        {avertissement && (
          <p className="text-xs text-center rounded-lg px-3 py-2" style={{ background: "rgba(178,58,46,0.12)", color: "#B23A2E" }}>
            {avertissement}
          </p>
        )}
        <div ref={finDesMessages} />
      </main>

      <div
        className="fixed bottom-0 left-0 right-0 z-40 px-4 py-3"
        style={{ background: COLORS.background, borderTop: `1px solid ${COLORS.border}` }}
      >
        <div className="max-w-md mx-auto flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <input
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !compteBloque && envoyer()}
            placeholder={compteBloque ? "Compte bloqué — contacte le support" : "Écrire un message..."}
            disabled={compteBloque}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: COLORS.textPrimary }}
          />
          <button onClick={envoyer} disabled={compteBloque} aria-label="Envoyer"><Send size={18} color={compteBloque ? COLORS.textMuted : COLORS.accentPrimary} /></button>
        </div>
      </div>
    </div>
  );
}
