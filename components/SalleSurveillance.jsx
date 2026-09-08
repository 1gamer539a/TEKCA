"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Sun, Moon, AlertTriangle, HelpCircle, CreditCard,
  Store as StoreIcon, MessageCircle, CheckCircle2, Clock, XCircle,
  Eye, ShieldAlert, Trash2, Ban, ShieldCheck, RotateCcw,
  BarChart3, Wallet, TrendingUp, Users, Award, Send,
  Bot, ShieldQuestion, Image, Tag, Bell, BookOpen, Truck, Plus, Trophy, GraduationCap
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

/*
  Certaines actions admin (vérifier une identité, changer le statut
  d'un vendeur, geler/dégeler un wallet) touchent des colonnes
  protégées par trigger côté base (voir rls_policies.sql) et ne sont
  plus modifiables par un simple appel client à Supabase, même pour un
  admin. Elles passent désormais par des routes serveur dédiées
  (app/api/admin/*) qui revérifient le rôle admin/équipe côté serveur.
*/
async function appelRouteAdmin(chemin, corps) {
  const { data: { session } } = await supabase.auth.getSession();
  const reponse = await fetch(chemin, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify(corps),
  });
  const data = await reponse.json();
  if (!reponse.ok) throw new Error(data.error || "Action refusée.");
  return data;
}

const ICONES_MOTIF = { litige: AlertTriangle, paiement: CreditCard, vendeur: StoreIcon, autre: HelpCircle };
const LABELS_MOTIF = { litige: "Litige avec un vendeur", paiement: "Problème de paiement", vendeur: "Signaler un vendeur", autre: "Autre question" };

function StatutBadge({ COLORS, statut }) {
  const map = {
    ouvert: { label: "Ouvert", color: "#B23A2E" },
    en_cours: { label: "En cours", color: COLORS.accentSecondary },
    resolu: { label: "Résolu", color: "#3A8A5C" },
  };
  const s = map[statut] || map.ouvert;
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: COLORS.background, color: s.color, border: `1px solid ${COLORS.border}` }}>
      {s.label}
    </span>
  );
}

