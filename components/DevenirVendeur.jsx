"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeft, Sun, Moon, ShieldCheck, Store, Upload, Clock,
  CheckCircle2, MapPin, Phone, User, Building2, FileText, CreditCard, Lock,
  Zap, Plus, Minus
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { PAYS_SEBPAY, indicatifPourPays } from "../lib/pays";
import { villesPourPays } from "../lib/villes";
import { useTheme } from "../lib/ThemeContext";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

const CATEGORIES = ["Accessoires", "Vêtements", "Recharges de jeu", "Abonnements"];
const MAP_TYPE_CATEGORIE = {
  "Accessoires": "accessoire",
  "Vêtements": "vetement",
  "Recharges de jeu": "recharge_jeu",
  "Abonnements": "abonnement_service",
};
const FAQ_VENDEURS = [
  {
    q: "Puis-je vendre des recharges gaming (Free Fire, Robux, PUBG) ?",
    a: "Absolument ! TEKÇA est optimisé pour les vendeurs de contenus digitaux. Tu peux vendre des diamants Free Fire, des Robux, des pass ou des cartes cadeaux. La livraison des identifiants (ID joueur) ou codes se fait de manière fluide.",
  },
  {
    q: "Comment est garanti mon paiement si je livre une recharge ou un code digital ?",
    a: "Grâce à notre système de séquestre (SebPay), l'acheteur dépose l'argent avant que tu ne procèdes à la recharge. Une fois la livraison effectuée et confirmée, tes fonds sont automatiquement libérés sur ton solde vendeur. Zéro risque de fournir des diamants sans être payé.",
  },
  {
    q: "Comment retirer l'argent de mes ventes vers mon Mobile Money ?",
    a: "C'est instantané. Depuis ton tableau de bord vendeur, tu demandes un retrait vers ton Mobile Money (MTN, Airtel, etc.), tu le valides avec ton PIN secret, et l'argent arrive directement sur ton téléphone.",
  },
  {
    q: "Pourquoi la communication ne passe pas par WhatsApp ?",
    a: "Sur WhatsApp, il n'y a aucune garantie contre les arnaques. La messagerie interne chiffrée de TEKÇA est directement liée au système de séquestre pour protéger l'acheteur et le vendeur en cas de litige.",
  },
  {
    q: "Est-ce que je risque de me faire pirater mon compte ou mon solde ?",
    a: "Non. Chaque demande de retrait nécessite ton code PIN secret, et notre système inclut un journal de sécurité anti brute-force qui bloque toute tentative de saisie suspecte.",
  },
  {
    q: "Faut-il des papiers administratifs (RCCM/NIU) pour vendre ?",
    a: "Aucun papier administratif n'est exigé. Tu t'inscris gratuitement et tu peux commencer à vendre tes recharges ou articles immédiatement.",
  },
];

const MODES_REMISE = [
  { valeur: "main_propre", label: "🤝 Remise en main propre" },
  { valeur: "domicile", label: "📦 Livraison locale" },
  { valeur: "instantane", label: "⚡ Envoi digital instantané" },
];
const MODES_PHYSIQUES = ["main_propre", "domicile"];

