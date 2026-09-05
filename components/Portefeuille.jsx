"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeft, Sun, Moon, Wallet, Plus, ArrowDownToLine, Send,
  ShieldAlert, Clock, CheckCircle2, XCircle, Crown, Gift
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { PAYS_SEBPAY, indicatifPourPays } from "../lib/pays";
import { useLanguage } from "../lib/i18n/LanguageContext";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

const SEUIL_CNI = 15000;

export default function Portefeuille() {
  const router = useRouter();
  const { t } = useLanguage();
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];

  const [solde, setSolde] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [pieceVerifiee, setPieceVerifiee] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [panneau, setPanneau] = useState(null); // "recharge" | "retrait" | "transfert" | null
  const [montant, setMontant] = useState("");
  const [numero, setNumero] = useState("");
  const [moyen, setMoyen] = useState("mtn_mobile_money");
  const [paysWallet, setPaysWallet] = useState("CG");
  const MAP_OPERATEUR = { mtn_mobile_money: "MTN Mobile Money", airtel_money: "Airtel Money" };
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(null);

  // Identité TEKÇA (pseudo + identifiant), pour recevoir des transferts
  const [monIdentite, setMonIdentite] = useState(null); // { pseudo, identifiant_tekca }
  const [identifiantSaisi, setIdentifiantSaisi] = useState("");

  // Confirmation du destinataire avant transfert
  const [destinataireVerifie, setDestinataireVerifie] = useState(null); // { pseudo } | null
  const [verificationEnCours, setVerificationEnCours] = useState(false);

  const charger = async () => {
    setChargement(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setChargement(false); return; }

    const { data: profil } = await supabase.from("users").select("piece_identite_verifiee, pseudo, identifiant_tekca").eq("id", user.id).single();
    if (profil) {
      setPieceVerifiee(profil.piece_identite_verifiee);
      setMonIdentite({ pseudo: profil.pseudo, identifiant: profil.identifiant_tekca });
    }

    const { data: wallet } = await supabase.from("wallets").select("solde").eq("user_id", user.id).single();
    setSolde(Number(wallet?.solde || 0));

    const { data: txs } = await supabase
      .from("transactions_wallet")
      .select("id, type, montant, frais, statut, date_creation")
      .eq("user_id", user.id)
      .order("date_creation", { ascending: false })
      .limit(20);
    if (txs) setTransactions(txs);

    setChargement(false);
  };

  useEffect(() => { charger(); }, []);

  const copierIdentifiant = () => {
    if (monIdentite?.identifiant) navigator.clipboard?.writeText(monIdentite.identifiant);
  };

  const appelApi = async (endpoint, body) => {
    const { data: { session } } = await supabase.auth.getSession();
    const reponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(body),
    });
    return { ok: reponse.ok, data: await reponse.json() };
  };

  const verifierDestinataire = async () => {
    setErreur(null);
    if (!identifiantSaisi) return;
    setVerificationEnCours(true);
    try {
      const { ok, data } = await appelApi("/api/wallet/verifier-destinataire", { identifiant: identifiantSaisi });
      if (!ok) throw new Error(data.error || "Destinataire introuvable.");
      setDestinataireVerifie({ pseudo: data.pseudo, tauxFrais: data.tauxFrais });
    } catch (e) {
      setErreur(e.message);
      setDestinataireVerifie(null);
    } finally {
      setVerificationEnCours(false);
    }
  };

  const soumettre = async () => {
    setErreur(null);
    setSucces(null);
    if (!montant) return;
    setEnCours(true);

    try {
      if (panneau === "recharge") {
        const numeroComplet = `${indicatifPourPays(paysWallet)}${numero.replace(/[\s-]/g, "").replace(/^0+/, "")}`;
        const { ok, data } = await appelApi("/api/wallet/recharger", { montant, numeroClient: numeroComplet, operateur: MAP_OPERATEUR[moyen], pays: paysWallet });
        if (!ok) throw new Error(data.error || "Échec de la recharge.");
        setSucces(data.lienPaiement ? "Redirection vers le paiement..." : "Recharge initiée.");
        if (data.lienPaiement) window.location.href = data.lienPaiement;
      }

      if (panneau === "retrait") {
        if (parseFloat(montant) >= SEUIL_CNI && !pieceVerifiee) {
          setErreur(`Vérification d'identité requise pour les retraits à partir de ${SEUIL_CNI.toLocaleString()} FCFA.`);
          setEnCours(false);
          return;
        }
        const numeroComplet = `${indicatifPourPays(paysWallet)}${numero.replace(/[\s-]/g, "").replace(/^0+/, "")}`;
        const { ok, data } = await appelApi("/api/wallet/retirer", { montant, moyen, numeroDestinataire: numeroComplet, operateur: MAP_OPERATEUR[moyen], pays: paysWallet });
        if (!ok) {
          if (data.error === "verification_requise") {
            setErreur(data.message);
            setTimeout(() => router.push("/verification-identite"), 1500);
            setEnCours(false);
            return;
          }
          throw new Error(data.message || data.error || "Échec du retrait.");
        }
        setSucces("Retrait envoyé avec succès.");
        charger();
      }

      if (panneau === "transfert") {
        if (!destinataireVerifie) {
          setErreur(t("wallet.verifieDabordDestinataire"));
          setEnCours(false);
          return;
        }
        const { ok, data } = await appelApi("/api/wallet/transferer", { montant, identifiantDestinataire: identifiantSaisi });
        if (!ok) throw new Error(data.error || "Échec du transfert.");
        setSucces(`Transfert envoyé à ${data.destinataire}.`);
        setDestinataireVerifie(null);
        charger();
      }

      setMontant("");
      setNumero("");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  };

  const LABELS_TYPE = {
    recharge: { label: "Recharge", icon: Plus, signe: "+" },
    retrait: { label: "Retrait", icon: ArrowDownToLine, signe: "−" },
    transfert_envoye: { label: "Transfert envoyé", icon: Send, signe: "−" },
    transfert_recu: { label: "Transfert reçu", icon: Send, signe: "+" },
    paiement_commande: { label: "Paiement commande", icon: ArrowDownToLine, signe: "−" },
    paiement_abonnement: { label: "Abonnement TEKÇA", icon: Crown, signe: "−" },
    cashback: { label: "Cashback", icon: Gift, signe: "+" },
    ajustement_admin: { label: "Ajustement équipe", icon: ShieldAlert, signe: "±" },
  };

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <style>{`
        @keyframes tekcaShimmer { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }
        .tekca-skeleton { background: linear-gradient(90deg, var(--sk1) 25%, var(--sk2) 37%, var(--sk1) 63%); background-size: 400px 100%; animation: tekcaShimmer 1.4s ease-in-out infinite; }
        @keyframes tekcaCheckDraw { from { stroke-dashoffset: 48; } to { stroke-dashoffset: 0; } }
        @keyframes tekcaPopIn { 0% { opacity: 0; transform: scale(0.85) translateY(8px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes tekcaShake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-4px); } 40% { transform: translateX(4px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(3px); } }
        .tekca-pop { animation: tekcaPopIn 0.35s ease-out both; }
        .tekca-shake { animation: tekcaShake 0.4s ease-in-out; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold flex items-center gap-1"><Wallet size={15} color={COLORS.accentPrimary} /> {t("wallet.titre")}</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label={t("common.changerTheme")}>
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-10 flex flex-col gap-4">
        {/* Solde */}
        <div className="rounded-2xl p-5 text-center" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, "--sk1": theme === "sombre" ? "#1a2740" : "#eef1f5", "--sk2": theme === "sombre" ? "#26375a" : "#dde3ea" }}>
          <p className="text-xs" style={{ color: COLORS.textMuted }}>{t("wallet.soldeDisponible")}</p>
          {chargement ? (
            <div className="tekca-skeleton rounded-md mx-auto mt-2" style={{ height: 32, width: 140 }} />
          ) : (
            <p className="text-3xl font-extrabold mt-1" style={{ color: COLORS.accentPrimary }}>
              {solde.toLocaleString()} FCFA
            </p>
          )}
          {!chargement && !pieceVerifiee && (
            <p className="text-[11px] mt-2 flex items-center justify-center gap-1" style={{ color: COLORS.textMuted }}>
              <ShieldAlert size={12} /> Identité non vérifiée — retraits limités à {SEUIL_CNI.toLocaleString()} FCFA
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: "recharge", label: t("wallet.recharger"), icon: Plus },
            { id: "retrait", label: t("wallet.retirer"), icon: ArrowDownToLine },
            { id: "transfert", label: t("wallet.transferer"), icon: Send },
          ].map((a) => (
            <button
              key={a.id}
              onClick={() => { setPanneau(a.id); setErreur(null); setSucces(null); setDestinataireVerifie(null); }}
              className="rounded-xl py-3 flex flex-col items-center gap-1"
              style={{
                background: panneau === a.id ? COLORS.accentPrimary : COLORS.surface,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <a.icon size={18} color={panneau === a.id ? COLORS.background : COLORS.accentPrimary} />
              <span className="text-[11px] font-semibold" style={{ color: panneau === a.id ? COLORS.background : COLORS.textPrimary }}>{a.label}</span>
            </button>
          ))}
        </div>

        {/* Panneau d'action */}
        {panneau && (
          <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <input
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              type="number"
              placeholder={t("wallet.montantPlaceholder")}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
            />

            {panneau === "recharge" && (
              <>
                <div className="flex gap-2">
                  {["mtn_mobile_money", "airtel_money"].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMoyen(m)}
                      className="flex-1 rounded-lg py-2 text-[10px] font-semibold uppercase"
                      style={{ background: moyen === m ? COLORS.accentPrimary : COLORS.background, color: moyen === m ? COLORS.background : COLORS.textMuted, border: `1px solid ${COLORS.border}` }}
                    >
                      {MAP_OPERATEUR[m]}
                    </button>
                  ))}
                </div>
                <select
                  value={paysWallet}
                  onChange={(e) => setPaysWallet(e.target.value)}
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                >
                  {PAYS_SEBPAY.map((p) => (
                    <option key={p.code} value={p.code}>{p.nom}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <span className="rounded-lg px-3 py-2 text-sm font-semibold flex-shrink-0" style={{ background: COLORS.background, color: COLORS.accentPrimary, border: `1px solid ${COLORS.border}` }}>
                    {indicatifPourPays(paysWallet)}
                  </span>
                  <input
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    placeholder={t("wallet.numeroMobileMoney")}
                    className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                  />
                </div>
              </>
            )}

            {panneau === "retrait" && (
              <>
                <div className="flex gap-2">
                  {["mtn_mobile_money", "airtel_money"].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMoyen(m)}
                      className="flex-1 rounded-lg py-2 text-[10px] font-semibold uppercase"
                      style={{ background: moyen === m ? COLORS.accentPrimary : COLORS.background, color: moyen === m ? COLORS.background : COLORS.textMuted, border: `1px solid ${COLORS.border}` }}
                    >
                      {m.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
                <select
                  value={paysWallet}
                  onChange={(e) => setPaysWallet(e.target.value)}
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                >
                  {PAYS_SEBPAY.map((p) => (
                    <option key={p.code} value={p.code}>{p.nom}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <span className="rounded-lg px-3 py-2 text-sm font-semibold flex-shrink-0" style={{ background: COLORS.background, color: COLORS.accentPrimary, border: `1px solid ${COLORS.border}` }}>
                    {indicatifPourPays(paysWallet)}
                  </span>
                  <input
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    placeholder={t("wallet.numeroDestinataire")}
                    className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                  />
                </div>
                {parseFloat(montant) >= SEUIL_CNI && !pieceVerifiee && (
                  <button
                    onClick={() => router.push("/verification-identite")}
                    className="text-[11px] flex items-center gap-1 text-left"
                    style={{ color: "#B23A2E" }}
                  >
                    <ShieldAlert size={12} /> Vérification d'identité requise pour ce montant — appuie ici
                  </button>
                )}
              </>
            )}

            {panneau === "transfert" && (
              <>
                <input
                  value={identifiantSaisi}
                  onChange={(e) => { setIdentifiantSaisi(e.target.value.replace(/\D/g, "")); setDestinataireVerifie(null); }}
                  placeholder={t("wallet.identifiantDestinataire")}
                  maxLength={9}
                  className="rounded-lg px-3 py-2 text-sm outline-none tracking-wider"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                />
                {!destinataireVerifie && (
                  <button
                    onClick={verifierDestinataire}
                    disabled={!identifiantSaisi || verificationEnCours}
                    className="rounded-lg py-2 text-xs font-semibold"
                    style={{ background: COLORS.background, color: COLORS.accentPrimary, border: `1px solid ${COLORS.accentPrimary}` }}
                  >
                    {verificationEnCours ? t("wallet.verificationEnCours") : t("wallet.verifierDestinataire")}
                  </button>
                )}
                {destinataireVerifie && (
                  <div className="rounded-lg p-3 text-sm text-center" style={{ background: COLORS.background, border: `1px solid ${COLORS.accentSecondary}` }}>
                    {t("wallet.confirmationEnvoi", { montant: montant ? Number(montant).toLocaleString() : "…", nom: `@${destinataireVerifie.pseudo}` })}
                    {montant && destinataireVerifie.tauxFrais > 0 && (
                      <p className="text-[11px] mt-1" style={{ color: COLORS.textMuted }}>
                        {t("wallet.fraisTransfertInfo", { frais: Math.round(Number(montant) * destinataireVerifie.tauxFrais).toLocaleString() })}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {erreur && (
              <div className="tekca-shake rounded-lg px-3 py-2 flex items-start gap-2" style={{ background: theme === "sombre" ? "rgba(178,58,46,0.12)" : "rgba(178,58,46,0.08)" }}>
                <XCircle size={14} color="#B23A2E" className="flex-shrink-0 mt-0.5" />
                <p className="text-xs" style={{ color: "#B23A2E" }}>{erreur}</p>
              </div>
            )}
            {succes && (
              <div className="tekca-pop rounded-lg p-3 flex items-center gap-2" style={{ background: theme === "sombre" ? "rgba(58,138,92,0.12)" : "rgba(58,138,92,0.08)" }}>
                <svg width="22" height="22" viewBox="0 0 52 52" className="flex-shrink-0">
                  <circle cx="26" cy="26" r="24" fill="none" stroke="#3A8A5C" strokeWidth="3" opacity="0.3" />
                  <path d="M15 27l7 7 15-15" fill="none" stroke="#3A8A5C" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="48" style={{ animation: "tekcaCheckDraw 0.5s ease-out 0.1s both" }} />
                </svg>
                <p className="text-xs font-semibold" style={{ color: "#3A8A5C" }}>{succes}</p>
              </div>
            )}

            <button
              onClick={soumettre}
              disabled={enCours || !montant || (panneau === "transfert" && !destinataireVerifie)}
              className="rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
              style={{
                background: montant ? COLORS.accentPrimary : COLORS.border,
                color: montant ? COLORS.background : COLORS.textMuted,
              }}
            >
              {enCours && (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.7s linear infinite" }}>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                  <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {enCours ? t("wallet.traitement") : t("common.confirmer")}
            </button>
          </div>
        )}

        {/* Identité TEKÇA — remplace le numéro de téléphone pour recevoir des transferts */}
        <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: COLORS.accentPrimary }}>
            {t("wallet.monIdentite")}
          </p>
          {monIdentite?.identifiant ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">@{monIdentite.pseudo}</p>
                <p className="text-lg font-extrabold tracking-wider" style={{ color: COLORS.accentPrimary }}>{monIdentite.identifiant}</p>
              </div>
              <button
                onClick={copierIdentifiant}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg"
                style={{ border: `1px solid ${COLORS.border}`, color: COLORS.textMuted }}
              >
                {t("wallet.copier")}
              </button>
            </div>
          ) : (
            <p className="text-[11px]" style={{ color: COLORS.textMuted }}>{t("wallet.identiteNonCreee")}</p>
          )}
          <p className="text-[11px] mt-2" style={{ color: COLORS.textMuted }}>{t("wallet.explicationIdentite")}</p>
        </div>

        {/* Historique */}
        <p className="text-xs font-bold uppercase tracking-wide mt-2" style={{ color: COLORS.accentPrimary }}>{t("wallet.historique")}</p>

        {chargement && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl p-3 flex items-center gap-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, "--sk1": theme === "sombre" ? "#1a2740" : "#eef1f5", "--sk2": theme === "sombre" ? "#26375a" : "#dde3ea" }}>
                <div className="tekca-skeleton rounded-lg flex-shrink-0" style={{ width: 36, height: 36 }} />
                <div className="flex-1">
                  <div className="tekca-skeleton rounded-md mb-1.5" style={{ height: 10, width: "60%" }} />
                  <div className="tekca-skeleton rounded-md" style={{ height: 8, width: "35%" }} />
                </div>
                <div className="tekca-skeleton rounded-md" style={{ height: 12, width: 50 }} />
              </div>
            ))}
          </div>
        )}

        {!chargement && transactions.length === 0 && (
          <div className="flex flex-col items-center text-center py-8 rounded-xl" style={{ background: COLORS.surface, border: `1px dashed ${COLORS.border}` }}>
            <Wallet size={26} color={COLORS.textMuted} />
            <p className="text-sm font-semibold mt-3">{t("wallet.aucuneTransaction")}</p>
            <button
              onClick={() => { setPanneau("recharge"); setErreur(null); setSucces(null); }}
              className="mt-3 px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5"
              style={{ background: COLORS.accentPrimary, color: COLORS.background }}
            >
              <Plus size={14} /> {t("wallet.recharger")}
            </button>
          </div>
        )}

        {!chargement && transactions.map((tx) => {
          const info = LABELS_TYPE[tx.type] || { label: tx.type, icon: Wallet, signe: "" };
          return (
            <div key={tx.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: COLORS.background }}>
                <info.icon size={15} color={COLORS.accentPrimary} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold">{info.label}</p>
                <p className="text-[10px]" style={{ color: COLORS.textMuted }}>{new Date(tx.date_creation).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                {tx.type === "transfert_envoye" && tx.frais > 0 && (
                  <p className="text-[10px]" style={{ color: COLORS.textMuted }}>+ {Number(tx.frais).toLocaleString()} FCFA de frais</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-bold" style={{ color: COLORS.accentPrimary }}>{info.signe}{Number(tx.montant).toLocaleString()} FCFA</span>
                <span className="text-[10px] flex items-center gap-1" style={{ color: tx.statut === "reussi" ? "#3A8A5C" : tx.statut === "echoue" ? "#B23A2E" : COLORS.textMuted }}>
                  {tx.statut === "reussi" && <CheckCircle2 size={10} />}
                  {tx.statut === "echoue" && <XCircle size={10} />}
                  {tx.statut === "en_attente" && <Clock size={10} />}
                  {tx.statut}
                </span>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
