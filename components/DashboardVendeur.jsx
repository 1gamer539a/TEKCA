"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Package, ShoppingBag, MessageSquare, BarChart3,
  CreditCard, Settings, Plus, Upload, Sun, Moon, Bell, TrendingUp,
  Star, Clock, ShieldCheck, Truck, Lock, Rocket, Trash2, KeyRound, ArrowLeft
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";

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
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [niveau, setNiveau] = useState(null);
  const [tab, setTab] = useState("apercu");
  const [modalBoost, setModalBoost] = useState(null);
  const [produitASupprimer, setProduitASupprimer] = useState(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [vendeurId, setVendeurId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [nbNotifsNonLues, setNbNotifsNonLues] = useState(0);
  const [conversations, setConversations] = useState([]);
  const [chargementConversations, setChargementConversations] = useState(false);
  const [produits, setProduits] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [ouvertureConversation, setOuvertureConversation] = useState(null);
  const [statsVendeur, setStatsVendeur] = useState({ nomBoutique: "", note: 0, nbVentes: 0, tempsReponse: null });
  const [chargement, setChargement] = useState(true);
  const [erreurProduits, setErreurProduits] = useState(false);
  const [codesInput, setCodesInput] = useState({});
  const [validationEnCours, setValidationEnCours] = useState(null);
  const [messagesValidation, setMessagesValidation] = useState({});
  const [enPause, setEnPause] = useState(false);
  const [messagePause, setMessagePause] = useState("");
  const [enregistrementPause, setEnregistrementPause] = useState(false);
  const COLORS = THEMES[theme];

  // ============================================================
  // COFFRE-FORT NUMÉRIQUE — stock de codes pour les produits
  // digitaux (recharge_jeu / abonnement_service / ebook / template
  // avec via_coffre_fort = true). Chargé à la demande, seulement
  // quand l'onglet est ouvert, pas au chargement initial du dashboard.
  // ============================================================
  const [chargementCoffreFort, setChargementCoffreFort] = useState(false);
  const [produitsDigitaux, setProduitsDigitaux] = useState([]);
  const [vueCoffreFort, setVueCoffreFort] = useState("stock"); // 'stock' | 'historique' | 'ajouter'
  const [produitCoffreFortActif, setProduitCoffreFortActif] = useState(null);
  const [historiqueCodes, setHistoriqueCodes] = useState([]);
  const [produitAjoutId, setProduitAjoutId] = useState("");
  const [codeManuel, setCodeManuel] = useState("");
  const [ajoutCodeEnCours, setAjoutCodeEnCours] = useState(false);
  const [texteImport, setTexteImport] = useState("");
  const [apercuImport, setApercuImport] = useState(null); // { total, doublons }
  const [importEnCours, setImportEnCours] = useState(false);
  const [messageCoffreFort, setMessageCoffreFort] = useState(null);

  const chargerCoffreFort = async () => {
    if (!vendeurId) return;
    setChargementCoffreFort(true);
    try {
      const { data: produitsData } = await supabase
        .from("produits")
        .select("id, nom, prix_base")
        .eq("vendeur_id", vendeurId)
        .eq("via_coffre_fort", true)
        .order("date_creation", { ascending: false });

      const ids = (produitsData || []).map((p) => p.id);
      if (ids.length === 0) {
        setProduitsDigitaux([]);
        return;
      }

      const { data: codesData } = await supabase
        .from("codes_coffre_fort")
        .select("produit_id, statut")
        .in("produit_id", ids);

      const { data: avisData } = await supabase
        .from("avis")
        .select("note, commandes ( produit_id )")
        .eq("vendeur_id", vendeurId);

      const parProduit = {};
      (produitsData || []).forEach((p) => {
        parProduit[p.id] = { ...p, disponible: 0, vendu: 0, notes: [] };
      });
      (codesData || []).forEach((c) => {
        if (!parProduit[c.produit_id]) return;
        if (c.statut === "disponible") parProduit[c.produit_id].disponible += 1;
        else parProduit[c.produit_id].vendu += 1;
      });
      (avisData || []).forEach((a) => {
        const pid = a.commandes?.produit_id;
        if (pid && parProduit[pid]) parProduit[pid].notes.push(a.note);
      });

      setProduitsDigitaux(
        Object.values(parProduit).map((p) => ({
          ...p,
          noteMoyenne: p.notes.length ? (p.notes.reduce((s, n) => s + n, 0) / p.notes.length).toFixed(1) : null,
          nbAvis: p.notes.length,
        }))
      );
    } finally {
      setChargementCoffreFort(false);
    }
  };

  useEffect(() => {
    if (tab === "coffre_fort" && vendeurId) chargerCoffreFort();
  }, [tab, vendeurId]);

  const ouvrirHistorique = async (produit) => {
    setProduitCoffreFortActif(produit);
    setVueCoffreFort("historique");
    const { data } = await supabase
      .from("codes_coffre_fort")
      .select("id, code, statut, date_vente")
      .eq("produit_id", produit.id)
      .order("date_creation", { ascending: false });
    setHistoriqueCodes(data || []);
  };

  const ajouterCodeUnitaire = async () => {
    if (!codeManuel.trim() || !produitAjoutId) return;
    setAjoutCodeEnCours(true);
    setMessageCoffreFort(null);
    const { error } = await supabase
      .from("codes_coffre_fort")
      .insert({ produit_id: produitAjoutId, code: codeManuel.trim() });
    setAjoutCodeEnCours(false);
    if (error) {
      setMessageCoffreFort({ type: "erreur", texte: error.code === "23505" ? "Ce code existe déjà pour ce produit." : "Erreur lors de l'ajout." });
      return;
    }
    setCodeManuel("");
    setMessageCoffreFort({ type: "succes", texte: "Code ajouté." });
    chargerCoffreFort();
  };

  const analyserImport = (texte) => {
    const lignes = texte.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const uniques = [...new Set(lignes)];
    setApercuImport({ total: uniques.length, doublons: lignes.length - uniques.length });
  };

  const lireFichierImport = (fichier) => {
    const lecteur = new FileReader();
    lecteur.onload = (e) => {
      const texte = e.target.result;
      setTexteImport(texte);
      analyserImport(texte);
    };
    lecteur.readAsText(fichier);
  };

  const importerCodesEnMasse = async () => {
    if (!produitAjoutId || !texteImport.trim()) return;
    setImportEnCours(true);
    setMessageCoffreFort(null);
    const lignes = texteImport.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const uniques = [...new Set(lignes)];
    const lignesInsert = uniques.map((code) => ({ produit_id: produitAjoutId, code }));
    // ignoreDuplicates : si un code existe déjà pour ce produit (contrainte
    // unique produit_id+code), il est silencieusement ignoré plutôt que de
    // faire échouer tout l'import — cohérent avec "doublons ignorés" affiché
    // à l'aperçu.
    const { error, count } = await supabase
      .from("codes_coffre_fort")
      .upsert(lignesInsert, { onConflict: "produit_id,code", ignoreDuplicates: true, count: "exact" });
    setImportEnCours(false);
    if (error) {
      setMessageCoffreFort({ type: "erreur", texte: "Erreur lors de l'import." });
      return;
    }
    setMessageCoffreFort({ type: "succes", texte: `${count ?? uniques.length} code(s) importé(s).` });
    setTexteImport("");
    setApercuImport(null);
    chargerCoffreFort();
  };

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


  const [annulationEnCours, setAnnulationEnCours] = useState(null);
  const annulerCommande = async (commandeId) => {
    setAnnulationEnCours(commandeId);
    const { data: { session } } = await supabase.auth.getSession();
    const reponse = await fetch(`/api/commandes/${commandeId}/annuler`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (reponse.ok) {
      setCommandes((prev) => prev.map((c) => (c.id === commandeId ? { ...c, statut: "annule" } : c)));
    }
    setAnnulationEnCours(null);
  };

  useEffect(() => {
    chargerDashboard();
  }, []);

  const supprimerProduit = async (id) => {
    setSuppressionEnCours(true);
    const { error } = await supabase.from("produits").delete().eq("id", id);
    setSuppressionEnCours(false);
    if (!error) {
      setProduits((prev) => prev.filter((p) => p.id !== id));
      setProduitASupprimer(null);
    }
  };

  // CORRECTIF — l'onglet Messages affichait une conversation fictive
  // codée en dur ("Naomie K.") au lieu des vraies conversations : un
  // vendeur ne voyait jamais les messages réellement envoyés par les
  // acheteurs. Chargées dès que l'id du vendeur est connu.
  useEffect(() => {
    if (!vendeurId) return;
    const chargerConversations = async () => {
      setChargementConversations(true);
      const { data } = await supabase
        .from("conversations")
        .select("id, date_creation, users:client_id ( nom ), messages_chat ( contenu, date_creation, lu, expediteur_id )")
        .eq("vendeur_id", vendeurId)
        .order("date_creation", { ascending: false });

      const listes = (data || []).map((c) => {
        const messagesTries = [...(c.messages_chat || [])].sort((a, b) => new Date(b.date_creation) - new Date(a.date_creation));
        const dernier = messagesTries[0];
        const nonLus = (c.messages_chat || []).filter((m) => !m.lu && m.expediteur_id !== userId).length;
        return {
          id: c.id,
          client: c.users?.nom || "Client",
          dernierMessage: dernier?.contenu || "Nouvelle conversation",
          nonLus,
        };
      });
      setConversations(listes);
      setChargementConversations(false);
    };
    chargerConversations();
  }, [vendeurId]);

  // Heartbeat de présence — signale que le vendeur est actif sur
  // l'app, pour le badge "En ligne" affiché sur son profil public.
  // Calculé à la lecture (voir BoutiqueVendeur.jsx), pas ici : on se
  // contente d'écrire l'horodatage.
  useEffect(() => {
    const envoyerPresence = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      fetch("/api/vendeur/presence", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {});
    };
    envoyerPresence();
    const intervalle = setInterval(envoyerPresence, 60000);
    return () => clearInterval(intervalle);
  }, []);

  // Ouvre le fil de discussion lié à l'acheteur d'une commande — s'il
  // existe déjà une conversation avec lui (il a peut-être déjà
  // écrit), on y va directement (lecture directe, autorisée par RLS).
  // Sinon on en crée une via la route serveur dédiée (l'insertion
  // client-side est bloquée pour un vendeur, voir
  // /api/messages/demarrer-vendeur).
  const ouvrirConversationCommande = async (commande) => {
    setOuvertureConversation(commande.id);
    try {
      const { data: existante } = await supabase
        .from("conversations")
        .select("id")
        .eq("client_id", commande.client)
        .eq("vendeur_id", vendeurId)
        .maybeSingle();

      if (existante) {
        router.push(`/messages/${existante.id}`);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const reponse = await fetch("/api/messages/demarrer-vendeur", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ clientId: commande.client }),
      });
      const data = await reponse.json();
      if (!reponse.ok) throw new Error(data.error);
      router.push(`/messages/${data.conversationId}`);
    } catch {
      setOuvertureConversation(null);
    }
  };

  const basculerPause = async () => {
    setEnregistrementPause(true);
    const nouvelEtat = !enPause;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const reponse = await fetch("/api/vendeur/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ enPause: nouvelEtat, messagePause }),
      });
      if (!reponse.ok) throw new Error();
      setEnPause(nouvelEtat);
    } catch {
      // état inchangé si l'appel échoue — pas de mise à jour optimiste
    } finally {
      setEnregistrementPause(false);
    }
  };

  const chargerDashboard = async () => {
      setChargement(true);
      setErreurProduits(false);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setChargement(false); return; }
        setUserId(user.id);

        const { count } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("lu", false);
        setNbNotifsNonLues(count || 0);

        const { data: vendeur } = await supabase
          .from("vendeurs")
          .select("id, nom_boutique, niveau, note_moyenne, nb_ventes, temps_reponse_moyen_minutes, en_pause, message_pause")
          .eq("user_id", user.id)
          .single();

        if (!vendeur) { setChargement(false); return; }

        setVendeurId(vendeur.id);
        setNiveau(vendeur.niveau);
        setEnPause(vendeur.en_pause || false);
        setMessagePause(vendeur.message_pause || "");
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
          .select("id, montant_total, statut, client_id, users:client_id ( nom )")
          .eq("vendeur_id", vendeur.id)
          .order("date_creation", { ascending: false })
          .limit(20);

        if (commandesData) {
          setCommandes(commandesData.map((c) => ({
            id: c.id,
            client: c.client_id,
            clientNom: c.users?.nom || "Client",
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
    { id: "coffre_fort", label: "Coffre-fort", icon: KeyRound },
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
          <Link href="/notifications" className="relative" aria-label="Notifications">
            <Bell size={18} color={COLORS.accentSecondary} />
            {nbNotifsNonLues > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full text-[9px] font-bold"
                style={{ width: 15, height: 15, background: "#B23A2E", color: "#fff" }}
              >
                {nbNotifsNonLues > 9 ? "9+" : nbNotifsNonLues}
              </span>
            )}
          </Link>
          <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
            {theme === "sombre" ? <Sun size={18} color={COLORS.accentSecondary} /> : <Moon size={18} color={COLORS.accentSecondary} />}
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-24">
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
                  onClick={chargerDashboard}
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
              <div key={p.id} className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{p.nom}</p>
                    <p className="text-[11px]" style={{ color: COLORS.textMuted }}>Stock : {p.stock}</p>
                  </div>
                  <StatutBadge COLORS={COLORS} statut={p.statut} />
                </div>
                <div className="flex items-center gap-3 mt-2">
                  {p.statut === "valide" && (
                    <button
                      onClick={() => setModalBoost(p.nom)}
                      className="text-[11px] font-semibold flex items-center gap-1"
                      style={{ color: COLORS.accentPrimary }}
                    >
                      <Rocket size={12} /> Booster cette annonce
                    </button>
                  )}
                  <button
                    onClick={() => setProduitASupprimer(p)}
                    className="text-[11px] font-semibold flex items-center gap-1"
                    style={{ color: "#B23A2E" }}
                  >
                    <Trash2 size={12} /> Supprimer
                  </button>
                </div>
                {produitASupprimer?.id === p.id && (
                  <div className="rounded-lg p-2.5 mt-2" style={{ background: COLORS.background, border: `1px solid ${COLORS.border}` }}>
                    <p className="text-[11px]" style={{ color: COLORS.textMuted }}>Supprimer "{p.nom}" définitivement ?</p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => setProduitASupprimer(null)}
                        className="flex-1 rounded-lg py-1.5 text-[11px] font-semibold"
                        style={{ color: COLORS.textMuted }}
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => supprimerProduit(p.id)}
                        disabled={suppressionEnCours}
                        className="flex-1 rounded-lg py-1.5 text-[11px] font-semibold"
                        style={{ background: "#B23A2E", color: "white" }}
                      >
                        {suppressionEnCours ? "..." : "Confirmer"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ONGLET COFFRE-FORT NUMÉRIQUE */}
        {tab === "coffre_fort" && (
          <div className="flex flex-col gap-3">
            {chargementCoffreFort && (
              <p className="text-sm text-center py-10" style={{ color: COLORS.textMuted }}>Chargement...</p>
            )}

            {!chargementCoffreFort && vueCoffreFort === "stock" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                    <p className="text-[11px]" style={{ color: COLORS.textMuted }}>Codes en stock</p>
                    <p className="text-lg font-bold" style={{ color: COLORS.accentPrimary }}>
                      {produitsDigitaux.reduce((s, p) => s + p.disponible, 0)}
                    </p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                    <p className="text-[11px]" style={{ color: COLORS.textMuted }}>Codes vendus</p>
                    <p className="text-lg font-bold" style={{ color: COLORS.accentPrimary }}>
                      {produitsDigitaux.reduce((s, p) => s + p.vendu, 0)}
                    </p>
                  </div>
                </div>

                <p className="text-[11px] font-semibold uppercase mt-1" style={{ color: COLORS.textMuted }}>Stock par produit</p>

                {produitsDigitaux.length === 0 && (
                  <div className="rounded-xl p-4 text-center" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                    <p className="text-xs" style={{ color: COLORS.textMuted }}>
                      Aucun produit digital pour l'instant. Crée un produit de type "Recharge de jeu", "Abonnement", "Ebook" ou "Template" pour l'alimenter ici.
                    </p>
                  </div>
                )}

                {produitsDigitaux.map((p) => {
                  const label = p.disponible === 0 ? "Épuisé" : p.disponible <= 5 ? `${p.disponible} dispo` : `${p.disponible} dispo`;
                  const color = p.disponible === 0 ? "#B23A2E" : p.disponible <= 5 ? "#C99A3A" : "#3A8A5C";
                  return (
                    <button
                      key={p.id}
                      onClick={() => ouvrirHistorique(p)}
                      className="rounded-xl p-3 text-left"
                      style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{p.nom}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: COLORS.background, color, border: `1px solid ${COLORS.border}` }}>
                          {label}
                        </span>
                      </div>
                      <p className="text-[11px] mt-1" style={{ color: COLORS.textMuted }}>
                        {p.vendu} vendus{p.noteMoyenne ? ` · ${p.noteMoyenne}★ (${p.nbAvis} avis)` : " · pas encore d'avis"}
                      </p>
                    </button>
                  );
                })}

                <button
                  onClick={() => { setVueCoffreFort("ajouter"); setMessageCoffreFort(null); }}
                  className="w-full rounded-xl py-3 flex items-center justify-center gap-2 text-sm font-semibold mt-1"
                  style={{ background: COLORS.accentPrimary, color: COLORS.background }}
                >
                  <Plus size={16} /> Ajouter du stock
                </button>
              </>
            )}

            {!chargementCoffreFort && vueCoffreFort === "historique" && produitCoffreFortActif && (
              <>
                <button
                  onClick={() => setVueCoffreFort("stock")}
                  className="flex items-center gap-1 text-xs font-semibold mb-1"
                  style={{ color: COLORS.textMuted }}
                >
                  <ArrowLeft size={14} /> Retour
                </button>
                <p className="text-sm font-bold">Historique — {produitCoffreFortActif.nom}</p>
                {historiqueCodes.length === 0 && (
                  <p className="text-xs py-6 text-center" style={{ color: COLORS.textMuted }}>Aucun code enregistré pour ce produit.</p>
                )}
                {historiqueCodes.map((c) => (
                  <div key={c.id} className="rounded-xl p-3 flex items-center justify-between" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                    <span className="text-sm font-mono">{c.code}</span>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: COLORS.background, color: c.statut === "vendu" ? COLORS.textMuted : "#3A8A5C", border: `1px solid ${COLORS.border}` }}
                    >
                      {c.statut === "vendu" ? `Vendu · ${new Date(c.date_vente).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}` : "Disponible"}
                    </span>
                  </div>
                ))}
                <p className="text-[11px] text-center mt-1" style={{ color: COLORS.textMuted }}>
                  Chaque code n'est montré qu'une fois — jamais réutilisable après une vente.
                </p>
              </>
            )}

            {vueCoffreFort === "ajouter" && (
              <>
                <button
                  onClick={() => { setVueCoffreFort("stock"); setMessageCoffreFort(null); }}
                  className="flex items-center gap-1 text-xs font-semibold mb-1"
                  style={{ color: COLORS.textMuted }}
                >
                  <ArrowLeft size={14} /> Retour
                </button>
                <p className="text-sm font-bold mb-1">Ajouter du stock</p>

                <div>
                  <p className="text-[11px] font-semibold mb-1" style={{ color: COLORS.textMuted }}>Produit concerné</p>
                  <select
                    value={produitAjoutId}
                    onChange={(e) => setProduitAjoutId(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: COLORS.surface, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                  >
                    <option value="">Choisir un produit</option>
                    {produitsDigitaux.map((p) => (
                      <option key={p.id} value={p.id}>{p.nom}</option>
                    ))}
                  </select>
                </div>

                {messageCoffreFort && (
                  <p className="text-xs" style={{ color: messageCoffreFort.type === "erreur" ? "#B23A2E" : "#3A8A5C" }}>
                    {messageCoffreFort.texte}
                  </p>
                )}

                <div className="rounded-xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                  <p className="text-xs font-semibold mb-2">Ajout manuel</p>
                  <input
                    value={codeManuel}
                    onChange={(e) => setCodeManuel(e.target.value)}
                    placeholder="Ex: FF-8X2K-9QRT"
                    className="w-full rounded-lg px-3 py-2 text-sm mb-2"
                    style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                  />
                  <button
                    onClick={ajouterCodeUnitaire}
                    disabled={!produitAjoutId || !codeManuel.trim() || ajoutCodeEnCours}
                    className="w-full rounded-xl py-2.5 text-sm font-semibold"
                    style={{ background: COLORS.accentPrimary, color: COLORS.background, opacity: !produitAjoutId || !codeManuel.trim() ? 0.5 : 1 }}
                  >
                    {ajoutCodeEnCours ? "..." : "Ajouter ce code"}
                  </button>
                </div>

                <div className="rounded-xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                  <p className="text-xs font-semibold mb-1">Import en masse</p>
                  <p className="text-[11px] mb-2" style={{ color: COLORS.textMuted }}>Fichier .csv ou .txt — un code par ligne.</p>
                  <label
                    className="flex flex-col items-center justify-center gap-1 rounded-xl py-6 cursor-pointer"
                    style={{ background: COLORS.background, border: `1px dashed ${COLORS.border}` }}
                  >
                    <Upload size={18} color={COLORS.textMuted} />
                    <span className="text-[11px]" style={{ color: COLORS.textMuted }}>Glisser un fichier ou cliquer pour importer</span>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && lireFichierImport(e.target.files[0])}
                    />
                  </label>
                  {apercuImport && (
                    <p className="text-[11px] mt-2" style={{ color: COLORS.textMuted }}>
                      Aperçu : {apercuImport.total} codes détectés{apercuImport.doublons > 0 ? `, ${apercuImport.doublons} doublons ignorés.` : "."}
                    </p>
                  )}
                  <button
                    onClick={importerCodesEnMasse}
                    disabled={!produitAjoutId || !texteImport.trim() || importEnCours}
                    className="w-full rounded-xl py-2.5 text-sm font-semibold mt-3"
                    style={{ background: COLORS.accentPrimary, color: COLORS.background, opacity: !produitAjoutId || !texteImport.trim() ? 0.5 : 1 }}
                  >
                    {importEnCours ? "Import..." : apercuImport ? `Importer ${apercuImport.total} codes` : "Importer"}
                  </button>
                </div>
              </>
            )}
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
                <p className="text-[11px] mt-1" style={{ color: COLORS.textMuted }}>{c.clientNom} · {c.montant}</p>
                <button
                  onClick={() => ouvrirConversationCommande(c)}
                  disabled={ouvertureConversation === c.id}
                  className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: COLORS.background, color: COLORS.accentPrimary, border: `1px solid ${COLORS.border}` }}
                >
                  <MessageSquare size={12} />
                  {ouvertureConversation === c.id ? "Ouverture..." : `Répondre à ${c.clientNom}`}
                </button>
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
                {c.statut === "paye" && (
                  <button
                    onClick={() => annulerCommande(c.id)}
                    disabled={annulationEnCours === c.id}
                    className="text-[11px] mt-2 font-semibold"
                    style={{ color: "#B23A2E" }}
                  >
                    {annulationEnCours === c.id ? "Annulation..." : "Annuler la commande"}
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

            {chargementConversations && (
              <p className="text-xs text-center py-6" style={{ color: COLORS.textMuted }}>Chargement...</p>
            )}
            {!chargementConversations && conversations.length === 0 && (
              <p className="text-sm text-center py-10" style={{ color: COLORS.textMuted }}>Aucun message pour l'instant.</p>
            )}
            {conversations.map((c) => (
              <Link
                key={c.id}
                href={`/messages/${c.id}`}
                className="rounded-xl p-3 flex items-center justify-between gap-2"
                style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{c.client}</p>
                  <p className="text-[11px] mt-1 truncate" style={{ color: COLORS.textMuted }}>{c.dernierMessage}</p>
                </div>
                {c.nonLus > 0 && (
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: COLORS.accentPrimary, color: COLORS.background }}>
                    {c.nonLus}
                  </span>
                )}
              </Link>
            ))}
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold">Boutique {enPause ? "en pause" : "ouverte"}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: COLORS.textMuted }}>
                    En pause, tu ne reçois plus de nouvelles commandes.
                  </p>
                </div>
                <button
                  onClick={basculerPause}
                  disabled={enregistrementPause}
                  className="w-12 h-7 rounded-full flex items-center px-0.5 flex-shrink-0"
                  style={{ background: enPause ? "#B23A2E" : COLORS.accentPrimary, justifyContent: enPause ? "flex-end" : "flex-start" }}
                  aria-label="Basculer la pause de la boutique"
                >
                  <span className="w-6 h-6 rounded-full" style={{ background: COLORS.background }} />
                </button>
              </div>
              {enPause && (
                <input
                  value={messagePause}
                  onChange={(e) => setMessagePause(e.target.value)}
                  onBlur={basculerPause}
                  placeholder="Ex: Fermé temporairement, de retour lundi"
                  className="w-full mt-3 rounded-lg px-3 py-2 text-xs outline-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                />
              )}
            </div>
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