/*
  CORRECTIF — refonte du tunnel d'inscription vendeur en 3 étapes
  claires (identité & type -> spécialité & présentation -> logistique
  & sécurité), validée sur maquette avant ce code. Les deux niveaux
  (vendeur_simple / revendeur_officiel) partagent la même structure en
  3 étapes ; le niveau "revendeur officiel" ajoute juste ses champs
  spécifiques (sous-domaine, documents, prestataire) dans l'étape la
  plus logique, sans casser le fil des 3 étapes.
*/
export default function DevenirVendeur() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const COLORS = THEMES[theme];

  const [niveau, setNiveau] = useState(null); // "vendeur_simple" | "revendeur_officiel"
  const [etape, setEtape] = useState(1); // 1, 2, 3
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  // Étape 1 — identité & type
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [pays, setPays] = useState("CG");
  const [ville, setVille] = useState("");
  const [quartier, setQuartier] = useState("");
  const [nomBoutique, setNomBoutique] = useState("");
  const [sousDomaine, setSousDomaine] = useState("");

  // Étape 2 — spécialité & présentation
  const [categoriePrincipale, setCategoriePrincipale] = useState(null);
  const [bio, setBio] = useState("");
  const [prestataire, setPrestataire] = useState("sebpay");

  // Étape 3 — logistique & sécurité
  const [modesRemise, setModesRemise] = useState([]);
  const [fichierIdentiteRecto, setFichierIdentiteRecto] = useState(null);
  const [fichierIdentiteVerso, setFichierIdentiteVerso] = useState(null);
  const [justification, setJustification] = useState("");
  const [fichierActivite, setFichierActivite] = useState(null);

  const [stats, setStats] = useState(null);
  const [faqOuverte, setFaqOuverte] = useState(null);
  const [identiteDejaVerifiee, setIdentiteDejaVerifiee] = useState(false);
  const [candidatureExistante, setCandidatureExistante] = useState(null); // { statut, dateDemande } | null
  const [verificationCandidature, setVerificationCandidature] = useState(true);

  useEffect(() => {
    const verifierIdentiteExistante = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setVerificationCandidature(false); return; }
      const { data: profil } = await supabase.from("users").select("piece_identite_verifiee").eq("id", user.id).single();
      if (profil?.piece_identite_verifiee) setIdentiteDejaVerifiee(true);

      // CORRECTIF — rien n'empêchait de renvoyer une demande en boucle
      // (spam) : un compte déjà approuvé pouvait re-candidater, et un
      // refusé pouvait retenter immédiatement. On bloque maintenant
      // selon le statut de la dernière demande.
      const { data: vendeurExistant } = await supabase
        .from("vendeurs")
        .select("statut, date_demande")
        .eq("user_id", user.id)
        .order("date_demande", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (vendeurExistant) {
        setCandidatureExistante({ statut: vendeurExistant.statut, dateDemande: vendeurExistant.date_demande });
      }
      setVerificationCandidature(false);
    };
    verifierIdentiteExistante();
  }, []);

  const HEURES_ATTENTE_APRES_REFUS = 24;
  const heuresDepuisDemande = candidatureExistante
    ? (Date.now() - new Date(candidatureExistante.dateDemande).getTime()) / 3600000
    : null;
  const enAttenteApresRefus = candidatureExistante?.statut === "refuse" && heuresDepuisDemande < HEURES_ATTENTE_APRES_REFUS;
  const candidatureBloquee =
    candidatureExistante?.statut === "valide" ||
    candidatureExistante?.statut === "en_attente" ||
    candidatureExistante?.statut === "suspendu" ||
    enAttenteApresRefus;

  useEffect(() => {
    const chargerStats = async () => {
      const { count: nbBoutiques } = await supabase
        .from("vendeurs")
        .select("id", { count: "exact", head: true })
        .eq("statut", "valide");

      const { data: villesData } = await supabase.from("vendeurs").select("ville, quartier").eq("statut", "valide");
      const zonesUniques = new Set(
        (villesData || [])
          .map((v) => [v.ville, v.quartier].filter(Boolean).join(" · "))
          .filter(Boolean)
      );

      const { data: notesData } = await supabase.from("vendeurs").select("note_moyenne").eq("statut", "valide").gt("note_moyenne", 0);
      const moyenne = notesData?.length
        ? (notesData.reduce((s, v) => s + Number(v.note_moyenne), 0) / notesData.length).toFixed(1)
        : "—";

      setStats({ boutiques: nbBoutiques || 0, zones: zonesUniques.size, note: moyenne });
    };
    chargerStats();
  }, []);

  const estOfficiel = niveau === "revendeur_officiel";
  const modePhysiqueActif = modesRemise.some((m) => MODES_PHYSIQUES.includes(m));

  const toggleModeRemise = (m) =>
    setModesRemise((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const champsManquantsEtape = (n) => {
    const manquants = [];
    if (n === 1) {
      if (!nom) manquants.push("ton nom");
      if (!telephone) manquants.push("ton téléphone");
      if (!ville) manquants.push("ta ville");
      if (estOfficiel && !nomBoutique) manquants.push("le nom de la boutique");
      if (estOfficiel && !sousDomaine) manquants.push("le sous-domaine");
    }
    if (n === 2) {
      if (!categoriePrincipale) manquants.push("ta catégorie principale");
    }
    if (n === 3) {
      if (modesRemise.length === 0) manquants.push("au moins un mode de remise");
      if (estOfficiel && !identiteDejaVerifiee && (!fichierIdentiteRecto || !fichierIdentiteVerso)) manquants.push("la pièce d'identité (recto ET verso)");
      if (estOfficiel && !justification.trim()) manquants.push("la justification de ton activité");
      if (estOfficiel && !fichierActivite) manquants.push("le justificatif d'activité");
    }
    return manquants;
  };

  const suivant = () => {
    setErreur(null);
    const manquants = champsManquantsEtape(etape);
    if (manquants.length > 0) {
      setErreur(`Il manque : ${manquants.join(", ")}.`);
      return;
    }
    setEtape((e) => e + 1);
  };

  const precedent = () => {
    setErreur(null);
    if (etape > 1) setEtape((e) => e - 1);
    else setNiveau(null);
  };

  const soumettre = async () => {
    setErreur(null);
    const manquants = champsManquantsEtape(3);
    if (manquants.length > 0) {
      setErreur(`Il manque : ${manquants.join(", ")}.`);
      return;
    }
    setEnvoiEnCours(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Tu dois être connecté.");

      // CORRECTIF — le rôle du compte n'était jamais passé à "vendeur",
      // donc "Mon compte" ne pouvait jamais savoir qu'il fallait
      // afficher "Mon dashboard vendeur" au lieu de "Devenir vendeur" —
      // le tableau de bord restait accessible par son URL directe
      // seulement, invisible dans la navigation normale.
      await supabase.from("users").update({ telephone, role: "vendeur" }).eq("id", user.id);

      const payloadCommun = {
        user_id: user.id,
        nom_boutique: estOfficiel ? nomBoutique : nom,
        niveau,
        ville,
        quartier,
        pays,
        bio: bio || null,
        categorie_principale: MAP_TYPE_CATEGORIE[categoriePrincipale] || null,
        modes_remise_defaut: modesRemise,
        visible_publiquement: true,
      };

      if (!estOfficiel) {
        const { error } = await supabase.from("vendeurs").insert({
          ...payloadCommun,
          statut: "valide", // quasi instantané, pas de vérification lourde
        });
        if (error) throw error;
      } else {
        const { data: existant } = await supabase.from("vendeurs").select("id").eq("sous_domaine", sousDomaine).single();
        if (existant) throw new Error("Ce sous-domaine est déjà utilisé, choisis-en un autre.");

        // Si l'identité a déjà été vérifiée (ex: via le portefeuille),
        // pas besoin de la redemander — ça s'applique partout.
        let urlRecto = null, urlVerso = null;
        if (fichierIdentiteRecto && fichierIdentiteVerso) {
          const cheminRecto = `${user.id}/identite-recto-${Date.now()}-${fichierIdentiteRecto.name}`;
          const { error: erreurRecto } = await supabase.storage.from("preuves").upload(cheminRecto, fichierIdentiteRecto);
          if (erreurRecto) throw erreurRecto;
          urlRecto = supabase.storage.from("preuves").getPublicUrl(cheminRecto).data.publicUrl;

          const cheminVerso = `${user.id}/identite-verso-${Date.now()}-${fichierIdentiteVerso.name}`;
          const { error: erreurVerso } = await supabase.storage.from("preuves").upload(cheminVerso, fichierIdentiteVerso);
          if (erreurVerso) throw erreurVerso;
          urlVerso = supabase.storage.from("preuves").getPublicUrl(cheminVerso).data.publicUrl;
        }

        const cheminActivite = `${user.id}/activite-${Date.now()}-${fichierActivite.name}`;
        const { error: erreurUploadActivite } = await supabase.storage.from("preuves").upload(cheminActivite, fichierActivite);
        if (erreurUploadActivite) throw erreurUploadActivite;
        const urlActivite = supabase.storage.from("preuves").getPublicUrl(cheminActivite).data.publicUrl;

        const { error: erreurVendeur } = await supabase.from("vendeurs").insert({
          ...payloadCommun,
          sous_domaine: sousDomaine,
          statut: "en_attente", // vérification rigoureuse, 72h
          mode_remuneration: "hybride",
          prestataire_paiement: prestataire,
          identite_recto_url: urlRecto,
          identite_verso_url: urlVerso,
          activite_url: urlActivite,
          justification: justification.trim(),
        });
        if (erreurVendeur) throw erreurVendeur;
      }

      setEnvoye(true);
    } catch (e) {
      setErreur(e.message || "Erreur lors de l'envoi.");
    } finally {
      setEnvoiEnCours(false);
    }
  };

  if (envoye) {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }} className="flex flex-col items-center justify-center px-6 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.accentPrimary}` }}>
          {estOfficiel ? <Clock size={22} color={COLORS.accentPrimary} /> : <CheckCircle2 size={22} color={COLORS.accentPrimary} />}
        </div>
        <p className="font-bold text-lg">{estOfficiel ? "Demande envoyée" : "Ton profil marché est prêt !"}</p>
        <p className="text-sm mt-2" style={{ color: COLORS.textMuted }}>
          {estOfficiel
            ? "Ta demande de revendeur officiel passe par une vérification rigoureuse. Réponse sous 72h."
            : "Tu peux commencer à publier des articles à vendre dès maintenant."}
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={precedent} aria-label="Retour"><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">Devenir vendeur</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      {niveau && (
        <div className="fixed top-14 left-0 right-0 z-30 px-4 pt-3" style={{ background: COLORS.background }}>
          <div className="flex gap-1.5">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex-1 h-1 rounded-full" style={{ background: n <= etape ? COLORS.accentPrimary : COLORS.border }} />
            ))}
          </div>
          <p className="text-[11px] font-semibold mt-2" style={{ color: COLORS.textMuted }}>
            ÉTAPE {etape}/3 — {etape === 1 ? "Identité & type" : etape === 2 ? "Spécialité & présentation" : "Logistique & sécurité"}
          </p>
        </div>
      )}

      <main className={`max-w-md mx-auto w-full px-4 pb-10 flex flex-col gap-4 ${niveau ? "pt-28" : "pt-20"}`}>
        {!niveau && verificationCandidature && (
          <p className="text-xs text-center py-10" style={{ color: COLORS.textMuted }}>Vérification de ton compte...</p>
        )}

        {!niveau && !verificationCandidature && candidatureBloquee && (
          <div className="rounded-2xl p-4 text-center" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            {candidatureExistante.statut === "valide" && (
              <>
                <CheckCircle2 size={24} color={COLORS.accentPrimary} className="mx-auto mb-2" />
                <p className="text-sm font-bold">Tu as déjà une boutique active</p>
                <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>Gère-la depuis ton tableau de bord vendeur.</p>
              </>
            )}
            {candidatureExistante.statut === "en_attente" && (
              <>
                <Clock size={24} color={COLORS.accentPrimary} className="mx-auto mb-2" />
                <p className="text-sm font-bold">Ta demande est déjà en cours de traitement</p>
                <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>Réponse sous 72h — inutile d'en renvoyer une autre.</p>
              </>
            )}
            {candidatureExistante.statut === "suspendu" && (
              <>
                <ShieldCheck size={24} color="#B23A2E" className="mx-auto mb-2" />
                <p className="text-sm font-bold">Ton compte vendeur est suspendu</p>
                <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>Contacte le support pour en savoir plus.</p>
              </>
            )}
            {enAttenteApresRefus && (
              <>
                <Clock size={24} color="#B23A2E" className="mx-auto mb-2" />
                <p className="text-sm font-bold">Ta dernière demande a été refusée</p>
                <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
                  Tu peux renvoyer une nouvelle demande dans {Math.ceil(HEURES_ATTENTE_APRES_REFUS - heuresDepuisDemande)}h.
                </p>
              </>
            )}
          </div>
        )}

        {!niveau && !verificationCandidature && !candidatureBloquee && (
          <div className="flex flex-col gap-3">
            <p className="text-xs" style={{ color: COLORS.textMuted }}>
              Tu peux changer de formule plus tard si besoin.
            </p>
            <button
              onClick={() => setNiveau("vendeur_simple")}
              className="rounded-2xl p-4 text-left transition active:opacity-70 active:scale-[0.98]"
              style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Store size={20} color={COLORS.accentPrimary} />
                <span className="text-base font-bold">Vendeur individuel</span>
              </div>
              <p className="text-xs" style={{ color: COLORS.textMuted }}>
                Revente occasion, gaming, objets... Nom, téléphone, ville — c'est tout.
                Publication quasi instantanée.
              </p>
            </button>
            <button
              onClick={() => setNiveau("revendeur_officiel")}
              className="rounded-2xl p-4 text-left transition active:opacity-70 active:scale-[0.98]"
              style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
            >
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={20} color={COLORS.accentPrimary} />
                <span className="text-base font-bold">Boutique établie</span>
              </div>
              <p className="text-xs" style={{ color: COLORS.textMuted }}>
                Partenariat sérieux : boutique dédiée, clients apportés par la plateforme,
                mise en avant. Vérification rigoureuse de ton identité et de ton activité.
              </p>
            </button>

            {/* Preuve sociale — chiffres réels, pas décoratifs */}
            {stats && (
              <div className="rounded-2xl p-5 grid grid-cols-2 gap-5 mt-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <div className="text-center">
                  <p className="text-2xl font-extrabold" style={{ color: COLORS.accentPrimary }}>{stats.boutiques}</p>
                  <p className="text-[11px] font-semibold mt-1" style={{ color: COLORS.textMuted }}>boutiques créées</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-extrabold" style={{ color: COLORS.accentPrimary }}>{stats.zones}</p>
                  <p className="text-[11px] font-semibold mt-1" style={{ color: COLORS.textMuted }}>villes & quartiers couverts</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-extrabold" style={{ color: COLORS.accentPrimary }}>
                    {stats.note}{stats.note !== "—" && <span className="text-sm" style={{ color: COLORS.textMuted }}>/5</span>}
                  </p>
                  <p className="text-[11px] font-semibold mt-1" style={{ color: COLORS.textMuted }}>note moyenne vendeurs</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-extrabold" style={{ color: COLORS.accentPrimary }}>100%</p>
                  <p className="text-[11px] font-semibold mt-1" style={{ color: COLORS.textMuted }}>sous séquestre sécurisé</p>
                </div>
              </div>
            )}

            {/* Badges de réassurance */}
            <div className="flex gap-2 mt-1">
              <div className="flex-1 rounded-xl p-2.5 text-center" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <Lock size={16} color={COLORS.accentPrimary} className="mx-auto" />
                <p className="text-[9px] font-bold mt-1" style={{ color: COLORS.textMuted }}>SÉQUESTRE SÉCURISÉ</p>
              </div>
              <div className="flex-1 rounded-xl p-2.5 text-center" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <Zap size={16} color={COLORS.accentPrimary} className="mx-auto" />
                <p className="text-[9px] font-bold mt-1" style={{ color: COLORS.textMuted }}>RETRAIT INSTANTANÉ</p>
              </div>
              <div className="flex-1 rounded-xl p-2.5 text-center" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <Store size={16} color={COLORS.accentPrimary} className="mx-auto" />
                <p className="text-[9px] font-bold mt-1" style={{ color: COLORS.textMuted }}>FAIT POUR LE GAMING</p>
              </div>
            </div>

            {/* FAQ vendeurs */}
            <p className="text-xs font-bold uppercase tracking-wide mt-3" style={{ color: COLORS.textMuted }}>Questions fréquentes</p>
            <div className="flex flex-col gap-2">
              {FAQ_VENDEURS.map((item, i) => {
                const ouverte = faqOuverte === i;
                return (
                  <div key={i} className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                    <button
                      onClick={() => setFaqOuverte(ouverte ? null : i)}
                      className="w-full flex items-center justify-between gap-2 text-left"
                    >
                      <span className="text-xs font-bold">{item.q}</span>
                      {ouverte ? <Minus size={14} color={COLORS.accentPrimary} /> : <Plus size={14} color={COLORS.accentPrimary} />}
                    </button>
                    {ouverte && <p className="text-[11.5px] mt-2" style={{ color: COLORS.textMuted }}>{item.a}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= ÉTAPE 1 — Identité & type ================= */}
        {niveau && etape === 1 && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              {estOfficiel && (
                <div>
                  <label className="text-xs font-semibold flex items-center gap-1 mb-1"><Building2 size={12} /> Nom de la boutique</label>
                  <input
                    value={nomBoutique}
                    onChange={(e) => setNomBoutique(e.target.value)}
                    placeholder="Ex: Kivu Gaming Store"
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-semibold flex items-center gap-1 mb-1"><User size={12} /> {estOfficiel ? "Ton nom" : "Nom / pseudo public"}</label>
                <input
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Ton nom ou pseudo public"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold flex items-center gap-1 mb-1"><Phone size={12} /> Téléphone</label>
                <input
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  placeholder={`${indicatifPourPays(pays)} 06 000 00 00`}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Pays</label>
                <select
                  value={pays}
                  onChange={(e) => { setPays(e.target.value); setVille(""); }}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                >
                  {PAYS_SEBPAY.map((p) => (
                    <option key={p.code} value={p.code}>{p.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold flex items-center gap-1 mb-1"><MapPin size={12} /> Ville</label>
                <input
                  value={ville}
                  onChange={(e) => setVille(e.target.value)}
                  placeholder="Brazzaville, Pointe-Noire..."
                  list="villes-suggestions"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                />
                <datalist id="villes-suggestions">
                  {villesPourPays(pays).map((v) => <option key={v} value={v} />)}
                </datalist>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Quartier</label>
                <input
                  value={quartier}
                  onChange={(e) => setQuartier(e.target.value)}
                  placeholder="Ex: Bacongo, Poto-Poto..."
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                />
              </div>
              {estOfficiel && (
                <div>
                  <label className="text-xs font-semibold block mb-1">Sous-domaine souhaité</label>
                  <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
                    <input
                      value={sousDomaine}
                      onChange={(e) => setSousDomaine(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                      placeholder="kivu-gaming"
                      className="flex-1 px-3 py-2 text-sm outline-none"
                      style={{ background: COLORS.background, color: COLORS.textPrimary }}
                    />
                    <span className="text-xs px-2" style={{ color: COLORS.textMuted, background: COLORS.background }}>.plateforme.com</span>
                  </div>
                </div>
              )}
            </div>

            {erreur && <p className="text-xs" style={{ color: "#B23A2E" }}>{erreur}</p>}
            <button onClick={suivant} className="w-full rounded-xl py-3 font-semibold" style={{ background: COLORS.accentPrimary, color: COLORS.background }}>
              Continuer
            </button>
          </div>
        )}

        {/* ================= ÉTAPE 2 — Spécialité & présentation ================= */}
        {niveau && etape === 2 && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <label className="text-xs font-semibold block mb-2">Catégorie principale</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategoriePrincipale(c)}
                    className="text-xs px-3 py-1.5 rounded-full"
                    style={{
                      background: categoriePrincipale === c ? COLORS.accentPrimary : COLORS.background,
                      color: categoriePrincipale === c ? COLORS.background : COLORS.textPrimary,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <label className="text-xs font-semibold block mb-2">Bio de ta boutique</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 200))}
                rows={4}
                placeholder="Ex: Spécialiste recharges Free Fire & PUBG à Brazzaville, livraison en 5 min..."
                className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
              />
              <p className="text-[10.5px] text-right mt-1" style={{ color: COLORS.textMuted }}>{bio.length} / 200 caractères</p>
              <div className="rounded-lg px-3 py-2 mt-2 text-[11px]" style={{ background: COLORS.background, color: COLORS.textMuted }}>
                💡 Ce texte est indexé dans la recherche — les acheteurs qui tapent un mot-clé lié à ta boutique pourront te trouver directement.
              </div>
            </div>

            {estOfficiel && (
              <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <label className="text-xs font-semibold block mb-2 flex items-center gap-1"><CreditCard size={13} /> Prestataire de paiement</label>
                <div className="rounded-lg py-2.5 text-xs font-semibold uppercase text-center" style={{ background: COLORS.accentPrimary, color: COLORS.background }}>
                  SebPay
                </div>
                <p className="text-[10.5px] mt-1.5" style={{ color: COLORS.textMuted }}>
                  Seul prestataire pris en charge actuellement — garantit le séquestre et le retrait Mobile Money.
                </p>
              </div>
            )}

            {erreur && <p className="text-xs" style={{ color: "#B23A2E" }}>{erreur}</p>}
            <button onClick={suivant} className="w-full rounded-xl py-3 font-semibold" style={{ background: COLORS.accentPrimary, color: COLORS.background }}>
              Continuer
            </button>
          </div>
        )}

        {/* ================= ÉTAPE 3 — Logistique & sécurité ================= */}
        {niveau && etape === 3 && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <label className="text-xs font-semibold block mb-2">Comment remets-tu tes produits ?</label>
              {MODES_REMISE.map((m) => (
                <button
                  key={m.valeur}
                  onClick={() => toggleModeRemise(m.valeur)}
                  className="w-full text-left rounded-xl p-3 mb-2 text-sm font-semibold"
                  style={{
                    background: modesRemise.includes(m.valeur) ? "rgba(232,93,47,0.08)" : COLORS.background,
                    border: `1.5px solid ${modesRemise.includes(m.valeur) ? COLORS.accentPrimary : COLORS.border}`,
                  }}
                >
                  {m.label}
                </button>
              ))}

              {modePhysiqueActif && (
                <div className="rounded-lg px-3 py-2.5 mt-1 text-[11px]" style={{ background: "rgba(232,93,47,0.08)", color: "#9A3412" }}>
                  🔒 <b>Mode de remise physique choisi.</b> Pour ces commandes, l'acheteur recevra un code à 6 chiffres à te communiquer au moment de la remise, à saisir dans ton tableau de bord pour débloquer le paiement. Cette vérification est obligatoire dès qu'un mode physique est actif (main propre ou livraison locale) et ne peut pas être désactivée.
                </div>
              )}
            </div>

            {estOfficiel && (
              <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <label className="text-xs font-semibold block mb-1 flex items-center gap-1"><FileText size={13} /> Pièce d'identité (recto ET verso)</label>
                {identiteDejaVerifiee ? (
                  <div className="rounded-lg p-3 flex items-center gap-2 text-xs mb-3" style={{ background: "rgba(58,138,92,0.1)", color: "#3A8A5C" }}>
                    <CheckCircle2 size={16} /> Identité déjà vérifiée sur ton compte — pas besoin de la refaire.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <label
                      className="rounded-lg p-3 flex flex-col items-center justify-center text-[11px] cursor-pointer text-center"
                      style={{ border: `1px dashed ${COLORS.border}`, color: COLORS.textMuted }}
                    >
                      <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFichierIdentiteRecto(e.target.files?.[0] || null)} />
                      <Upload size={18} color={COLORS.accentSecondary} className="mb-1" />
                      {fichierIdentiteRecto ? `✓ ${fichierIdentiteRecto.name}` : "Recto"}
                    </label>
                    <label
                      className="rounded-lg p-3 flex flex-col items-center justify-center text-[11px] cursor-pointer text-center"
                      style={{ border: `1px dashed ${COLORS.border}`, color: COLORS.textMuted }}
                    >
                      <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFichierIdentiteVerso(e.target.files?.[0] || null)} />
                      <Upload size={18} color={COLORS.accentSecondary} className="mb-1" />
                      {fichierIdentiteVerso ? `✓ ${fichierIdentiteVerso.name}` : "Verso"}
                    </label>
                  </div>
                )}

                <label className="text-xs font-semibold block mb-1">Preuve d'activité (registre, patente...)</label>
                <label
                  className="w-full rounded-lg p-3 flex flex-col items-center justify-center text-xs cursor-pointer mb-3"
                  style={{ border: `1px dashed ${COLORS.border}`, color: COLORS.textMuted }}
                >
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFichierActivite(e.target.files?.[0] || null)} />
                  <Upload size={18} color={COLORS.accentSecondary} className="mb-1" />
                  {fichierActivite ? `✓ ${fichierActivite.name}` : "Importer un justificatif"}
                </label>

                <label className="text-xs font-semibold block mb-1">Justification de ton activité</label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  rows={3}
                  placeholder="Explique en quelques lignes ton activité, depuis quand tu vends, tes fournisseurs..."
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                />
              </div>
            )}

            <p className="text-[10.5px] text-center flex items-center justify-center gap-1" style={{ color: COLORS.textMuted }}>
              <Lock size={11} /> Ton code PIN a déjà été créé à l'inscription — pas besoin d'en refaire un ici.
            </p>

            {erreur && <p className="text-xs" style={{ color: "#B23A2E" }}>{erreur}</p>}
            <button
              onClick={soumettre}
              disabled={envoiEnCours}
              className="w-full rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
              style={{ background: COLORS.accentPrimary, color: COLORS.background }}
            >
              <CheckCircle2 size={16} /> {envoiEnCours ? "Envoi..." : estOfficiel ? "Envoyer ma demande" : "Confirmer et créer ma boutique"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
