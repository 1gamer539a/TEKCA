"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeft, Sun, Moon, Package, MessageCircle, CheckCircle2,
  XCircle, Wallet, Trophy, Bell, Clock4
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";
import { useLanguage } from "../lib/i18n/LanguageContext";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

// Icônes seulement ici (statique) — les libellés se traduisent à
// l'affichage via t(), voir getTypes(t) plus bas.
const ICONES_TYPE = {
  commande: Package,
  message: MessageCircle,
  produit_valide: CheckCircle2,
  produit_refuse: XCircle,
  wallet_bas: Wallet,
  tournoi: Trophy,
  demande_expiree: Clock4,
};

function getTypes(t) {
  return {
    commande: { icon: ICONES_TYPE.commande, label: t("notifications.typeCommande") },
    message: { icon: ICONES_TYPE.message, label: t("notifications.typeMessage") },
    produit_valide: { icon: ICONES_TYPE.produit_valide, label: t("notifications.typeProduitValide") },
    produit_refuse: { icon: ICONES_TYPE.produit_refuse, label: t("notifications.typeProduitRefuse") },
    wallet_bas: { icon: ICONES_TYPE.wallet_bas, label: t("notifications.typeWalletBas") },
    tournoi: { icon: ICONES_TYPE.tournoi, label: t("notifications.typeTournoi") },
    demande_expiree: { icon: ICONES_TYPE.demande_expiree, label: t("notifications.typeDemandeExpiree") },
  };
}

function tempsRelatif(dateStr, t) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return t("notifications.tempsInstant");
  if (min < 60) return t("notifications.tempsIlYAMin", { min });
  const h = Math.floor(min / 60);
  if (h < 24) return t("notifications.tempsIlYAH", { h });
  return new Date(dateStr).toLocaleDateString("fr-FR");
}

export default function Notifications() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const COLORS = THEMES[theme];
  const TYPES = getTypes(t);
  const [notifs, setNotifs] = useState([]);
  // "filtre" garde des valeurs stables, indépendantes de la langue affichée.
  const [filtre, setFiltre] = useState("toutes");
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const charger = async () => {
      setChargement(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setChargement(false); return; }

      const { data, error } = await supabase
        .from("notifications")
        .select("id, type, texte, lu, date_creation")
        .eq("user_id", user.id)
        .order("date_creation", { ascending: false })
        .limit(50);

      if (!error && data) {
        setNotifs(data.map((n) => ({ ...n, temps: tempsRelatif(n.date_creation, t) })));
      }
      setChargement(false);
    };
    charger();

    // Temps réel : nouvelles notifications sans recharger
    const canal = supabase
      .channel("notifications-utilisateur")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        setNotifs((prev) => [{ ...payload.new, temps: tempsRelatif(payload.new.date_creation, t) }, ...prev]);
      })
      .subscribe();

    return () => supabase.removeChannel(canal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const marquerLu = async (id) => {
    setNotifs(notifs.map((n) => (n.id === id ? { ...n, lu: true } : n)));
    await supabase.from("notifications").update({ lu: true }).eq("id", id);
  };
  const nbNonLues = notifs.filter((n) => !n.lu).length;

  const filtres = [
    { valeur: "toutes", cle: "commandes.filtreToutes" },
    { valeur: "commandes", cle: "notifications.filtreCommandes" },
    { valeur: "messages", cle: "notifications.filtreMessages" },
    { valeur: "boutique", cle: "notifications.filtreBoutique" },
  ];
  const notifsFiltrees = notifs.filter((n) => {
    if (filtre === "toutes") return true;
    if (filtre === "commandes") return n.type === "commande";
    if (filtre === "messages") return n.type === "message";
    if (filtre === "boutique") return ["produit_valide", "produit_refuse", "wallet_bas"].includes(n.type);
    return true;
  });

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label={t("common.retour")}><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold flex items-center gap-2">
          {t("notifications.titre")}
          {nbNonLues > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: COLORS.accentPrimary, color: COLORS.background }}>
              {nbNonLues}
            </span>
          )}
        </span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label={t("common.changerTheme")}>
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <div className="fixed top-14 left-0 right-0 z-30 flex gap-2 px-4 py-2 overflow-x-auto" style={{ background: COLORS.background }}>
        {filtres.map((f) => (
          <button
            key={f.valeur}
            onClick={() => setFiltre(f.valeur)}
            className="text-xs px-3 py-1.5 rounded-full flex-shrink-0"
            style={{
              background: filtre === f.valeur ? COLORS.accentPrimary : COLORS.surface,
              color: filtre === f.valeur ? COLORS.background : COLORS.textMuted,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            {t(f.cle)}
          </button>
        ))}
      </div>

      <main className="max-w-md mx-auto w-full px-4 pt-28 pb-10 flex flex-col gap-2">
        {notifsFiltrees.length === 0 && (
          <div className="flex flex-col items-center pt-16 gap-2">
            <Bell size={28} color={COLORS.textMuted} />
            <p className="text-sm" style={{ color: COLORS.textMuted }}>{t("notifications.aucuneNotification")}</p>
          </div>
        )}
        {notifsFiltrees.map((n) => {
          const T = TYPES[n.type];
          return (
            <button
              key={n.id}
              onClick={() => marquerLu(n.id)}
              className="rounded-xl p-3 flex items-start gap-3 text-left"
              style={{
                background: n.lu ? COLORS.surface : COLORS.background,
                border: `1px solid ${n.lu ? COLORS.border : COLORS.accentPrimary}`,
              }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: COLORS.surface }}>
                <T.icon size={16} color={COLORS.accentPrimary} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold" style={{ color: COLORS.accentSecondary }}>{T.label}</p>
                {/* n.texte vient de la base (écrit en français par les routes
                    API au moment de l'insertion) — non traduit ici, ça
                    demanderait de localiser chaque route qui écrit une
                    notification, hors périmètre de cette passe. */}
                <p className="text-sm mt-0.5" style={{ color: COLORS.textPrimary }}>{n.texte}</p>
                <p className="text-[10px] mt-1" style={{ color: COLORS.textMuted }}>{n.temps}</p>
              </div>
              {!n.lu && <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: COLORS.accentPrimary }} />}
            </button>
          );
        })}
      </main>
    </div>
  );
}