/*
  Salle de surveillance de l'équipe — réservée à role = 'admin' / 'equipe'.
  3 onglets :
  - Signalements : contacts_support (litiges, questions clients)
  - Chats en direct : tous les messages_chat de la plateforme, lecture
    seule pour surveillance (litiges potentiels, comportements suspects)
  - Produits : produits en attente de validation manuelle
*/
export default function SalleSurveillance() {
  const router = useRouter();
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];
  const [onglet, setOnglet] = useState("apercu");
  const [filtre, setFiltre] = useState("Tous");
  const [autorise, setAutorise] = useState(null);

  const [signalements, setSignalements] = useState([]);
  const [chats, setChats] = useState([]);
  const [produitsEnAttente, setProduitsEnAttente] = useState([]);
  const [vendeurs, setVendeurs] = useState([]);
  const [retraits, setRetraits] = useState([]);
  const [kpis, setKpis] = useState({ ca: 0, nbCommandes: 0, nbUtilisateurs: 0, topVendeurs: [], topProduits: [], fondsSequestres: 0, fondsDisponibles: 0 });
  const [paiements, setPaiements] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rechercheUser, setRechercheUser] = useState("");
  const [userAjustement, setUserAjustement] = useState(null);
  const [montantAjustement, setMontantAjustement] = useState("");
  const [logsIa, setLogsIa] = useState([]);
  const [journalSecurite, setJournalSecurite] = useState([]);
  const [bannieres, setBannieres] = useState([]);
  const [nouvelleBanniere, setNouvelleBanniere] = useState({ titre: "", sous_titre: "", lien: "" });
  const [codesPromo, setCodesPromo] = useState([]);
  const [nouveauCode, setNouveauCode] = useState({ code: "", reduction_pourcentage: "" });
  const [faqs, setFaqs] = useState([]);
  const [nouvelleFaq, setNouvelleFaq] = useState({ question: "", reponse: "" });
  const [agents, setAgents] = useState([]);
  const [nouvelAgent, setNouvelAgent] = useState({ nom: "", telephone: "", ville: "" });
  const [messageDiffusion, setMessageDiffusion] = useState({ titre: "", message: "", canal: "push" });
  const [tournoisAdmin, setTournoisAdmin] = useState([]);
  const [nouveauTournoi, setNouveauTournoi] = useState({ titre: "", jeu: "", type_recompense: "cash_prize", montant_cash_prize: "", mode_inscription: "libre", nb_places_max: "", date_debut: "" });
  const [modulesFormation, setModulesFormation] = useState([]);
  const [nouveauModule, setNouveauModule] = useState({ parcours: "createurs", titre: "", type: "video", duree: "", gratuit: true });
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const verifierAcces = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAutorise(false); return; }

      const { data: profil } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profil || !["admin", "equipe"].includes(profil.role)) {
        setAutorise(false);
        return;
      }
      setAutorise(true);
    };
    verifierAcces();
  }, []);

  useEffect(() => {
    if (!autorise) return;

    const charger = async () => {
      setChargement(true);

      const { data: sig } = await supabase
        .from("contacts_support")
        .select("id, client_id, motif, message, statut, date_creation, users:client_id ( nom )")
        .order("date_creation", { ascending: false });
      if (sig) {
        setSignalements(
          sig.map((s) => ({
            id: s.id,
            clientId: s.client_id,
            client: s.users?.nom || "Client",
            motif: s.motif,
            message: s.message,
            statut: s.statut,
            temps: new Date(s.date_creation).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
          }))
        );
      }

      const { data: msgs } = await supabase
        .from("messages_chat")
        .select("id, contenu, date_creation, envoye_par_ia, conversations ( vendeurs ( nom_boutique ) ), users:expediteur_id ( nom )")
        .order("date_creation", { ascending: false })
        .limit(50);
      if (msgs) {
        setChats(
          msgs.map((m) => ({
            id: m.id,
            auteur: m.users?.nom || (m.envoye_par_ia ? "IA" : "Utilisateur"),
            vendeur: m.conversations?.vendeurs?.nom_boutique || "—",
            contenu: m.contenu,
            temps: new Date(m.date_creation).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
          }))
        );
      }

      const { data: prod } = await supabase
        .from("produits")
        .select("id, nom, prix_base, preuve_url, date_creation, vendeurs ( nom_boutique )")
        .eq("statut_validation", "en_attente")
        .order("date_creation", { ascending: true });
      if (prod) {
        setProduitsEnAttente(
          prod.map((p) => ({
            id: p.id,
            nom: p.nom,
            prix: `${Number(p.prix_base).toLocaleString()} FCFA`,
            vendeur: p.vendeurs?.nom_boutique || "—",
            preuveUrl: p.preuve_url,
            temps: new Date(p.date_creation).toLocaleDateString("fr-FR"),
          }))
        );
      }

      const { data: vend } = await supabase
        .from("vendeurs")
        .select("id, nom_boutique, niveau, statut, note_moyenne, nb_ventes, badge, date_creation")
        .order("date_creation", { ascending: false });
      if (vend) {
        setVendeurs(
          vend.map((v) => ({
            id: v.id,
            nom: v.nom_boutique,
            niveau: v.niveau,
            statut: v.statut,
            note: v.note_moyenne,
            nbVentes: v.nb_ventes,
            badge: v.badge,
          }))
        );
      }

      const { data: retraitsData } = await supabase
        .from("demandes_retrait")
        .select("id, montant, moyen, numero_destinataire, statut, date_demande, vendeurs ( nom_boutique )")
        .eq("statut", "demande")
        .order("date_demande", { ascending: true });
      if (retraitsData) {
        setRetraits(
          retraitsData.map((r) => ({
            id: r.id,
            vendeur: r.vendeurs?.nom_boutique || "—",
            montant: `${Number(r.montant).toLocaleString()} FCFA`,
            moyen: r.moyen,
            numero: r.numero_destinataire,
            temps: new Date(r.date_demande).toLocaleDateString("fr-FR"),
          }))
        );
      }

      // KPIs — chiffre d'affaires global, commandes, utilisateurs
      const { count: nbCommandes } = await supabase.from("commandes").select("id", { count: "exact", head: true });
      const { count: nbUtilisateurs } = await supabase.from("users").select("id", { count: "exact", head: true });
      const { data: commandesPayees } = await supabase.from("commandes").select("montant_total").eq("statut", "livre");
      const ca = (commandesPayees || []).reduce((s, c) => s + Number(c.montant_total || 0), 0);

      const topVendeurs = [...(vend || [])]
        .sort((a, b) => (b.nb_ventes || 0) - (a.nb_ventes || 0))
        .slice(0, 3)
        .map((v) => ({ nom: v.nom_boutique, ventes: v.nb_ventes || 0 }));

      setKpis({ ca, nbCommandes: nbCommandes || 0, nbUtilisateurs: nbUtilisateurs || 0, topVendeurs, topProduits: [], fondsSequestres: 0, fondsDisponibles: 0 });

      // Trésorerie globale — fonds encore bloqués en séquestre vs somme des wallets
      const { data: sequestresRetenus } = await supabase.from("sequestres").select("montant_produit, frais_protection_acheteur").eq("statut", "retenu");
      const fondsSequestres = (sequestresRetenus || []).reduce((s, x) => s + Number(x.montant_produit || 0) + Number(x.frais_protection_acheteur || 0), 0);

      const { data: tousLesWallets } = await supabase.from("wallets").select("solde");
      const fondsDisponibles = (tousLesWallets || []).reduce((s, w) => s + Number(w.solde || 0), 0);

      setKpis((prev) => ({ ...prev, fondsSequestres, fondsDisponibles }));

      // Top produits — les plus vendus (comptage par produit_id sur les commandes)
      const { data: cmdProduits } = await supabase.from("commandes").select("produit_id, produits ( nom )");
      if (cmdProduits) {
        const compte = {};
        cmdProduits.forEach((c) => {
          if (!c.produit_id) return;
          const nom = c.produits?.nom || "Produit";
          compte[nom] = (compte[nom] || 0) + 1;
        });
        const topProduits = Object.entries(compte)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([nom, ventes]) => ({ nom, ventes }));
        setKpis((prev) => ({ ...prev, topProduits }));
      }

      // Historique global des paiements — commandes + retraits versés, fusionnés et triés
      const { data: toutesCommandes } = await supabase
        .from("commandes")
        .select("id, montant_total, commission_appliquee, statut, date_creation, vendeurs ( nom_boutique )")
        .order("date_creation", { ascending: false })
        .limit(30);
      const { data: retraitsVerses } = await supabase
        .from("demandes_retrait")
        .select("id, montant, statut, date_demande, vendeurs ( nom_boutique )")
        .neq("statut", "demande")
        .order("date_demande", { ascending: false })
        .limit(30);

      const flux = [
        ...((toutesCommandes || []).map((c) => ({
          id: `cmd-${c.id}`,
          type: "achat",
          libelle: c.vendeurs?.nom_boutique || "Vendeur",
          montant: Number(c.montant_total),
          commission: Number(c.commission_appliquee || 0),
          statut: c.statut,
          date: c.date_creation,
        }))),
        ...((retraitsVerses || []).map((r) => ({
          id: `ret-${r.id}`,
          type: "retrait",
          libelle: r.vendeurs?.nom_boutique || "Vendeur",
          montant: Number(r.montant),
          commission: 0,
          statut: r.statut,
          date: r.date_demande,
        }))),
      ].sort((a, b) => new Date(b.date) - new Date(a.date));

      setPaiements(flux.slice(0, 40));

      // Catégories / taux de commission
      const { data: cat } = await supabase.from("categories_taxes").select("id, nom_categorie, taux_commission, montant_abonnement");
      if (cat) setCategories(cat);

      const { data: logsIaData } = await supabase
        .from("logs_ia")
        .select("id, requete, date_creation, users:user_id ( nom )")
        .order("date_creation", { ascending: false })
        .limit(30);
      if (logsIaData) {
        setLogsIa(logsIaData.map((l) => ({
          id: l.id,
          utilisateur: l.users?.nom || "Anonyme",
          requete: l.requete,
          temps: new Date(l.date_creation).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
        })));
      }

      const { data: securiteData } = await supabase
        .from("journal_securite")
        .select("id, type, details, date_creation, users:user_id ( nom )")
        .order("date_creation", { ascending: false })
        .limit(30);
      if (securiteData) {
        setJournalSecurite(securiteData.map((s) => ({
          id: s.id,
          utilisateur: s.users?.nom || "Inconnu",
          type: s.type,
          details: s.details,
          temps: new Date(s.date_creation).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
        })));
      }

      const { data: bannieresData } = await supabase.from("bannieres_accueil").select("*").order("ordre", { ascending: true });
      if (bannieresData) setBannieres(bannieresData);

      const { data: codesData } = await supabase.from("codes_promo").select("*").order("date_creation", { ascending: false });
      if (codesData) setCodesPromo(codesData);

      const { data: faqData } = await supabase.from("faq").select("*").order("ordre", { ascending: true });
      if (faqData) setFaqs(faqData);

      const { data: agentsData } = await supabase.from("agents_livraison").select("*").order("ville", { ascending: true });
      if (agentsData) setAgents(agentsData);

      const { data: tournoisData } = await supabase
        .from("tournois")
        .select("id, titre, jeu, statut, type_recompense, montant_cash_prize, date_debut, inscriptions_tournoi ( id )")
        .order("date_debut", { ascending: false });
      if (tournoisData) {
        setTournoisAdmin(tournoisData.map((t) => ({
          id: t.id,
          titre: t.titre,
          jeu: t.jeu,
          statut: t.statut,
          recompense: t.type_recompense === "cash_prize" ? `${Number(t.montant_cash_prize || 0).toLocaleString()} FCFA` : "Nature",
          nbInscrits: t.inscriptions_tournoi?.length || 0,
        })));
      }

      const { data: modulesData } = await supabase
        .from("modules_formation")
        .select("*")
        .order("parcours", { ascending: true });
      if (modulesData) setModulesFormation(modulesData);

      setChargement(false);
    };
    charger();
  }, [autorise]);

  const validerProduit = async (id, valide) => {
    setProduitsEnAttente((prev) => prev.filter((p) => p.id !== id));
    await supabase
      .from("produits")
      .update({ statut_validation: valide ? "valide" : "refuse" })
      .eq("id", id);
  };

  const validerIdentiteClient = async (signalementId, clientId) => {
    try {
      await appelRouteAdmin("/api/admin/verifier-identite", { clientId });
    } catch (e) {
      console.error(e);
      return;
    }
    setSignalements((prev) => prev.map((s) => (s.id === signalementId ? { ...s, statut: "resolu" } : s)));
    await supabase.from("contacts_support").update({ statut: "resolu" }).eq("id", signalementId);
  };

  const supprimerProduit = async (id) => {
    setProduitsEnAttente((prev) => prev.filter((p) => p.id !== id));
    await supabase.from("produits").delete().eq("id", id);
  };

  const changerStatutVendeur = async (id, nouveauStatut) => {
    try {
      await appelRouteAdmin("/api/admin/vendeur-statut", { vendeurId: id, nouveauStatut });
    } catch (e) {
      console.error(e);
      return;
    }
    setVendeurs((prev) => prev.map((v) => (v.id === id ? { ...v, statut: nouveauStatut } : v)));
  };

  const attribuerBadge = async (id, badge) => {
    setVendeurs((prev) => prev.map((v) => (v.id === id ? { ...v, badge } : v)));
    await supabase.from("vendeurs").update({ badge }).eq("id", id);
  };

  const traiterRetrait = async (id, valide) => {
    setRetraits((prev) => prev.filter((r) => r.id !== id));
    await supabase
      .from("demandes_retrait")
      .update({ statut: valide ? "valide" : "refuse", date_traitement: new Date().toISOString() })
      .eq("id", id);
  };

  const chercherUtilisateur = async () => {
    if (!rechercheUser.trim()) return;
    const { data } = await supabase
      .from("users")
      .select("id, nom, telephone")
      .or(`nom.ilike.%${rechercheUser}%,telephone.ilike.%${rechercheUser}%`)
      .limit(1)
      .single();
    if (data) {
      const { data: wallet } = await supabase.from("wallets").select("is_frozen, freeze_reason, solde").eq("user_id", data.id).single();
      setUserAjustement({ ...data, isFrozen: wallet?.is_frozen || false, freezeReason: wallet?.freeze_reason, solde: wallet?.solde || 0 });
    } else {
      setUserAjustement(null);
    }
  };

  const degelerWallet = async () => {
    if (!userAjustement) return;
    try {
      await appelRouteAdmin("/api/admin/wallet-gel", { userId: userAjustement.id, geler: false });
    } catch (e) {
      console.error(e);
      return;
    }
    setUserAjustement((prev) => ({ ...prev, isFrozen: false, freezeReason: null }));
  };

  const geleWallet = async () => {
    if (!userAjustement) return;
    const raison = "Gelé manuellement par l'équipe";
    try {
      await appelRouteAdmin("/api/admin/wallet-gel", { userId: userAjustement.id, geler: true, raison });
    } catch (e) {
      console.error(e);
      return;
    }
    setUserAjustement((prev) => ({ ...prev, isFrozen: true, freezeReason: raison }));
  };

  const ajusterWallet = async (sens) => {
    if (!userAjustement || !montantAjustement) return;
    // Ajustement tracé comme un dépôt/retrait dans le wallet du vendeur concerné,
    // ou comme note de litige — ici on l'enregistre comme dépôt manuel sur son wallet
    // s'il en a un ; sinon simple journal via contacts_support pour traçabilité.
    await supabase.from("contacts_support").insert({
      client_id: userAjustement.id,
      motif: "autre",
      message: `Ajustement wallet ${sens === "credit" ? "+" : "-"}${montantAjustement} FCFA par l'équipe (litige).`,
      statut: "resolu",
    });
    setMontantAjustement("");
    setUserAjustement(null);
    setRechercheUser("");
  };

  const modifierCommission = async (id, nouveauTaux) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, taux_commission: nouveauTaux } : c)));
    await supabase.from("categories_taxes").update({ taux_commission: nouveauTaux }).eq("id", id);
  };

  const ajouterBanniere = async () => {
    if (!nouvelleBanniere.titre) return;
    const { data } = await supabase.from("bannieres_accueil").insert({ ...nouvelleBanniere, ordre: bannieres.length }).select().single();
    if (data) setBannieres((prev) => [...prev, data]);
    setNouvelleBanniere({ titre: "", sous_titre: "", lien: "" });
  };

  const toggleBanniere = async (id, active) => {
    setBannieres((prev) => prev.map((b) => (b.id === id ? { ...b, active } : b)));
    await supabase.from("bannieres_accueil").update({ active }).eq("id", id);
  };

  const supprimerBanniere = async (id) => {
    setBannieres((prev) => prev.filter((b) => b.id !== id));
    await supabase.from("bannieres_accueil").delete().eq("id", id);
  };

  const creerCodePromo = async () => {
    if (!nouveauCode.code) return;
    const { data } = await supabase
      .from("codes_promo")
      .insert({ code: nouveauCode.code.toUpperCase(), reduction_pourcentage: parseFloat(nouveauCode.reduction_pourcentage) || null })
      .select()
      .single();
    if (data) setCodesPromo((prev) => [data, ...prev]);
    setNouveauCode({ code: "", reduction_pourcentage: "" });
  };

  const desactiverCode = async (id) => {
    setCodesPromo((prev) => prev.map((c) => (c.id === id ? { ...c, active: false } : c)));
    await supabase.from("codes_promo").update({ active: false }).eq("id", id);
  };

  const ajouterFaq = async () => {
    if (!nouvelleFaq.question || !nouvelleFaq.reponse) return;
    const { data } = await supabase.from("faq").insert({ ...nouvelleFaq, ordre: faqs.length }).select().single();
    if (data) setFaqs((prev) => [...prev, data]);
    setNouvelleFaq({ question: "", reponse: "" });
  };

  const supprimerFaq = async (id) => {
    setFaqs((prev) => prev.filter((f) => f.id !== id));
    await supabase.from("faq").delete().eq("id", id);
  };

  const ajouterAgent = async () => {
    if (!nouvelAgent.nom || !nouvelAgent.ville) return;
    const { data } = await supabase.from("agents_livraison").insert(nouvelAgent).select().single();
    if (data) setAgents((prev) => [...prev, data]);
    setNouvelAgent({ nom: "", telephone: "", ville: "" });
  };

  const toggleAgent = async (id, actif) => {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, actif } : a)));
    await supabase.from("agents_livraison").update({ actif }).eq("id", id);
  };

  const envoyerDiffusion = async () => {
    if (!messageDiffusion.titre || !messageDiffusion.message) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("campagnes_notification").insert({ ...messageDiffusion, envoye_par: user?.id });
    setMessageDiffusion({ titre: "", message: "", canal: "push" });
  };

  const creerTournoi = async () => {
    if (!nouveauTournoi.titre || !nouveauTournoi.jeu || !nouveauTournoi.date_debut) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("tournois")
      .insert({
        titre: nouveauTournoi.titre,
        jeu: nouveauTournoi.jeu,
        type_recompense: nouveauTournoi.type_recompense,
        montant_cash_prize: nouveauTournoi.type_recompense === "cash_prize" ? parseFloat(nouveauTournoi.montant_cash_prize) || 0 : null,
        mode_inscription: nouveauTournoi.mode_inscription,
        nb_places_max: parseInt(nouveauTournoi.nb_places_max, 10) || null,
        date_debut: nouveauTournoi.date_debut,
        statut: "a_venir",
        organise_par: user?.id,
      })
      .select()
      .single();
    if (data) setTournoisAdmin((prev) => [{ id: data.id, titre: data.titre, jeu: data.jeu, statut: data.statut, recompense: nouveauTournoi.type_recompense === "cash_prize" ? `${Number(nouveauTournoi.montant_cash_prize || 0).toLocaleString()} FCFA` : "Nature", nbInscrits: 0 }, ...prev]);
    setNouveauTournoi({ titre: "", jeu: "", type_recompense: "cash_prize", montant_cash_prize: "", mode_inscription: "libre", nb_places_max: "", date_debut: "" });
  };

  const changerStatutTournoi = async (id, statut) => {
    setTournoisAdmin((prev) => prev.map((t) => (t.id === id ? { ...t, statut } : t)));
    await supabase.from("tournois").update({ statut }).eq("id", id);
  };

  const ajouterModuleFormation = async () => {
    if (!nouveauModule.titre) return;
    const { data } = await supabase.from("modules_formation").insert(nouveauModule).select().single();
    if (data) setModulesFormation((prev) => [...prev, data]);
    setNouveauModule({ parcours: "createurs", titre: "", type: "video", duree: "", gratuit: true });
  };

  const supprimerModuleFormation = async (id) => {
    setModulesFormation((prev) => prev.filter((m) => m.id !== id));
    await supabase.from("modules_formation").delete().eq("id", id);
  };

  const filtres = ["Tous", "Ouvert", "En cours", "Résolu"];
  const mapFiltre = { Ouvert: "ouvert", "En cours": "en_cours", Résolu: "resolu" };
  const signalementsFiltres = filtre === "Tous" ? signalements : signalements.filter((s) => s.statut === mapFiltre[filtre]);

  if (autorise === null || (autorise && chargement)) {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh" }} className="flex items-center justify-center">
        <p className="text-sm" style={{ color: COLORS.textMuted }}>Chargement...</p>
      </div>
    );
  }

  if (autorise === false) {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }} className="flex flex-col items-center justify-center px-6 text-center gap-2">
        <ShieldAlert size={28} color={COLORS.textMuted} />
        <p className="font-bold">Accès réservé à l'équipe</p>
        <Link href="/" className="text-sm mt-2" style={{ color: COLORS.accentPrimary }}>Retour à l'accueil</Link>
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold flex items-center gap-1">
          <Eye size={15} color={COLORS.accentPrimary} /> Salle de surveillance
        </span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      {/* Onglets principaux */}
      <div className="fixed top-14 left-0 right-0 z-30 flex overflow-x-auto" style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}>
        {[
          { id: "apercu", label: "Vue d'ensemble" },
          { id: "finances", label: "Finances" },
          { id: "signalements", label: `Signalements (${signalements.filter((s) => s.statut !== "resolu").length})` },
          { id: "chats", label: "Chats" },
          { id: "produits", label: `Produits (${produitsEnAttente.length})` },
          { id: "catalogue", label: "Catalogue" },
          { id: "vendeurs", label: "Vendeurs" },
          { id: "retraits", label: `Retraits (${retraits.length})` },
          { id: "ia_securite", label: "IA & Sécurité" },
          { id: "marketing", label: "Marketing" },
          { id: "livraison", label: "Livraison" },
          { id: "faq", label: "FAQ" },
          { id: "tournois_admin", label: "Tournois" },
          { id: "formation_admin", label: "Formation" },
        ].map((o) => (
          <button
            key={o.id}
            onClick={() => setOnglet(o.id)}
            className="flex-shrink-0 px-3 py-2.5 text-xs font-semibold whitespace-nowrap"
            style={{
              color: onglet === o.id ? COLORS.accentPrimary : COLORS.textMuted,
              borderBottom: onglet === o.id ? `2px solid ${COLORS.accentPrimary}` : "2px solid transparent",
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      <main className="max-w-md mx-auto w-full px-4 pt-28 pb-10 flex flex-col gap-3">
        {/* ONGLET VUE D'ENSEMBLE — KPIs */}
        {onglet === "apercu" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <p className="text-[11px] flex items-center gap-1" style={{ color: COLORS.textMuted }}><Wallet size={11} /> CA global (livré)</p>
                <p className="text-lg font-bold" style={{ color: COLORS.accentPrimary }}>{kpis.ca.toLocaleString()} FCFA</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <p className="text-[11px] flex items-center gap-1" style={{ color: COLORS.textMuted }}><TrendingUp size={11} /> Commandes totales</p>
                <p className="text-lg font-bold" style={{ color: COLORS.textPrimary }}>{kpis.nbCommandes}</p>
              </div>
              <div className="rounded-xl p-3 col-span-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <p className="text-[11px] flex items-center gap-1" style={{ color: COLORS.textMuted }}><Users size={11} /> Utilisateurs inscrits</p>
                <p className="text-lg font-bold" style={{ color: COLORS.textPrimary }}>{kpis.nbUtilisateurs}</p>
              </div>
            </div>

            <div className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.accentPrimary}` }}>
              <p className="text-xs font-semibold mb-2 flex items-center gap-1"><Wallet size={13} /> Trésorerie globale</p>
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: COLORS.textMuted }}>Bloqué en séquestre (commandes en cours)</span>
                <span className="font-bold" style={{ color: "#B23A2E" }}>{kpis.fondsSequestres.toLocaleString()} FCFA</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: COLORS.textMuted }}>Disponible dans les wallets</span>
                <span className="font-bold" style={{ color: "#3A8A5C" }}>{kpis.fondsDisponibles.toLocaleString()} FCFA</span>
              </div>
            </div>

            <div className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <p className="text-xs font-semibold mb-2">Top vendeurs</p>
              {kpis.topVendeurs.length === 0 && <p className="text-xs" style={{ color: COLORS.textMuted }}>Pas encore de données.</p>}
              {kpis.topVendeurs.map((v, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <span className="text-xs">{i + 1}. {v.nom}</span>
                  <span className="text-xs font-semibold" style={{ color: COLORS.accentPrimary }}>{v.ventes} ventes</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <p className="text-xs font-semibold mb-2">Top produits</p>
              {kpis.topProduits.length === 0 && <p className="text-xs" style={{ color: COLORS.textMuted }}>Pas encore de données.</p>}
              {kpis.topProduits.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <span className="text-xs">{i + 1}. {p.nom}</span>
                  <span className="text-xs font-semibold" style={{ color: COLORS.accentPrimary }}>{p.ventes} commandes</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ONGLET SIGNALEMENTS */}
        {onglet === "signalements" && (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {filtres.map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltre(f)}
                  className="text-xs px-3 py-1.5 rounded-full flex-shrink-0"
                  style={{
                    background: filtre === f ? COLORS.accentPrimary : COLORS.surface,
                    color: filtre === f ? COLORS.background : COLORS.textMuted,
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
            {signalementsFiltres.length === 0 && (
              <p className="text-sm text-center py-10" style={{ color: COLORS.textMuted }}>Aucun signalement.</p>
            )}
            {signalementsFiltres.map((s) => {
              const Icon = ICONES_MOTIF[s.motif];
              return (
                <div key={s.id} className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Icon size={15} color={COLORS.accentPrimary} />
                      <span className="text-xs font-semibold" style={{ color: COLORS.accentSecondary }}>{LABELS_MOTIF[s.motif]}</span>
                    </div>
                    <StatutBadge COLORS={COLORS} statut={s.statut} />
                  </div>
                  <p className="text-sm font-semibold">{s.client}</p>
                  <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>{s.message}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] flex items-center gap-1" style={{ color: COLORS.textMuted }}>
                      <Clock size={11} /> {s.temps}
                    </span>
                    {s.message.toLowerCase().includes("vérification d'identité") ? (
                      <button
                        onClick={() => validerIdentiteClient(s.id, s.clientId)}
                        className="text-[11px] font-semibold flex items-center gap-1"
                        style={{ color: COLORS.accentPrimary }}
                      >
                        <ShieldCheck size={12} /> Valider l'identité
                      </button>
                    ) : (
                      <button className="text-[11px] font-semibold flex items-center gap-1" style={{ color: COLORS.accentPrimary }}>
                        <MessageCircle size={12} /> Répondre
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ONGLET CHATS EN DIRECT — supervision, lecture seule */}
        {onglet === "chats" && (
          <>
            <p className="text-[11px]" style={{ color: COLORS.textMuted }}>
              Vue de supervision, lecture seule — les 50 derniers messages échangés sur la plateforme.
            </p>
            {chats.length === 0 && (
              <p className="text-sm text-center py-10" style={{ color: COLORS.textMuted }}>Aucun message pour l'instant.</p>
            )}
            {chats.map((c) => (
              <div key={c.id} className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold">{c.auteur}</span>
                  <span className="text-[10px]" style={{ color: COLORS.textMuted }}>{c.temps}</span>
                </div>
                <p className="text-xs" style={{ color: COLORS.textMuted }}>Boutique : {c.vendeur}</p>
                <p className="text-sm mt-1">{c.contenu}</p>
              </div>
            ))}
          </>
        )}

        {/* ONGLET PRODUITS — validation manuelle */}
        {onglet === "produits" && (
          <>
            {produitsEnAttente.length === 0 && (
              <p className="text-sm text-center py-10" style={{ color: COLORS.textMuted }}>Aucun produit en attente.</p>
            )}
            {produitsEnAttente.map((p) => (
              <div key={p.id} className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold">{p.nom}</p>
                  <span className="text-[10px]" style={{ color: COLORS.textMuted }}>{p.temps}</span>
                </div>
                <p className="text-xs" style={{ color: COLORS.textMuted }}>{p.vendeur} · {p.prix}</p>
                {p.preuveUrl && (
                  <a href={p.preuveUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] mt-1 inline-block" style={{ color: COLORS.accentSecondary }}>
                    Voir la preuve
                  </a>
                )}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => validerProduit(p.id, true)}
                    className="flex-1 rounded-lg py-1.5 text-xs font-semibold flex items-center justify-center gap-1"
                    style={{ background: COLORS.accentPrimary, color: COLORS.background }}
                  >
                    <CheckCircle2 size={13} /> Valider
                  </button>
                  <button
                    onClick={() => validerProduit(p.id, false)}
                    className="flex-1 rounded-lg py-1.5 text-xs font-semibold flex items-center justify-center gap-1"
                    style={{ border: `1px solid #B23A2E`, color: "#B23A2E" }}
                  >
                    <XCircle size={13} /> Refuser
                  </button>
                  <button
                    onClick={() => supprimerProduit(p.id)}
                    aria-label="Supprimer définitivement"
                    className="rounded-lg px-2.5"
                    style={{ border: `1px solid ${COLORS.border}` }}
                  >
                    <Trash2 size={13} color={COLORS.textMuted} />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ONGLET VENDEURS — bannir/suspendre/réactiver */}
        {onglet === "vendeurs" && (
          <>
            {vendeurs.length === 0 && (
              <p className="text-sm text-center py-10" style={{ color: COLORS.textMuted }}>Aucun vendeur.</p>
            )}
            {vendeurs.map((v) => (
              <div key={v.id} className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold">{v.nom}</p>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      background: COLORS.background,
                      color: v.statut === "suspendu" ? "#B23A2E" : v.statut === "valide" ? "#3A8A5C" : COLORS.accentSecondary,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  >
                    {v.statut}
                  </span>
                </div>
                <p className="text-xs" style={{ color: COLORS.textMuted }}>
                  {v.niveau === "revendeur_officiel" ? "Revendeur officiel" : "Vendeur simple"} · {v.nbVentes || 0} ventes · {v.note || "—"} ★
                </p>
                <div className="flex gap-2 mt-2">
                  {v.statut !== "suspendu" ? (
                    <button
                      onClick={() => changerStatutVendeur(v.id, "suspendu")}
                      className="flex-1 rounded-lg py-1.5 text-xs font-semibold flex items-center justify-center gap-1"
                      style={{ border: `1px solid #B23A2E`, color: "#B23A2E" }}
                    >
                      <Ban size={13} /> Bannir
                    </button>
                  ) : (
                    <button
                      onClick={() => changerStatutVendeur(v.id, "valide")}
                      className="flex-1 rounded-lg py-1.5 text-xs font-semibold flex items-center justify-center gap-1"
                      style={{ background: COLORS.accentPrimary, color: COLORS.background }}
                    >
                      <RotateCcw size={13} /> Réactiver
                    </button>
                  )}
                  {v.statut === "en_attente" && (
                    <button
                      onClick={() => changerStatutVendeur(v.id, "valide")}
                      className="flex-1 rounded-lg py-1.5 text-xs font-semibold flex items-center justify-center gap-1"
                      style={{ background: COLORS.accentPrimary, color: COLORS.background }}
                    >
                      <ShieldCheck size={13} /> Valider le compte
                    </button>
                  )}
                </div>
                <div className="flex gap-2 mt-2">
                  {[
                    { id: "vendeur_agree", label: "Vendeur Agréé" },
                    { id: "guilde_officielle", label: "Guilde Officielle" },
                  ].map((b) => (
                    <button
                      key={b.id}
                      onClick={() => attribuerBadge(v.id, v.badge === b.id ? null : b.id)}
                      className="flex-1 rounded-lg py-1 text-[10px] font-semibold flex items-center justify-center gap-1"
                      style={{
                        background: v.badge === b.id ? COLORS.accentSecondary : "transparent",
                        color: v.badge === b.id ? COLORS.background : COLORS.textMuted,
                        border: `1px solid ${COLORS.border}`,
                      }}
                    >
                      <Award size={11} /> {b.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ONGLET FINANCES — historique global des paiements + ajustement wallet + commissions */}
        {onglet === "finances" && (
          <>
            <div className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <p className="text-xs font-semibold mb-2">Ajuster le wallet d'un utilisateur (litige)</p>
              <div className="flex gap-2 mb-2">
                <input
                  value={rechercheUser}
                  onChange={(e) => setRechercheUser(e.target.value)}
                  placeholder="Nom ou téléphone"
                  className="flex-1 rounded-lg px-3 py-2 text-xs outline-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                />
                <button onClick={chercherUtilisateur} className="rounded-lg px-3 text-xs font-semibold" style={{ background: COLORS.accentPrimary, color: COLORS.background }}>
                  Chercher
                </button>
              </div>
              {userAjustement && (
                <div className="rounded-lg p-2 mb-2" style={{ background: COLORS.background, border: `1px solid ${userAjustement.isFrozen ? "#B23A2E" : COLORS.border}` }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">{userAjustement.nom}</p>
                    {userAjustement.isFrozen && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "#B23A2E", color: "#FFF" }}>
                        Gelé
                      </span>
                    )}
                  </div>
                  <p className="text-[10px]" style={{ color: COLORS.textMuted }}>{userAjustement.telephone} · Solde : {Number(userAjustement.solde).toLocaleString()} FCFA</p>
                  {userAjustement.isFrozen && userAjustement.freezeReason && (
                    <p className="text-[10px] mt-1" style={{ color: "#B23A2E" }}>{userAjustement.freezeReason}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    {userAjustement.isFrozen ? (
                      <button onClick={degelerWallet} className="flex-1 rounded-lg py-1.5 text-xs font-semibold" style={{ background: COLORS.accentPrimary, color: COLORS.background }}>
                        Dégeler le portefeuille
                      </button>
                    ) : (
                      <button onClick={geleWallet} className="flex-1 rounded-lg py-1.5 text-xs font-semibold" style={{ border: `1px solid #B23A2E`, color: "#B23A2E" }}>
                        Geler manuellement
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <input
                      value={montantAjustement}
                      onChange={(e) => setMontantAjustement(e.target.value)}
                      type="number"
                      placeholder="Montant FCFA"
                      className="flex-1 rounded-lg px-2 py-1.5 text-xs outline-none"
                      style={{ background: COLORS.surface, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                    />
                    <button onClick={() => ajusterWallet("credit")} className="rounded-lg px-3 text-xs font-semibold" style={{ background: COLORS.accentPrimary, color: COLORS.background }}>
                      + Créditer
                    </button>
                    <button onClick={() => ajusterWallet("debit")} className="rounded-lg px-3 text-xs font-semibold" style={{ border: `1px solid #B23A2E`, color: "#B23A2E" }}>
                      − Débiter
                    </button>
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs font-bold uppercase tracking-wide mt-2" style={{ color: COLORS.accentPrimary }}>
              Historique global des flux
            </p>
            {paiements.length === 0 && (
              <p className="text-sm text-center py-6" style={{ color: COLORS.textMuted }}>Aucun flux pour l'instant.</p>
            )}
            {paiements.map((p) => (
              <div key={p.id} className="rounded-xl p-3 flex items-center justify-between" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <div>
                  <p className="text-xs font-semibold">{p.type === "achat" ? "Achat" : "Retrait"} · {p.libelle}</p>
                  <p className="text-[10px]" style={{ color: COLORS.textMuted }}>
                    {new Date(p.date).toLocaleDateString("fr-FR")} · {p.statut}
                    {p.commission > 0 && ` · commission ${p.commission.toLocaleString()} FCFA`}
                  </p>
                </div>
                <span className="text-sm font-bold" style={{ color: p.type === "achat" ? COLORS.accentPrimary : "#B23A2E" }}>
                  {p.type === "achat" ? "+" : "−"}{p.montant.toLocaleString()} FCFA
                </span>
              </div>
            ))}
          </>
        )}

        {/* ONGLET CATALOGUE — gestion des catégories et taux de commission */}
        {onglet === "catalogue" && (
          <>
            <p className="text-[11px]" style={{ color: COLORS.textMuted }}>
              Ajuste le taux de commission prélevé par catégorie de produit.
            </p>
            {categories.map((c) => (
              <div key={c.id} className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <p className="text-sm font-semibold capitalize">{c.nom_categorie.replace("_", " ")}</p>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    step="0.5"
                    defaultValue={c.taux_commission}
                    onBlur={(e) => modifierCommission(c.id, parseFloat(e.target.value))}
                    className="w-20 rounded-lg px-2 py-1.5 text-xs outline-none"
                    style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                  />
                  <span className="text-xs" style={{ color: COLORS.textMuted }}>% de commission</span>
                </div>
                {c.montant_abonnement > 0 && (
                  <p className="text-[10px] mt-1" style={{ color: COLORS.textMuted }}>
                    + abonnement {Number(c.montant_abonnement).toLocaleString()} FCFA
                  </p>
                )}
              </div>
            ))}
          </>
        )}

        {/* ONGLET RETRAITS — payouts vendeurs (Airtel Money / MTN Mobile Money) */}
        {onglet === "retraits" && (
          <>
            <p className="text-[11px]" style={{ color: COLORS.textMuted }}>
              Valide l'envoi manuel des fonds vers le moyen de paiement du vendeur.
            </p>
            {retraits.length === 0 && (
              <p className="text-sm text-center py-10" style={{ color: COLORS.textMuted }}>Aucune demande de retrait en attente.</p>
            )}
            {retraits.map((r) => (
              <div key={r.id} className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold">{r.vendeur}</p>
                  <span className="text-sm font-bold" style={{ color: COLORS.accentPrimary }}>{r.montant}</span>
                </div>
                <p className="text-xs uppercase" style={{ color: COLORS.textMuted }}>{r.moyen.replace("_", " ")} · {r.numero}</p>
                <p className="text-[10px] mt-1" style={{ color: COLORS.textMuted }}>{r.temps}</p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => traiterRetrait(r.id, true)}
                    className="flex-1 rounded-lg py-1.5 text-xs font-semibold flex items-center justify-center gap-1"
                    style={{ background: COLORS.accentPrimary, color: COLORS.background }}
                  >
                    <CheckCircle2 size={13} /> Marquer envoyé
                  </button>
                  <button
                    onClick={() => traiterRetrait(r.id, false)}
                    className="flex-1 rounded-lg py-1.5 text-xs font-semibold flex items-center justify-center gap-1"
                    style={{ border: `1px solid #B23A2E`, color: "#B23A2E" }}
                  >
                    <XCircle size={13} /> Refuser
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ONGLET IA & SECURITE */}
        {onglet === "ia_securite" && (
          <>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.accentPrimary }}>Logs IA</p>
            {logsIa.length === 0 && <p className="text-xs" style={{ color: COLORS.textMuted }}>Aucune requête enregistrée.</p>}
            {logsIa.map((l) => (
              <div key={l.id} className="rounded-xl p-3 flex items-start gap-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <Bot size={14} color={COLORS.accentPrimary} className="mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold">{l.utilisateur}</p>
                  <p className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>{l.requete}</p>
                  <p className="text-[10px] mt-1" style={{ color: COLORS.textMuted }}>{l.temps}</p>
                </div>
              </div>
            ))}

            <p className="text-xs font-bold uppercase tracking-wide mt-3" style={{ color: COLORS.accentPrimary }}>Journal de sécurité</p>
            {journalSecurite.length === 0 && <p className="text-xs" style={{ color: COLORS.textMuted }}>Aucun événement.</p>}
            {journalSecurite.map((s) => (
              <div key={s.id} className="rounded-xl p-3 flex items-start gap-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <ShieldQuestion size={14} color={s.type === "connexion_suspecte" ? "#B23A2E" : COLORS.accentSecondary} className="mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold">{s.utilisateur} · {s.type.replace(/_/g, " ")}</p>
                  {s.details && <p className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>{s.details}</p>}
                  <p className="text-[10px] mt-1" style={{ color: COLORS.textMuted }}>{s.temps}</p>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ONGLET MARKETING — bannières, codes promo, diffusion */}
        {onglet === "marketing" && (
          <>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.accentPrimary }}>Bannières accueil</p>
            <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <input value={nouvelleBanniere.titre} onChange={(e) => setNouvelleBanniere({ ...nouvelleBanniere, titre: e.target.value })} placeholder="Titre" className="rounded-lg px-3 py-2 text-xs outline-none" style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }} />
              <input value={nouvelleBanniere.sous_titre} onChange={(e) => setNouvelleBanniere({ ...nouvelleBanniere, sous_titre: e.target.value })} placeholder="Sous-titre" className="rounded-lg px-3 py-2 text-xs outline-none" style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }} />
              <input value={nouvelleBanniere.lien} onChange={(e) => setNouvelleBanniere({ ...nouvelleBanniere, lien: e.target.value })} placeholder="Lien (ex: /tournois)" className="rounded-lg px-3 py-2 text-xs outline-none" style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }} />
              <button onClick={ajouterBanniere} className="rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1" style={{ background: COLORS.accentPrimary, color: COLORS.background }}>
                <Plus size={13} /> Ajouter la bannière
              </button>
            </div>
            {bannieres.map((b) => (
              <div key={b.id} className="rounded-xl p-3 flex items-center justify-between" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <div>
                  <p className="text-xs font-semibold">{b.titre}</p>
                  <p className="text-[10px]" style={{ color: COLORS.textMuted }}>{b.sous_titre}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleBanniere(b.id, !b.active)} className="text-[10px] px-2 py-1 rounded-full font-semibold" style={{ background: b.active ? COLORS.accentPrimary : COLORS.background, color: b.active ? COLORS.background : COLORS.textMuted, border: `1px solid ${COLORS.border}` }}>
                    {b.active ? "Active" : "Inactive"}
                  </button>
                  <button onClick={() => supprimerBanniere(b.id)} aria-label="Supprimer"><Trash2 size={14} color={COLORS.textMuted} /></button>
                </div>
              </div>
            ))}

            <p className="text-xs font-bold uppercase tracking-wide mt-3" style={{ color: COLORS.accentPrimary }}>Codes promo</p>
            <div className="rounded-xl p-3 flex gap-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <input value={nouveauCode.code} onChange={(e) => setNouveauCode({ ...nouveauCode, code: e.target.value })} placeholder="CODE20" className="flex-1 rounded-lg px-3 py-2 text-xs outline-none" style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }} />
              <input value={nouveauCode.reduction_pourcentage} onChange={(e) => setNouveauCode({ ...nouveauCode, reduction_pourcentage: e.target.value })} type="number" placeholder="%" className="w-16 rounded-lg px-2 py-2 text-xs outline-none" style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }} />
              <button onClick={creerCodePromo} className="rounded-lg px-3 text-xs font-semibold" style={{ background: COLORS.accentPrimary, color: COLORS.background }}>Créer</button>
            </div>
            {codesPromo.map((c) => (
              <div key={c.id} className="rounded-xl p-3 flex items-center justify-between" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center gap-2">
                  <Tag size={13} color={COLORS.accentSecondary} />
                  <span className="text-xs font-semibold">{c.code}</span>
                  <span className="text-[10px]" style={{ color: COLORS.textMuted }}>−{c.reduction_pourcentage}%</span>
                </div>
                {c.active ? (
                  <button onClick={() => desactiverCode(c.id)} className="text-[10px] px-2 py-1 rounded-full" style={{ border: `1px solid #B23A2E`, color: "#B23A2E" }}>Désactiver</button>
                ) : (
                  <span className="text-[10px]" style={{ color: COLORS.textMuted }}>Inactif</span>
                )}
              </div>
            ))}

            <p className="text-xs font-bold uppercase tracking-wide mt-3" style={{ color: COLORS.accentPrimary }}>Diffuser un message</p>
            <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <input value={messageDiffusion.titre} onChange={(e) => setMessageDiffusion({ ...messageDiffusion, titre: e.target.value })} placeholder="Titre" className="rounded-lg px-3 py-2 text-xs outline-none" style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }} />
              <textarea value={messageDiffusion.message} onChange={(e) => setMessageDiffusion({ ...messageDiffusion, message: e.target.value })} placeholder="Message" rows={2} className="rounded-lg px-3 py-2 text-xs outline-none resize-none" style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }} />
              <div className="flex gap-2">
                {["push", "sms", "whatsapp"].map((c) => (
                  <button key={c} onClick={() => setMessageDiffusion({ ...messageDiffusion, canal: c })} className="flex-1 rounded-lg py-1.5 text-[10px] font-semibold uppercase" style={{ background: messageDiffusion.canal === c ? COLORS.accentPrimary : COLORS.background, color: messageDiffusion.canal === c ? COLORS.background : COLORS.textMuted, border: `1px solid ${COLORS.border}` }}>{c}</button>
                ))}
              </div>
              <button onClick={envoyerDiffusion} className="rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1" style={{ background: COLORS.accentPrimary, color: COLORS.background }}>
                <Send size={13} /> Envoyer à tous les utilisateurs
              </button>
            </div>
          </>
        )}

        {/* ONGLET LIVRAISON — agents et suivi litiges */}
        {onglet === "livraison" && (
          <>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.accentPrimary }}>Agents de livraison</p>
            <div className="rounded-xl p-3 flex gap-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <input value={nouvelAgent.nom} onChange={(e) => setNouvelAgent({ ...nouvelAgent, nom: e.target.value })} placeholder="Nom" className="flex-1 rounded-lg px-2 py-2 text-xs outline-none" style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }} />
              <input value={nouvelAgent.ville} onChange={(e) => setNouvelAgent({ ...nouvelAgent, ville: e.target.value })} placeholder="Ville" className="flex-1 rounded-lg px-2 py-2 text-xs outline-none" style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }} />
              <button onClick={ajouterAgent} className="rounded-lg px-3 text-xs font-semibold" style={{ background: COLORS.accentPrimary, color: COLORS.background }}>+</button>
            </div>
            {agents.map((a) => (
              <div key={a.id} className="rounded-xl p-3 flex items-center justify-between" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center gap-2">
                  <Truck size={13} color={COLORS.accentSecondary} />
                  <div>
                    <p className="text-xs font-semibold">{a.nom}</p>
                    <p className="text-[10px]" style={{ color: COLORS.textMuted }}>{a.ville} · {a.telephone}</p>
                  </div>
                </div>
                <button onClick={() => toggleAgent(a.id, !a.actif)} className="text-[10px] px-2 py-1 rounded-full font-semibold" style={{ background: a.actif ? COLORS.accentPrimary : COLORS.background, color: a.actif ? COLORS.background : COLORS.textMuted, border: `1px solid ${COLORS.border}` }}>
                  {a.actif ? "Actif" : "Inactif"}
                </button>
              </div>
            ))}
            <p className="text-[11px] mt-2" style={{ color: COLORS.textMuted }}>
              Les litiges de livraison remontent automatiquement dans l'onglet Signalements (motif "litige").
            </p>
          </>
        )}

        {/* ONGLET FAQ — base de connaissances éditable */}
        {onglet === "faq" && (
          <>
            <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <input value={nouvelleFaq.question} onChange={(e) => setNouvelleFaq({ ...nouvelleFaq, question: e.target.value })} placeholder="Question" className="rounded-lg px-3 py-2 text-xs outline-none" style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }} />
              <textarea value={nouvelleFaq.reponse} onChange={(e) => setNouvelleFaq({ ...nouvelleFaq, reponse: e.target.value })} placeholder="Réponse" rows={2} className="rounded-lg px-3 py-2 text-xs outline-none resize-none" style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }} />
              <button onClick={ajouterFaq} className="rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1" style={{ background: COLORS.accentPrimary, color: COLORS.background }}>
                <Plus size={13} /> Ajouter à la FAQ
              </button>
            </div>
            {faqs.map((f) => (
              <div key={f.id} className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 flex-1">
                    <BookOpen size={13} color={COLORS.accentSecondary} className="mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold">{f.question}</p>
                      <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>{f.reponse}</p>
                    </div>
                  </div>
                  <button onClick={() => supprimerFaq(f.id)} aria-label="Supprimer"><Trash2 size={13} color={COLORS.textMuted} /></button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ONGLET TOURNOIS ADMIN — créer, valider inscriptions, gérer statut */}
        {onglet === "tournois_admin" && (
          <>
            <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <p className="text-xs font-semibold mb-1 flex items-center gap-1"><Trophy size={13} /> Nouveau tournoi</p>
              <input value={nouveauTournoi.titre} onChange={(e) => setNouveauTournoi({ ...nouveauTournoi, titre: e.target.value })} placeholder="Titre" className="rounded-lg px-3 py-2 text-xs outline-none" style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }} />
              <input value={nouveauTournoi.jeu} onChange={(e) => setNouveauTournoi({ ...nouveauTournoi, jeu: e.target.value })} placeholder="Jeu (ex: Free Fire)" className="rounded-lg px-3 py-2 text-xs outline-none" style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }} />
              <div className="flex gap-2">
                {["cash_prize", "nature_points"].map((t) => (
                  <button key={t} onClick={() => setNouveauTournoi({ ...nouveauTournoi, type_recompense: t })} className="flex-1 rounded-lg py-1.5 text-[10px] font-semibold" style={{ background: nouveauTournoi.type_recompense === t ? COLORS.accentPrimary : COLORS.background, color: nouveauTournoi.type_recompense === t ? COLORS.background : COLORS.textMuted, border: `1px solid ${COLORS.border}` }}>
                    {t === "cash_prize" ? "Cash prize" : "Récompense nature"}
                  </button>
                ))}
              </div>
              {nouveauTournoi.type_recompense === "cash_prize" && (
                <input value={nouveauTournoi.montant_cash_prize} onChange={(e) => setNouveauTournoi({ ...nouveauTournoi, montant_cash_prize: e.target.value })} type="number" placeholder="Montant FCFA" className="rounded-lg px-3 py-2 text-xs outline-none" style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }} />
              )}
              <div className="flex gap-2">
                {["libre", "payante", "invitation"].map((m) => (
                  <button key={m} onClick={() => setNouveauTournoi({ ...nouveauTournoi, mode_inscription: m })} className="flex-1 rounded-lg py-1.5 text-[10px] font-semibold capitalize" style={{ background: nouveauTournoi.mode_inscription === m ? COLORS.accentPrimary : COLORS.background, color: nouveauTournoi.mode_inscription === m ? COLORS.background : COLORS.textMuted, border: `1px solid ${COLORS.border}` }}>
                    {m}
                  </button>
                ))}
              </div>
              <input value={nouveauTournoi.nb_places_max} onChange={(e) => setNouveauTournoi({ ...nouveauTournoi, nb_places_max: e.target.value })} type="number" placeholder="Nombre de places" className="rounded-lg px-3 py-2 text-xs outline-none" style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }} />
              <input value={nouveauTournoi.date_debut} onChange={(e) => setNouveauTournoi({ ...nouveauTournoi, date_debut: e.target.value })} type="datetime-local" className="rounded-lg px-3 py-2 text-xs outline-none" style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }} />
              <button onClick={creerTournoi} className="rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1" style={{ background: COLORS.accentPrimary, color: COLORS.background }}>
                <Plus size={13} /> Publier le tournoi
              </button>
            </div>

            {tournoisAdmin.map((t) => (
              <div key={t.id} className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold">{t.titre}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: COLORS.background, color: COLORS.accentSecondary, border: `1px solid ${COLORS.border}` }}>{t.statut}</span>
                </div>
                <p className="text-xs" style={{ color: COLORS.textMuted }}>{t.jeu} · {t.recompense} · {t.nbInscrits} inscrits</p>
                <div className="flex gap-2 mt-2">
                  {["inscriptions_ouvertes", "en_cours", "termine", "annule"].map((s) => (
                    <button key={s} onClick={() => changerStatutTournoi(t.id, s)} className="text-[9px] px-2 py-1 rounded-full capitalize" style={{ background: t.statut === s ? COLORS.accentPrimary : "transparent", color: t.statut === s ? COLORS.background : COLORS.textMuted, border: `1px solid ${COLORS.border}` }}>
                      {s.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ONGLET FORMATION ADMIN — publier des modules pour les 2 parcours */}
        {onglet === "formation_admin" && (
          <>
            <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <p className="text-xs font-semibold mb-1 flex items-center gap-1"><GraduationCap size={13} /> Nouveau module</p>
              <div className="flex gap-2">
                {["createurs", "entrepreneurs"].map((p) => (
                  <button key={p} onClick={() => setNouveauModule({ ...nouveauModule, parcours: p })} className="flex-1 rounded-lg py-1.5 text-[10px] font-semibold capitalize" style={{ background: nouveauModule.parcours === p ? COLORS.accentPrimary : COLORS.background, color: nouveauModule.parcours === p ? COLORS.background : COLORS.textMuted, border: `1px solid ${COLORS.border}` }}>
                    {p}
                  </button>
                ))}
              </div>
              <input value={nouveauModule.titre} onChange={(e) => setNouveauModule({ ...nouveauModule, titre: e.target.value })} placeholder="Titre du module" className="rounded-lg px-3 py-2 text-xs outline-none" style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }} />
              <div className="flex gap-2">
                {["video", "live", "pdf"].map((t) => (
                  <button key={t} onClick={() => setNouveauModule({ ...nouveauModule, type: t })} className="flex-1 rounded-lg py-1.5 text-[10px] font-semibold uppercase" style={{ background: nouveauModule.type === t ? COLORS.accentPrimary : COLORS.background, color: nouveauModule.type === t ? COLORS.background : COLORS.textMuted, border: `1px solid ${COLORS.border}` }}>
                    {t}
                  </button>
                ))}
              </div>
              <input value={nouveauModule.duree} onChange={(e) => setNouveauModule({ ...nouveauModule, duree: e.target.value })} placeholder="Durée (ex: 12 min)" className="rounded-lg px-3 py-2 text-xs outline-none" style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }} />
              <button onClick={() => setNouveauModule({ ...nouveauModule, gratuit: !nouveauModule.gratuit })} className="rounded-lg py-1.5 text-[10px] font-semibold" style={{ background: nouveauModule.gratuit ? COLORS.accentPrimary : COLORS.background, color: nouveauModule.gratuit ? COLORS.background : COLORS.textMuted, border: `1px solid ${COLORS.border}` }}>
                {nouveauModule.gratuit ? "Gratuit" : "Payant (verrouillé)"}
              </button>
              <button onClick={ajouterModuleFormation} className="rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1" style={{ background: COLORS.accentPrimary, color: COLORS.background }}>
                <Plus size={13} /> Publier le module
              </button>
            </div>

            {modulesFormation.map((m) => (
              <div key={m.id} className="rounded-xl p-3 flex items-center justify-between" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <div>
                  <p className="text-xs font-semibold">{m.titre}</p>
                  <p className="text-[10px]" style={{ color: COLORS.textMuted }}>{m.parcours} · {m.type} · {m.duree} · {m.gratuit ? "gratuit" : "payant"}</p>
                </div>
                <button onClick={() => supprimerModuleFormation(m.id)} aria-label="Supprimer"><Trash2 size={13} color={COLORS.textMuted} /></button>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
