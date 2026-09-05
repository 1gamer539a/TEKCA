"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  LayoutDashboard, Package, ShoppingBag, MessageSquare, BarChart3,
  CreditCard, Settings, Plus, Upload, Sun, Moon, Bell, TrendingUp,
  Star, Clock, ShieldCheck, Truck, Lock, Rocket
} from "lucide-react";
import { supabase } from "../lib/supabase";

const THEMES = {
  sombre: {
    background: "#0A1220",
    surface: "#132039",
    accentPrimary: "#E85D2F",
    accentSecondary: "#C99A3A",
    textPrimary: "#FFFFFF",
    textMuted: "#8B96AD",
    border: "#1E2D4A",
  },
  clair: {
    background: "#FFFFFF",
    surface: "#F8FAFC",
    accentPrimary: "#E85D2F",
    accentSecondary: "#C99A3A",
    textPrimary: "#0F172A",
    textMuted: "#64748B",
    border: "#E2E8F0",
  },
};

function StatutBadge({ COLORS, statut }) {
  const map = {
    valide: { label: "Validé", color: COLORS.accentSecondary },
    en_attente: { label: "En attente", color: COLORS.textMuted },
    refuse: { label: "Refusé", color: "#B23A2E" },
    expedie: { label: "Expédié", color: COLORS.accentPrimary },
  };
  const s = map[statut] || map.en_attente;
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
      style={{ background: COLORS.background, color: s.color, border: `1px solid ${COLORS.border}` }}
    >
      {s.label}
    </span>
  );
}

