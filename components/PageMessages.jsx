"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Sun, Moon, Search, Sparkles, Store, ChevronRight,
  Lock, LogIn, CheckCheck
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

/*
  "IA Assistant" est une conversation virtuelle (id fixe "ia") toujours
  affichée en tête — elle ne vient pas de la table `conversations`,
  elle mène directement vers /ia (chat plein écran).
  Toute cette page suppose un `user_id` de session valide (issu de la
  table `users`). Sans compte connecté, on affiche un écran de
  connexion obligatoire — aucun message ne peut être envoyé ni reçu
  sans identification, pour pouvoir tracer qui a écrit quoi.
*/
export default function PageMessages() {
  const router = useRouter();
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];
  const [recherche, setRecherche] = useState("");
  const [connecte, setConnecte] = useState(null); // null = en cours de vérif
  const [conversations, setConversations] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const charger = async () => {
      setChargement(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setConnecte(false);
        setChargement(false);
        return;
      }
      setConnecte(true);

      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id, date_creation,
          vendeurs ( nom_boutique, sous_domaine ),
          messages_chat ( contenu, date_creation, lu, expediteur_id )
        `)
        .eq("client_id", user.id)
        .order("date_creation", { ascending: false });

      if (!error && data) {
        const conv = data.map((c) => {
          const derniersMessages = [...(c.messages_chat || [])].sort(
            (a, b) => new Date(b.date_creation) - new Date(a.date_creation)
          );
          const dernier = derniersMessages[0];
          const nonLu = (c.messages_chat || []).filter((m) => !m.lu && m.expediteur_id !== user.id).length;
          return {
            id: c.id,
            type: "vendeur",
            nom: c.vendeurs?.nom_boutique || "Vendeur",
            dernier: dernier?.contenu || "Nouvelle conversation",
            temps: dernier ? new Date(dernier.date_creation).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
            nonLu,
          };
        });
        setConversations(conv);
      }
      setChargement(false);
    };
    charger();
  }, []);

  const CONVERSATION_IA = { id: "ia", type: "ia", nom: "IA Assistant", dernier: "Pose-moi une question", temps: "", nonLu: 0 };
  const toutesLesConversations = [CONVERSATION_IA, ...conversations];

  if (connecte === false) {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }} className="flex flex-col items-center justify-center px-6 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <Lock size={22} color={COLORS.accentPrimary} />
        </div>
        <p className="font-bold text-lg">Connecte-toi pour voir tes messages</p>
        <p className="text-sm mt-2" style={{ color: COLORS.textMuted }}>
          Un compte est nécessaire pour discuter avec un vendeur ou l'IA — cela permet d'identifier chaque conversation.
        </p>
        <Link
          href="/auth"
          className="mt-6 rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-2"
          style={{ background: COLORS.accentPrimary, color: COLORS.background }}
        >
          <LogIn size={16} /> Se connecter / Créer un compte
        </Link>
      </div>
    );
  }

  const filtrees = toutesLesConversations.filter((c) => c.nom.toLowerCase().includes(recherche.toLowerCase()));

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">Messages</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-10">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <Search size={15} color={COLORS.textMuted} />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher une conversation..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: COLORS.textPrimary }}
          />
        </div>

        <div className="flex flex-col gap-1">
          {filtrees.map((c) => (
            <Link
              href={c.type === "ia" ? "/ia" : `/messages/${c.id}`}
              key={c.id}
              className="flex items-center gap-3 rounded-xl p-3"
              style={{ background: c.nonLu > 0 ? COLORS.surface : "transparent", border: `1px solid ${c.nonLu > 0 ? COLORS.accentPrimary : COLORS.border}` }}
            >
              <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: c.type === "ia" ? COLORS.accentPrimary : COLORS.surface, border: c.type === "ia" ? "none" : `1px solid ${COLORS.border}` }}>
                {c.type === "ia" ? <Sparkles size={18} color={COLORS.background} /> : <Store size={18} color={COLORS.accentPrimary} />}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold truncate">{c.nom}</p>
                  <span className="text-[10px] flex-shrink-0" style={{ color: COLORS.textMuted }}>{c.temps}</span>
                </div>
                <div className="flex items-center gap-1">
                  {c.nonLu === 0 && <CheckCheck size={12} color={COLORS.textMuted} />}
                  <p className="text-xs truncate" style={{ color: c.nonLu > 0 ? COLORS.textPrimary : COLORS.textMuted }}>
                    {c.dernier}
                  </p>
                </div>
              </div>
              {c.nonLu > 0 && (
                <span className="text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold flex-shrink-0" style={{ background: COLORS.accentPrimary, color: COLORS.background }}>
                  {c.nonLu}
                </span>
              )}
            </Link>
          ))}
          {filtrees.length === 0 && !chargement && (
            <p className="text-sm text-center py-10" style={{ color: COLORS.textMuted }}>Aucune conversation trouvée.</p>
          )}
          {chargement && (
            <p className="text-sm text-center py-10" style={{ color: COLORS.textMuted }}>Chargement...</p>
          )}
        </div>
      </main>
    </div>
  );
}
