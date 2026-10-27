"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Sun, Moon, Plus, ArrowDownToLine, Send, Crown, Gift, ShieldAlert, Wallet, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";
import { useLanguage } from "../lib/i18n/LanguageContext";

/*
  Mon compte > Historique : toutes les transactions du portefeuille,
  30 par 30. Le portefeuille n'affiche que les 10 dernières.
*/
const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};
const PAGE = 30;

export default function HistoriqueTransactions() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const COLORS = THEMES[theme] || THEMES.clair;
  const [transactions, setTransactions] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [encore, setEncore] = useState(false);

  const charger = async (debut) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("transactions_wallet")
      .select("id, type, montant, frais, statut, date_creation")
      .eq("user_id", user.id)
      .order("date_creation", { ascending: false })
      .range(debut, debut + PAGE - 1);
    const lot = data || [];
    setTransactions((actuelles) => (debut === 0 ? lot : [...actuelles, ...lot]));
    setEncore(lot.length === PAGE);
    setChargement(false);
  };
  useEffect(() => { charger(0); }, []);

  const LABELS_TYPE = {
    recharge: { label: t("wallet.typeRecharge"), icon: Plus, signe: "+" },
    retrait: { label: t("wallet.typeRetrait"), icon: ArrowDownToLine, signe: "−" },
    transfert_envoye: { label: t("wallet.typeTransfertEnvoye"), icon: Send, signe: "−" },
    transfert_recu: { label: t("wallet.typeTransfertRecu"), icon: Send, signe: "+" },
    paiement_commande: { label: t("wallet.typePaiementCommande"), icon: ArrowDownToLine, signe: "−" },
    paiement_abonnement: { label: t("wallet.typeAbonnementTekca"), icon: Crown, signe: "−" },
    cashback: { label: t("wallet.typeCashback"), icon: Gift, signe: "+" },
    ajustement_admin: { label: t("wallet.typeAjustementEquipe"), icon: ShieldAlert, signe: "±" },
  };

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3" style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}>
        <button onClick={() => (window.history.length > 1 ? router.back() : router.push("/compte"))} aria-label={t("common.retour")}><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">{t("historique.titre")}</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label={t("common.changerTheme")}>
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 flex flex-col gap-3" style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}>
        {!chargement && transactions.length === 0 && (
          <div className="flex flex-col items-center text-center py-8 rounded-xl" style={{ background: COLORS.surface, border: `1px dashed ${COLORS.border}` }}>
            <Wallet size={26} color={COLORS.textMuted} />
            <p className="text-sm font-semibold mt-3">{t("historique.vide")}</p>
          </div>
        )}

        {transactions.map((tx) => {
          const info = LABELS_TYPE[tx.type] || { label: tx.type, icon: Wallet, signe: "" };
          return (
            <div key={tx.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: COLORS.background }}>
                <info.icon size={15} color={COLORS.accentPrimary} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold">{info.label}</p>
                <p className="text-[10px]" style={{ color: COLORS.textMuted }}>{new Date(tx.date_creation).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                {tx.type === "transfert_envoye" && tx.frais > 0 && (
                  <p className="text-[10px]" style={{ color: COLORS.textMuted }}>{t("wallet.fraisSuffixe", { montant: Number(tx.frais).toLocaleString() })}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-bold" style={{ color: COLORS.accentPrimary }}>{info.signe}{Number(tx.montant).toLocaleString()} FCFA</span>
                <span className="text-[10px] flex items-center gap-1" style={{ color: tx.statut === "reussi" ? "#3A8A5C" : tx.statut === "echoue" ? "#B23A2E" : COLORS.textMuted }}>
                  {tx.statut === "reussi" && <CheckCircle2 size={10} />}
                  {tx.statut === "echoue" && <XCircle size={10} />}
                  {tx.statut === "en_attente" && <Clock size={10} />}
                  {tx.statut === "reussi" ? t("wallet.statutReussi") : tx.statut === "echoue" ? t("wallet.statutEchoue") : tx.statut === "en_attente" ? t("wallet.statutEnAttente") : tx.statut}
                </span>
              </div>
            </div>
          );
        })}

        {encore && (
          <button onClick={() => charger(transactions.length)} className="text-xs font-semibold py-3 rounded-xl" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.accentPrimary }}>
            {t("historique.voirPlus")}
          </button>
        )}
      </main>
    </div>
  );
}