export default function DashboardVendeur() {
  const [theme, setTheme] = useState("clair");
  const [niveau, setNiveau] = useState("revendeur_officiel");
  const [tab, setTab] = useState("apercu");
  const [modalBoost, setModalBoost] = useState(null);
  const [vendeurId, setVendeurId] = useState(null);
  const [produits, setProduits] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [statsVendeur, setStatsVendeur] = useState({ nomBoutique: "", note: 0, nbVentes: 0, tempsReponse: null });
  const [chargement, setChargement] = useState(true);
  const [erreurProduits, setErreurProduits] = useState(false);
  const [codesInput, setCodesInput] = useState({});
  const [validationEnCours, setValidationEnCours] = useState(null);
  const [messagesValidation, setMessagesValidation] = useState({});
  const COLORS = THEMES[theme];

  const validerCode = async (commandeId) => {
    setValidationEnCours(commandeId);
    setMessagesValidation((prev) => ({ ...prev, [commandeId]: null }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const reponse = await fetch(`/api/commandes/${commandeId}/valider-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ code: codesInput[commandeId] || "" }),
      });
      const data = await reponse.json();
      if (!reponse.ok) {
        setMessagesValidation((prev) => ({ ...prev, [commandeId]: { type: "erreur", texte: data.message || data.error } }));
        return;
      }
      setMessagesValidation((prev) => ({ ...prev, [commandeId]: { type: "succes", texte: "Livraison confirmée, fonds débloqués." } }));
      setCommandes((prev) => prev.map((c) => (c.id === commandeId ? { ...c, statut: "livre" } : c)));
    } catch (e) {
      setMessagesValidation((prev) => ({ ...prev, [commandeId]: { type: "erreur", texte: "Erreur réseau." } }));
    } finally {
      setValidationEnCours(null);
    }
  };


  useEffect(() => {
    chargerDashboard();
  }, []);

  const chargerDashboard = async () => {
      setChargement(true);
      setErreurProduits(false);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setChargement(false); return; }

        const { data: vendeur } = await supabase
          .from("vendeurs")
          .select("id, nom_boutique, niveau, note_moyenne, nb_ventes, temps_reponse_moyen_minutes")
          .eq("user_id", user.id)
          .single();

        if (!vendeur) { setChargement(false); return; }

        setVendeurId(vendeur.id);
        setNiveau(vendeur.niveau);
        setStatsVendeur({
          nomBoutique: vendeur.nom_boutique,
          note: vendeur.note_moyenne,
          nbVentes: vendeur.nb_ventes,
          tempsReponse: vendeur.temps_reponse_moyen_minutes,
        });

        const { data: produitsData, error: erreurProduitsReq } = await supabase
          .from("produits")
          .select("id, nom, statut_validation, stock_global")
          .eq("vendeur_id", vendeur.id)
          .order("date_creation", { ascending: false });

        if (erreurProduitsReq) throw erreurProduitsReq;

        if (produitsData) {
          setProduits(produitsData.map((p) => ({
            id: p.id,
            nom: p.nom,
            statut: p.statut_validation,
            stock: p.stock_global ?? 0,
          })));
        }

        const { data: commandesData } = await supabase
          .from("commandes")
          .select("id, montant_total, statut, client_id")
          .eq("vendeur_id", vendeur.id)
          .order("date_creation", { ascending: false })
          .limit(20);

        if (commandesData) {
          setCommandes(commandesData.map((c) => ({
            id: c.id,
            client: c.client_id,
            montant: `${Number(c.montant_total).toLocaleString()} FCFA`,
            statut: c.statut,
          })));
        }
      } catch (e) {
        setErreurProduits(true);
      } finally {
        setChargement(false);
      }
  };

  const TABS = [
    { id: "apercu", label: "Aperçu", icon: LayoutDashboard },
    { id: "produits", label: "Produits", icon: Package },
    { id: "commandes", label: "Commandes", icon: ShoppingBag },
    { id: "messages", label: "Messages", icon: MessageSquare },
    { id: "stats", label: "Stats", icon: BarChart3, premiumOnly: true },
    { id: "paiements", label: "Paiement", icon: CreditCard },
    { id: "parametres", label: "Réglages", icon: Settings },
  ];

  if (!chargement && !vendeurId) {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }} className="flex flex-col items-center justify-center px-6 text-center gap-3">
        <p className="font-bold text-lg">Aucun profil vendeur trouvé</p>
        <p className="text-sm" style={{ color: COLORS.textMuted }}>
          Connecte-toi avec un compte vendeur, ou crée ton profil pour accéder au dashboard.
        </p>
        <Link href="/vendre" className="rounded-xl px-5 py-2.5 text-sm font-semibold" style={{ background: COLORS.accentPrimary, color: COLORS.background }}>
          Devenir vendeur
        </Link>
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <style>{`
        @keyframes tekcaShimmer { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }
        .tekca-skeleton { background: linear-gradient(90deg, var(--sk1) 25%, var(--sk2) 37%, var(--sk1) 63%); background-size: 400px 100%; animation: tekcaShimmer 1.4s ease-in-out infinite; }
        @keyframes tekcaShake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-4px); } 40% { transform: translateX(4px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(3px); } }
        .tekca-shake { animation: tekcaShake 0.4s ease-in-out; }
      `}</style>
      {/* HEADER */}
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <div>
          <p className="text-sm font-bold">{statsVendeur.nomBoutique || "Ma boutique"}</p>
          <div className="flex items-center gap-1">
            {niveau === "revendeur_officiel" && <ShieldCheck size={12} color={COLORS.accentPrimary} />}
            <span className="text-[10px]" style={{ color: COLORS.textMuted }}>
              {niveau === "revendeur_officiel" ? "Revendeur officiel" : "Vendeur simple"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Bell size={18} color={COLORS.accentSecondary} />
          <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
            {theme === "sombre" ? <Sun size={18} color={COLORS.accentSecondary} /> : <Moon size={18} color={COLORS.accentSecondary} />}
          </button>
        </div>
      </header>

      {/* Sélecteur démo niveau — à retirer en prod */}
      <div className="fixed top-14 left-0 right-0 z-30 flex justify-center gap-2 py-2" style={{ background: COLORS.background }}>
        {["vendeur_simple", "revendeur_officiel"].map((n) => (
          <button
            key={n}
            onClick={() => setNiveau(n)}
            className="text-[10px] px-3 py-1 rounded-full"
            style={{
              background: niveau === n ? COLORS.accentPrimary : COLORS.surface,
              color: niveau === n ? COLORS.background : COLORS.textMuted,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            {n === "vendeur_simple" ? "Vue vendeur simple" : "Vue revendeur officiel"}
          </button>
        ))}
      </div>

      <main className="max-w-md mx-auto w-full px-4 pt-24 pb-24">
        {/* ONGLET APERCU */}
        {tab === "apercu" && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <p className="text-[11px]" style={{ color: COLORS.textMuted }}>Ventes totales</p>
                <p className="text-lg font-bold" style={{ color: COLORS.accentPrimary }}>{statsVendeur.nbVentes ?? 0}</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <p className="text-[11px]" style={{ color: COLORS.textMuted }}>Commandes en cours</p>
                <p className="text-lg font-bold" style={{ color: COLORS.accentPrimary }}>
                  {commandes.filter((c) => ["en_attente", "paye", "expedie"].includes(c.statut)).length}
                </p>
              </div>
              <div className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center gap-1">
                  <Star size={12} color={COLORS.accentSecondary} fill={COLORS.accentSecondary} />
                  <p className="text-[11px]" style={{ color: COLORS.textMuted }}>Note moyenne</p>
                </div>
                <p className="text-lg font-bold" style={{ color: COLORS.textPrimary }}>{statsVendeur.note || "—"}</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center gap-1">
                  <Clock size={12} color={COLORS.accentSecondary} />
                  <p className="text-[11px]" style={{ color: COLORS.textMuted }}>Réactivité</p>
                </div>
                <p className="text-sm font-bold" style={{ color: COLORS.textPrimary }}>
                  {statsVendeur.tempsReponse ? `< ${statsVendeur.tempsReponse} min` : "—"}
                </p>
              </div>
            </div>

            {niveau === "revendeur_officiel" && (
              <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.accentPrimary}` }}>
                <TrendingUp size={18} color={COLORS.accentPrimary} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold">Mise en avant active</p>
                  <p className="text-[11px]" style={{ color: COLORS.textMuted }}>
                    Votre boutique apparaît actuellement dans "Vendeurs recommandés" — 340 vues cette semaine.
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <p className="text-xs font-semibold mb-1">Alertes</p>
              <p className="text-[11px]" style={{ color: COLORS.textMuted }}>1 produit refusé · 2 messages non lus</p>
            </div>
          </div>
        )}

        {/* ONGLET PRODUITS */}
        {tab === "produits" && (
          <div className="flex flex-col gap-3" style={{ "--sk1": theme === "sombre" ? "#1a2740" : "#eef1f5", "--sk2": theme === "sombre" ? "#26375a" : "#dde3ea" }}>
            {!chargement && (
              <Link
                href="/produit/nouveau"
                className="rounded-xl py-2.5 font-semibold flex items-center justify-center gap-2 text-sm"
                style={{ background: COLORS.accentPrimary, color: COLORS.background }}
              >
                <Plus size={16} /> Ajouter un produit
              </Link>
            )}
            <p className="text-[11px]" style={{ color: COLORS.textMuted }}>
              Chaque produit nécessite une preuve (photo réelle / facture) et une validation manuelle avant publication.
            </p>

            {chargement && (
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-xl p-3 flex items-center gap-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                    <div className="tekca-skeleton rounded-lg flex-shrink-0" style={{ width: 44, height: 44 }} />
                    <div className="flex-1">
                      <div className="tekca-skeleton rounded-md mb-1.5" style={{ height: 10, width: "70%" }} />
                      <div className="tekca-skeleton rounded-md" style={{ height: 8, width: "40%" }} />
                    </div>
                  </div>
                ))}
              </>
            )}

            {erreurProduits && !chargement && (
              <div className="tekca-shake rounded-xl p-4" style={{ background: theme === "sombre" ? "rgba(178,58,46,0.12)" : "rgba(178,58,46,0.08)", border: "1px solid #B23A2E" }}>
                <p className="text-sm font-semibold" style={{ color: "#B23A2E" }}>Impossible de charger tes produits</p>
                <p className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>Vérifie ta connexion et réessaie.</p>
                <button
                  onClick={chargerProduits}
                  className="w-full rounded-lg py-2.5 mt-3 text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: COLORS.accentPrimary, color: COLORS.background }}
                >
                  Réessayer
                </button>
              </div>
            )}

            {!chargement && !erreurProduits && produits.length === 0 && (
              <div className="flex flex-col items-center text-center py-10 rounded-xl" style={{ background: COLORS.surface, border: `1px dashed ${COLORS.border}` }}>
                <Package size={26} color={COLORS.textMuted} />
                <p className="text-sm font-semibold mt-3">Aucun produit pour l'instant</p>
                <p className="text-xs mt-1 px-6" style={{ color: COLORS.textMuted }}>Ajoute ton premier produit pour commencer à vendre sur TEKÇA.</p>
                <Link
                  href="/produit/nouveau"
                  className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                  style={{ background: COLORS.accentPrimary, color: COLORS.background }}
                >
                  <Plus size={14} /> Ajouter un produit
                </Link>
              </div>
            )}

            {!chargement && !erreurProduits && produits.map((p) => (
              <div key={p.nom} className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{p.nom}</p>
                    <p className="text-[11px]" style={{ color: COLORS.textMuted }}>Stock : {p.stock}</p>
                  </div>
                  <StatutBadge COLORS={COLORS} statut={p.statut} />
                </div>
                {p.statut === "valide" && (
                  <button
                    onClick={() => setModalBoost(p.nom)}
                    className="mt-2 text-[11px] font-semibold flex items-center gap-1"
                    style={{ color: COLORS.accentPrimary }}
                  >
                    <Rocket size={12} /> Booster cette annonce
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ONGLET COMMANDES */}
        {tab === "commandes" && (
          <div className="flex flex-col gap-3">
            {commandes.map((c) => (
              <div key={c.id} className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{c.id}</p>
                  <StatutBadge COLORS={COLORS} statut={c.statut} />
                </div>
                <p className="text-[11px] mt-1" style={{ color: COLORS.textMuted }}>{c.client} · {c.montant}</p>
                {["paye", "expedie"].includes(c.statut) && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={codesInput[c.id] || ""}
                      onChange={(e) => setCodesInput((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      placeholder="Code à 6 caractères du client"
                      maxLength={6}
                      className="flex-1 rounded-lg px-2 py-1.5 text-xs"
                      style={{ background: COLORS.background, border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary }}
                    />
                    <button
                      onClick={() => validerCode(c.id)}
                      disabled={validationEnCours === c.id || !codesInput[c.id]}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-lg"
                      style={{ background: COLORS.accentPrimary, color: COLORS.background }}
                    >
                      {validationEnCours === c.id ? "..." : "Valider"}
                    </button>
                  </div>
                )}
                {messagesValidation[c.id] && (
                  <p className="text-[11px] mt-1" style={{ color: messagesValidation[c.id].type === "erreur" ? "#B23A2E" : COLORS.accentSecondary }}>
                    {messagesValidation[c.id].texte}
                  </p>
                )}
                {niveau === "revendeur_officiel" && (
                  <button className="text-[11px] mt-2 flex items-center gap-1" style={{ color: COLORS.accentPrimary }}>
                    <Truck size={12} /> Suivi livraison plateforme
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ONGLET MESSAGES */}
        {tab === "messages" && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <div>
                <p className="text-xs font-semibold">Réponse automatique par l'IA</p>
                <p className="text-[11px]" style={{ color: COLORS.textMuted }}>L'IA répond à votre place si vous êtes absent</p>
              </div>
              <input type="checkbox" className="w-4 h-4" />
            </div>
            <div className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <p className="text-sm font-semibold">Naomie K.</p>
              <p className="text-[11px] mt-1" style={{ color: COLORS.textMuted }}>"Bonjour, la manette est encore dispo ?"</p>
            </div>
          </div>
        )}

        {/* ONGLET STATS — premium (revendeur officiel) */}
        {tab === "stats" && (
          niveau === "revendeur_officiel" ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <p className="text-xs font-semibold mb-2">Évolution des ventes</p>
                <div className="h-24 rounded-lg" style={{ background: COLORS.background }} />
              </div>
              <div className="rounded-xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <p className="text-xs font-semibold mb-1">Taux de conversion</p>
                <p className="text-lg font-bold" style={{ color: COLORS.accentPrimary }}>6,4 %</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-6 flex flex-col items-center text-center gap-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <Lock size={22} color={COLORS.textMuted} />
              <p className="text-sm font-semibold">Statistiques avancées</p>
              <p className="text-[11px]" style={{ color: COLORS.textMuted }}>
                Disponible uniquement pour les revendeurs officiels.
              </p>
            </div>
          )
        )}

        {/* ONGLET PAIEMENTS */}
        {tab === "paiements" && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <p className="text-xs font-semibold mb-2">Prestataire de paiement</p>
              <select
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
              >
                <option>Sebpay</option>
                <option>CinetPay</option>
                <option>Autre</option>
              </select>
            </div>
            <div className="rounded-xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <p className="text-xs font-semibold mb-1">Prélèvements plateforme</p>
              <p className="text-[11px]" style={{ color: COLORS.textMuted }}>
                {niveau === "revendeur_officiel" ? "Abonnement + commission hybride" : "Commission simple"}
              </p>
            </div>
          </div>
        )}

        {/* ONGLET PARAMETRES */}
        {tab === "parametres" && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <p className="text-xs font-semibold mb-2">Sous-domaine</p>
              <p className="text-sm" style={{ color: COLORS.accentSecondary }}>{statsVendeur.nomBoutique ? `${statsVendeur.nomBoutique.toLowerCase().replace(/\s+/g, "-")}.plateforme.com` : "—"}</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <p className="text-xs font-semibold mb-1">Politique livraison/retours</p>
              <p className="text-[11px]" style={{ color: COLORS.textMuted }}>
                Définie par la plateforme, identique pour tous les vendeurs (lecture seule).
              </p>
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM TABS */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex justify-around py-2 overflow-x-auto"
        style={{ background: COLORS.background, borderTop: `1px solid ${COLORS.border}` }}
      >
        {TABS.map(({ id, label, icon: Icon, premiumOnly }) => {
          const active = tab === id;
          const locked = premiumOnly && niveau !== "revendeur_officiel";
          return (
            <button key={id} onClick={() => setTab(id)} className="flex flex-col items-center gap-1 px-1">
              <Icon size={18} color={active ? COLORS.accentPrimary : locked ? COLORS.border : COLORS.textMuted} />
              <span className="text-[9px]" style={{ color: active ? COLORS.accentPrimary : COLORS.textMuted }}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* MODAL BOOST — options payantes façon Vinted */}
      {modalBoost && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center gap-2 mb-2">
              <Rocket size={20} color={COLORS.accentPrimary} />
              <p className="font-bold text-base">Booster "{modalBoost}"</p>
            </div>
            <p className="text-sm mb-4" style={{ color: COLORS.textMuted }}>
              Mets ton annonce en tête des recherches pendant une durée donnée.
            </p>
            <div className="flex flex-col gap-2 mb-4">
              {[
                { duree: "24h", prix: "500 FCFA" },
                { duree: "3 jours", prix: "1 200 FCFA" },
                { duree: "7 jours", prix: "2 500 FCFA" },
              ].map((b) => (
                <button
                  key={b.duree}
                  onClick={() => setModalBoost(null)}
                  className="rounded-xl p-3 flex items-center justify-between"
                  style={{ background: COLORS.background, border: `1px solid ${COLORS.border}` }}
                >
                  <span className="text-sm font-semibold">{b.duree}</span>
                  <span className="text-sm" style={{ color: COLORS.accentPrimary }}>{b.prix}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setModalBoost(null)}
              className="w-full text-center text-xs py-2"
              style={{ color: COLORS.textMuted }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
