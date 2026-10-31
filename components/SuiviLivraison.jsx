"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeft, Sun, Moon, CheckCircle2, Package, Truck, Home,
  MessageCircle, Phone, ShieldCheck, AlertTriangle, Lock
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";
import { useLanguage } from "../lib/i18n/LanguageContext";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

const ETAPES = [
  { id: "paye", cle: "suivi.etapePayeLabel", icon: Lock },
  { id: "prepare", cle: "suivi.etapePrepareLabel", icon: Package },
  { id: "expedie", cle: "suivi.etapeExpedieLabel", icon: Truck },
  { id: "livre", cle: "suivi.etapeLivreLabel", icon: Home },
];

const ETAPE_INDEX = { en_attente: 0, paye: 1, expedie: 2, livre: 3 };

export default function SuiviLivraison() {
  const router = useRouter();
  const params = useParams();
  const commandeId = params?.id;
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const COLORS = THEMES[theme];
  const [colisConfirme, setColisConfirme] = useState(false);
  const [signalementOuvert, setSignalementOuvert] = useState(false);
  const [commande, setCommande] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [codeLivraison, setCodeLivraison] = useState(null);

  useEffect(() => {
    if (!commandeId) return;
    const charger = async () => {
      setChargement(true);
      const { data } = await supabase
        .from("commandes")
        .select(`
          id, vendeur_id, montant_total, statut, date_creation,
          vendeurs ( nom_boutique ),
          produits ( nom ),
          sequestres ( montant_produit, frais_protection_acheteur, statut, confirme_par_client )
        `)
        .eq("id", commandeId)
        .single();

      if (data) {
        const sequestre = Array.isArray(data.sequestres) ? data.sequestres[0] : data.sequestres;
        setCommande({
          id: data.id,
          vendeurId: data.vendeur_id,
          vendeur: data.vendeurs?.nom_boutique || "—",
          article: data.produits?.nom || "—",
          montant: Number(sequestre?.montant_produit || data.montant_total),
          fraisProtection: Number(sequestre?.frais_protection_acheteur || 0),
          statut: data.statut,
          etapeActuelle: ETAPE_INDEX[data.statut] ?? 1,
        });
        if (sequestre?.confirme_par_client) setColisConfirme(true);
      }
      setChargement(false);

      // Récupère le code de livraison si cette commande en a un (produit
      // physique) — silencieux si absent (recharge/abonnement numérique).
      const { data: { session } } = await supabase.auth.getSession();
      const reponseCode = await fetch(`/api/commandes/${commandeId}/code-livraison`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (reponseCode.ok) {
        const donneesCode = await reponseCode.json();
        setCodeLivraison(donneesCode);
      }
    };
    charger();
  }, [commandeId]);

  const confirmerReception = async () => {
    setErreur(null);
    setEnCours(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const reponse = await fetch(`/api/commandes/${commandeId}/confirmer-reception`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await reponse.json();
      if (!reponse.ok) throw new Error(data.error || t("suivi.echecConfirmation"));
      setColisConfirme(true);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  };

  if (chargement) {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh" }} className="flex items-center justify-center">
        <p className="text-sm" style={{ color: COLORS.textMuted }}>{t("common.chargement")}</p>
      </div>
    );
  }

  if (!commande) {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }} className="flex items-center justify-center px-6 text-center">
        <p className="text-sm" style={{ color: COLORS.textMuted }}>{t("suivi.commandeIntrouvable")}</p>
      </div>
    );
  }

  const arriveLivraison = commande.etapeActuelle >= 2;
  const total = commande.montant + commande.fraisProtection;


  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label={t("common.retour")}><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">{commande.id}</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label={t("common.changerTheme")}>
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-10 flex flex-col gap-4">
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <div className="w-14 h-14 rounded-lg flex-shrink-0" style={{ background: COLORS.background }} />
          <div className="flex-1">
            <p className="text-sm font-semibold">{commande.article}</p>
            <p className="text-[11px]" style={{ color: COLORS.textMuted }}>{commande.vendeur}</p>
          </div>
          <p className="text-sm font-bold" style={{ color: COLORS.accentPrimary }}>{total.toLocaleString()} FCFA</p>
        </div>

        {/* Bloc séquestre */}
        <div className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={15} color={colisConfirme ? "#3A8A5C" : COLORS.accentPrimary} />
            <span className="text-xs font-semibold">
              {colisConfirme ? t("suivi.fondsLiberesVendeur") : t("suivi.fondsRetenusSecurite")}
            </span>
          </div>
          <div className="flex justify-between text-[11px]" style={{ color: COLORS.textMuted }}>
            <span>{t("suivi.article")}</span><span>{commande.montant.toLocaleString()} FCFA</span>
          </div>
          <div className="flex justify-between text-[11px] mt-0.5" style={{ color: COLORS.textMuted }}>
            <span>{t("suivi.protectionAcheteurPct")}</span><span>{commande.fraisProtection.toLocaleString()} FCFA</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          {ETAPES.map((e, i) => {
            const complet = i <= commande.etapeActuelle;
            const estDernier = i === ETAPES.length - 1;
            return (
              <div key={e.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: complet ? COLORS.accentPrimary : COLORS.background, border: `1px solid ${complet ? COLORS.accentPrimary : COLORS.border}` }}
                  >
                    <e.icon size={15} color={complet ? COLORS.background : COLORS.textMuted} />
                  </div>
                  {!estDernier && (
                    <div className="w-0.5 flex-1 my-1" style={{ background: i < commande.etapeActuelle ? COLORS.accentPrimary : COLORS.border, minHeight: 28 }} />
                  )}
                </div>
                <div className="pb-6">
                  <p className="text-sm font-semibold" style={{ color: complet ? COLORS.textPrimary : COLORS.textMuted }}>{t(e.cle)}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Code de confirmation de livraison (produits physiques) — à
            communiquer au vendeur en main propre à la réception */}
        {codeLivraison && !codeLivraison.dejaValide && (
          <div className="rounded-2xl p-4 mb-4 text-center" style={{ background: COLORS.surface, border: `1px solid ${COLORS.accentSecondary}` }}>
            {codeLivraison.bloque ? (
              <>
                <p className="text-sm font-semibold mb-1">{t("suivi.codeBloque")}</p>
                <p className="text-[11px]" style={{ color: COLORS.textMuted }}>
                  {t("suivi.tropTentativesDesc")}
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] mb-2" style={{ color: COLORS.textMuted }}>
                  {t("suivi.codeConfirmationDesc")}
                </p>
                <p className="text-3xl font-bold tracking-[0.3em]" style={{ color: COLORS.accentPrimary }}>
                  {codeLivraison.code}
                </p>
              </>
            )}
          </div>
        )}

        {/* Confirmation de réception — uniquement une fois livré */}
        {arriveLivraison && !colisConfirme && (
          <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.accentPrimary}` }}>
            <p className="text-sm font-semibold mb-1">{t("suivi.asTuRecuColis")}</p>
            <p className="text-[11px] mb-3" style={{ color: COLORS.textMuted }}>
              {t("suivi.confirmeDesColis", { heures: 48 })}
            </p>
            {erreur && <p className="text-xs mb-2" style={{ color: "#B23A2E" }}>{erreur}</p>}
            <button
              onClick={confirmerReception}
              disabled={enCours}
              className="w-full rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
              style={{ background: COLORS.accentPrimary, color: COLORS.background }}
            >
              <CheckCircle2 size={16} /> {enCours ? t("suivi.confirmationEnCours") : t("suivi.colisRecu")}
            </button>
            <button
              onClick={() => router.push(`/contact?commande=${commande.id}&vendeur=${commande.vendeurId}`)}
              className="w-full rounded-xl py-2.5 mt-2 text-xs font-semibold flex items-center justify-center gap-2"
              style={{ border: `1px solid #B23A2E`, color: "#B23A2E" }}
            >
              <AlertTriangle size={14} /> {t("suivi.signalerProbleme")}
            </button>
          </div>
        )}

        {colisConfirme && (
          <div className="rounded-2xl p-4 flex items-center gap-2" style={{ background: COLORS.surface, border: `1px solid #3A8A5C` }}>
            <CheckCircle2 size={18} color="#3A8A5C" />
            <p className="text-sm" style={{ color: COLORS.textPrimary }}>{t("suivi.receptionConfirmeeMerci")}</p>
          </div>
        )}


        <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <p className="text-xs font-semibold mb-1">{t("suivi.adresseLivraisonLabel")}</p>
          <p className="text-xs" style={{ color: COLORS.textMuted }}>{t("suivi.renseigneeALaCommande")}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => router.push("/messages")}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: COLORS.accentPrimary, color: COLORS.background }}
          >
            <MessageCircle size={16} /> {t("suivi.contacterLeVendeur")}
          </button>
          <button
            onClick={() => router.push("/contact")}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
            style={{ border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary }}
          >
            <Phone size={16} /> {t("suivi.assistance")}
          </button>
        </div>
      </main>
    </div>
  );
}
