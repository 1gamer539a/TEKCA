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
import { useLanguage } from "../lib/i18n/LanguageContext";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

// Clés de traduction utilisées comme identifiants stables (au lieu du
// libellé français en dur) — le nom affiché change avec la langue,
// mais la valeur technique envoyée en base (MAP_TYPE_CATEGORIE) reste
// la même quelle que soit la langue affichée.
const CLES_CATEGORIES = [
  "catAccessoires", "catVetements", "catRecharges", "catAbonnements",
  "catImmobilier", "catVehicules", "catMeubleDeco", "catJouetsEnfants", "catConsoleGaming", "catHighTech", "catModeBeaute",
];
const MAP_TYPE_CATEGORIE = {
  "catAccessoires": "accessoire",
  "catVetements": "vetement",
  "catRecharges": "recharge_jeu",
  "catAbonnements": "abonnement_service",
  "catImmobilier": "immobilier",
  "catVehicules": "vehicule",
  "catMeubleDeco": "meuble_deco",
  "catJouetsEnfants": "jouet_enfant",
  "catConsoleGaming": "console_gaming",
  "catHighTech": "high_tech",
  "catModeBeaute": "mode_beaute",
};
// Contenu traduit à l'affichage via t("vendeur.faqNQ" / "faqNA"),
// voir le rendu de la FAQ plus bas.
const FAQ_CLES = [1, 2, 3, 4, 5, 6];

// Libellés traduits à l'affichage (voir MODES_REMISE_TRADUITS dans le
// composant) — "valeur" reste la donnée technique stockée en base.
const MODES_REMISE = [
  { valeur: "main_propre", cle: "modeMainPropre" },
  { valeur: "domicile", cle: "modeDomicileLocal" },
  { valeur: "instantane", cle: "modeInstantane" },
];
const MODES_PHYSIQUES = ["main_propre", "domicile"];

// Transforme "Kivu Gaming Store" en "kivu-gaming-store" — utilisé
// pour dériver sous_domaine (identifiant technique de l'URL publique
// /vendeur/[sous_domaine]) à partir du nom de boutique, plutôt que
// de demander un champ séparé (qui affichait en plus un faux domaine
// ".plateforme.com" jamais vraiment branché).
const slugifier = (texte) =>
  (texte || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // retire les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

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
  const { t } = useLanguage();
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
  // CORRECTIF — bloquait TOUT nouveau type de candidature dès qu'un
  // seul type (simple OU officiel) était déjà actif/en attente/refusé
  // récemment. Un vendeur simple qui veut passer officiel (ou
  // inversement) se retrouvait complètement coincé. On garde le statut
  // par NIVEAU séparément — seul le niveau concerné est bloqué.
  const [candidatures, setCandidatures] = useState({ vendeur_simple: null, revendeur_officiel: null });
  const [verificationCandidature, setVerificationCandidature] = useState(true);

  useEffect(() => {
    const verifierIdentiteExistante = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setVerificationCandidature(false); return; }
      const { data: profil } = await supabase.from("users").select("piece_identite_verifiee").eq("id", user.id).single();
      if (profil?.piece_identite_verifiee) setIdentiteDejaVerifiee(true);

      const { data: vendeursExistants } = await supabase
        .from("vendeurs")
        .select("niveau, statut, date_demande")
        .eq("user_id", user.id)
        .order("date_demande", { ascending: false });

      if (vendeursExistants?.length) {
        const parNiveau = { vendeur_simple: null, revendeur_officiel: null };
        for (const v of vendeursExistants) {
          // La liste est déjà triée du plus récent au plus ancien —
          // on ne garde que la première (= la plus récente) par niveau.
          if (!parNiveau[v.niveau]) parNiveau[v.niveau] = { statut: v.statut, dateDemande: v.date_demande };
        }
        setCandidatures(parNiveau);
      }
      setVerificationCandidature(false);
    };
    verifierIdentiteExistante();
  }, []);

  const HEURES_ATTENTE_APRES_REFUS = 24;
  const infoBlocage = (niveauCible) => {
    const c = candidatures[niveauCible];
    if (!c) return null;
    const heuresDepuis = (Date.now() - new Date(c.dateDemande).getTime()) / 3600000;
    if (c.statut === "valide") return { bloque: true, texte: t("vendeur.dejaActive") };
    if (c.statut === "en_attente") return { bloque: true, texte: t("vendeur.enAttenteReponse") };
    if (c.statut === "suspendu") return { bloque: true, texte: t("vendeur.suspendue") };
    if (c.statut === "refuse" && heuresDepuis < HEURES_ATTENTE_APRES_REFUS) {
      return { bloque: true, texte: t("vendeur.refuseeReessaieDans", { h: Math.ceil(HEURES_ATTENTE_APRES_REFUS - heuresDepuis) }) };
    }
    return { bloque: false, texte: null };
  };

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
      if (!nom) manquants.push(t("vendeur.champTonNom"));
      if (!telephone) manquants.push(t("vendeur.champTonTelephone"));
      if (!ville) manquants.push(t("vendeur.champTaVille"));
      if (estOfficiel && !nomBoutique) manquants.push(t("vendeur.champNomBoutique"));
    }
    if (n === 2) {
      if (!categoriePrincipale) manquants.push(t("vendeur.champCategoriePrincipale"));
    }
    if (n === 3) {
      if (modesRemise.length === 0) manquants.push(t("vendeur.champModeRemise"));
      if (estOfficiel && !identiteDejaVerifiee && (!fichierIdentiteRecto || !fichierIdentiteVerso)) manquants.push(t("vendeur.champPieceIdentite"));
      if (estOfficiel && !justification.trim()) manquants.push(t("vendeur.champJustificationActivite"));
      if (estOfficiel && !fichierActivite) manquants.push(t("vendeur.champJustificatifActivite"));
    }
    return manquants;
  };

  const suivant = () => {
    setErreur(null);
    const manquants = champsManquantsEtape(etape);
    if (manquants.length > 0) {
      setErreur(t("vendeur.ilManque", { liste: manquants.join(", ") }));
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
      setErreur(t("vendeur.ilManque", { liste: manquants.join(", ") }));
      return;
    }

    const nomBoutiqueFinal = estOfficiel ? nomBoutique : nom;

    // Aucune boutique ne peut usurper le nom de la plateforme elle-même
    // — comparaison insensible aux accents/casse via slugifier (donc
    // "TEKÇA", "Tek Ça", "tek-ca"... sont tous bloqués pareil).
    if (slugifier(nomBoutiqueFinal) === "tekca") {
      setErreur(t("vendeur.nomBoutiqueNonAutorise"));
      return;
    }

    setEnvoiEnCours(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t("vendeur.tuDoisEtreConnecte"));

      // Un seul nom de boutique par utilisateur sur toute la
      // plateforme — vérifié ici en plus de l'index unique posé côté
      // base (migration_unicite_nom_boutique.sql), qui reste le vrai
      // rempart si ce formulaire est un jour contourné.
      const { data: nomPris } = await supabase
        .from("vendeurs")
        .select("id")
        .ilike("nom_boutique", nomBoutiqueFinal)
        .neq("user_id", user.id)
        .maybeSingle();
      if (nomPris) {
        setErreur(t("vendeur.nomBoutiquePris"));
        setEnvoiEnCours(false);
        return;
      }

      // CORRECTIF — le rôle du compte doit passer à "vendeur" pour que
      // "Mon compte" affiche "Mon dashboard vendeur" au lieu de
      // "Devenir vendeur", MAIS seulement une fois la ligne `vendeurs`
      // réellement créée avec succès. Avant ce correctif, la mise à
      // jour du rôle arrivait AVANT l'insertion (et, pour un revendeur
      // officiel, avant les 3 uploads de fichiers) : la moindre erreur
      // en cours de route (nom déjà pris, bucket de stockage manquant,
      // etc.) laissait le compte marqué "vendeur" sans aucun profil
      // boutique derrière — page "Aucun profil vendeur trouvé" pour
      // n'importe quel utilisateur touché par une erreur ici, pas
      // seulement un cas isolé.
      const payloadCommun = {
        user_id: user.id,
        nom_boutique: nomBoutiqueFinal,
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
        await supabase.from("users").update({ telephone, role: "vendeur" }).eq("id", user.id);
      } else {
        // Dérive le sous-domaine du nom de boutique. En cas de
        // collision (nom déjà pris par une autre boutique), ajoute un
        // court suffixe aléatoire — pas de champ à corriger pour
        // l'utilisateur, donc pas de blocage possible ici.
        let sousDomaine = slugifier(nomBoutique) || `boutique-${Date.now()}`;
        const { data: existant } = await supabase.from("vendeurs").select("id").eq("sous_domaine", sousDomaine).single();
        if (existant) {
          sousDomaine = `${sousDomaine}-${Math.random().toString(36).slice(2, 6)}`;
        }

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
        await supabase.from("users").update({ telephone, role: "vendeur" }).eq("id", user.id);
      }

      setEnvoye(true);
    } catch (e) {
      const messageBrut = e.message || "";
      if (messageBrut.includes("idx_vendeurs_nom_boutique_unique")) {
        setErreur(t("vendeur.nomBoutiquePris"));
      } else if (messageBrut.includes("nom_boutique_non_reserve")) {
        setErreur(t("vendeur.nomBoutiqueNonAutorise"));
      } else {
        setErreur(messageBrut || t("vendeur.erreurEnvoi"));
      }
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
        <p className="font-bold text-lg">{estOfficiel ? t("vendeur.demandeEnvoyee") : t("vendeur.profilMarchePret")}</p>
        <p className="text-sm mt-2" style={{ color: COLORS.textMuted }}>
          {estOfficiel
            ? t("vendeur.demandeRevendeurDesc")
            : t("vendeur.publierDesMaintenant")}
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
        <button onClick={precedent} aria-label={t("common.retour")}><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">{t("home.devenirVendeur")}</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label={t("common.changerTheme")}>
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
            {t("vendeur.etapeLabel", { n: etape, titre: etape === 1 ? t("vendeur.etape1Titre") : etape === 2 ? t("vendeur.etape2Titre") : t("vendeur.etape3Titre") })}
          </p>
        </div>
      )}

      <main className={`max-w-md mx-auto w-full px-4 pb-10 flex flex-col gap-4 ${niveau ? "pt-28" : "pt-20"}`}>
        {!niveau && verificationCandidature && (
          <p className="text-xs text-center py-10" style={{ color: COLORS.textMuted }}>{t("vendeur.verificationCompte")}</p>
        )}

        {!niveau && !verificationCandidature && (() => {
          const blocageSimple = infoBlocage("vendeur_simple");
          const blocageOfficiel = infoBlocage("revendeur_officiel");
          return (
            <div className="flex flex-col gap-3">
              <div className="mb-1">
                <h1 className="text-xl font-extrabold">{t("vendeur.titrePrincipal")}</h1>
                <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
                  {t("vendeur.sousTitrePrincipal")}
                </p>
              </div>
              <p className="text-xs" style={{ color: COLORS.textMuted }}>
                {t("vendeur.changerFormulePlusTard")}
              </p>
              <button
                onClick={() => !blocageSimple?.bloque && setNiveau("vendeur_simple")}
                disabled={blocageSimple?.bloque}
                className="rounded-2xl p-4 text-left transition active:opacity-70 active:scale-[0.98]"
                style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, opacity: blocageSimple?.bloque ? 0.55 : 1 }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Store size={20} color={COLORS.accentPrimary} />
                    <div>
                      <span className="text-base font-bold block">{t("vendeur.vendeurIndependant")}</span>
                      <span className="text-[10px]" style={{ color: COLORS.textMuted }}>{t("vendeur.particulierOccasionnel")}</span>
                    </div>
                  </div>
                  {blocageSimple?.bloque && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: COLORS.background, color: COLORS.textMuted }}>{blocageSimple.texte}</span>
                  )}
                </div>
                <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
                  {t("vendeur.descVendeurIndependant")}
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {[
                    t("vendeur.listeIndep1"),
                    t("vendeur.listeIndep2"),
                    t("vendeur.listeIndep3"),
                    t("vendeur.listeIndep4"),
                  ].map((ligne) => (
                    <li key={ligne} className="text-[11px] flex items-start gap-1.5" style={{ color: COLORS.textMuted }}>
                      <CheckCircle2 size={12} color={COLORS.accentPrimary} className="mt-0.5 flex-shrink-0" /> {ligne}
                    </li>
                  ))}
                </ul>
              </button>
              <button
                onClick={() => !blocageOfficiel?.bloque && setNiveau("revendeur_officiel")}
                disabled={blocageOfficiel?.bloque}
                className="rounded-2xl p-4 text-left transition active:opacity-70 active:scale-[0.98]"
                style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, opacity: blocageOfficiel?.bloque ? 0.55 : 1 }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={20} color={COLORS.accentPrimary} />
                    <div>
                      <span className="text-base font-bold block">{t("vendeur.boutiqueEntrepriseVerifiee")}</span>
                      <span className="text-[10px]" style={{ color: COLORS.textMuted }}>{t("vendeur.commercantBusinessPro")}</span>
                    </div>
                  </div>
                  {blocageOfficiel?.bloque && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: COLORS.background, color: COLORS.textMuted }}>{blocageOfficiel.texte}</span>
                  )}
                </div>
                <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
                  {t("vendeur.descOfficiel")}
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {[
                    t("vendeur.listeOfficiel1"),
                    t("vendeur.listeOfficiel2"),
                    t("vendeur.listeOfficiel3"),
                    t("vendeur.listeOfficiel4"),
                  ].map((ligne) => (
                    <li key={ligne} className="text-[11px] flex items-start gap-1.5" style={{ color: COLORS.textMuted }}>
                      <CheckCircle2 size={12} color={COLORS.accentPrimary} className="mt-0.5 flex-shrink-0" /> {ligne}
                    </li>
                  ))}
                </ul>
              </button>

            {/* Preuve sociale — chiffres réels, pas décoratifs */}
            {stats && (
              <div className="rounded-2xl p-5 grid grid-cols-2 gap-5 mt-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <div className="text-center">
                  <p className="text-2xl font-extrabold" style={{ color: COLORS.accentPrimary }}>{stats.boutiques}</p>
                  <p className="text-[11px] font-semibold mt-1" style={{ color: COLORS.textMuted }}>{t("vendeur.boutiquesCreees")}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-extrabold" style={{ color: COLORS.accentPrimary }}>{stats.zones}</p>
                  <p className="text-[11px] font-semibold mt-1" style={{ color: COLORS.textMuted }}>{t("vendeur.villesQuartiersCouverts")}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-extrabold" style={{ color: COLORS.accentPrimary }}>
                    {stats.note}{stats.note !== "—" && <span className="text-sm" style={{ color: COLORS.textMuted }}>/5</span>}
                  </p>
                  <p className="text-[11px] font-semibold mt-1" style={{ color: COLORS.textMuted }}>{t("vendeur.noteMoyenneVendeurs")}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-extrabold" style={{ color: COLORS.accentPrimary }}>100%</p>
                  <p className="text-[11px] font-semibold mt-1" style={{ color: COLORS.textMuted }}>{t("vendeur.sousSequestreSecurise")}</p>
                </div>
              </div>
            )}

            {/* Puces de réassurance */}
            <div className="flex flex-col gap-2 mt-1">
              <div className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <p className="text-xs font-bold">{t("vendeur.sequestreSecuriseTitre")}</p>
                <p className="text-[11px] mt-0.5" style={{ color: COLORS.textMuted }}>
                  {t("vendeur.sequestreSecuriseDesc")}
                </p>
              </div>
              <div className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <p className="text-xs font-bold">{t("vendeur.multiMoyensTitre")}</p>
                <p className="text-[11px] mt-0.5" style={{ color: COLORS.textMuted }}>
                  {t("vendeur.multiMoyensDesc")}
                </p>
              </div>
              <div className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <p className="text-xs font-bold">{t("vendeur.protectionArnaqueTitre")}</p>
                <p className="text-[11px] mt-0.5" style={{ color: COLORS.textMuted }}>
                  {t("vendeur.protectionArnaqueDesc")}
                </p>
              </div>
            </div>

            {/* FAQ vendeurs */}
            <p className="text-xs font-bold uppercase tracking-wide mt-3" style={{ color: COLORS.textMuted }}>{t("vendeur.questionsFrequentes")}</p>
            <div className="flex flex-col gap-2">
              {FAQ_CLES.map((i) => {
                const ouverte = faqOuverte === i;
                return (
                  <div key={i} className="rounded-xl p-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                    <button
                      onClick={() => setFaqOuverte(ouverte ? null : i)}
                      className="w-full flex items-center justify-between gap-2 text-left"
                    >
                      <span className="text-xs font-bold">{t(`vendeur.faq${i}Q`)}</span>
                      {ouverte ? <Minus size={14} color={COLORS.accentPrimary} /> : <Plus size={14} color={COLORS.accentPrimary} />}
                    </button>
                    {ouverte && <p className="text-[11.5px] mt-2" style={{ color: COLORS.textMuted }}>{t(`vendeur.faq${i}A`)}</p>}
                  </div>
                );
              })}
            </div>
          </div>
          );
        })()}

        {/* ================= ÉTAPE 1 — Identité & type ================= */}
        {niveau && etape === 1 && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              {estOfficiel && (
                <div>
                  <label className="text-xs font-semibold flex items-center gap-1 mb-1"><Building2 size={12} /> {t("vendeur.nomBoutiqueLabel")}</label>
                  <input
                    value={nomBoutique}
                    onChange={(e) => setNomBoutique(e.target.value)}
                    placeholder={t("vendeur.nomBoutiquePlaceholder")}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                  />
                  <p className="text-[10.5px] mt-1" style={{ color: COLORS.textMuted }}>
                    {t("vendeur.adresseGenereeDesc")}
                  </p>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold flex items-center gap-1 mb-1"><User size={12} /> {estOfficiel ? t("vendeur.tonNomLabel") : t("vendeur.nomPseudoPublicLabel")}</label>
                <input
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder={t("vendeur.nomPseudoPlaceholder")}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold flex items-center gap-1 mb-1"><Phone size={12} /> {t("auth.telephone")}</label>
                <input
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  placeholder={`${indicatifPourPays(pays)} 06 000 00 00`}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">{t("vendeur.paysLabel")}</label>
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
                <label className="text-xs font-semibold flex items-center gap-1 mb-1"><MapPin size={12} /> {t("vendeur.villeLabel")}</label>
                <input
                  value={ville}
                  onChange={(e) => setVille(e.target.value)}
                  placeholder={t("vendeur.villePlaceholderCourt")}
                  list="villes-suggestions"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                />
                <datalist id="villes-suggestions">
                  {villesPourPays(pays).map((v) => <option key={v} value={v} />)}
                </datalist>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">{t("vendeur.quartierLabel")}</label>
                <input
                  value={quartier}
                  onChange={(e) => setQuartier(e.target.value)}
                  placeholder={t("vendeur.quartierPlaceholderCourt")}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                />
              </div>
            </div>

            {erreur && <p className="text-xs" style={{ color: "#B23A2E" }}>{erreur}</p>}
            <button onClick={suivant} className="w-full rounded-xl py-3 font-semibold" style={{ background: COLORS.accentPrimary, color: COLORS.background }}>
              {t("panier.continuer")}
            </button>
          </div>
        )}

        {/* ================= ÉTAPE 2 — Spécialité & présentation ================= */}
        {niveau && etape === 2 && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <label className="text-xs font-semibold block mb-2">{t("vendeur.categoriePrincipaleLabel")}</label>
              <div className="flex flex-wrap gap-2">
                {CLES_CATEGORIES.map((cle) => (
                  <button
                    key={cle}
                    onClick={() => setCategoriePrincipale(cle)}
                    className="text-xs px-3 py-1.5 rounded-full"
                    style={{
                      background: categoriePrincipale === cle ? COLORS.accentPrimary : COLORS.background,
                      color: categoriePrincipale === cle ? COLORS.background : COLORS.textPrimary,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  >
                    {t(`vendeur.${cle}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <label className="text-xs font-semibold block mb-2">{t("vendeur.bioLabel")}</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 200))}
                rows={4}
                placeholder={t("vendeur.bioPlaceholder")}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
              />
              <p className="text-[10.5px] text-right mt-1" style={{ color: COLORS.textMuted }}>{t("vendeur.caracteresCompteur", { count: bio.length })}</p>
              <div className="rounded-lg px-3 py-2 mt-2 text-[11px]" style={{ background: COLORS.background, color: COLORS.textMuted }}>
                {t("vendeur.bioIndexeeDesc")}
              </div>
            </div>

            {estOfficiel && (
              <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <label className="text-xs font-semibold block mb-2 flex items-center gap-1"><CreditCard size={13} /> {t("dashboard.prestatairePaiement")}</label>
                <div className="rounded-lg py-2.5 text-xs font-semibold uppercase text-center" style={{ background: COLORS.accentPrimary, color: COLORS.background }}>
                  SebPay
                </div>
                <p className="text-[10.5px] mt-1.5" style={{ color: COLORS.textMuted }}>
                  {t("vendeur.seulPrestataireDesc")}
                </p>
              </div>
            )}

            {erreur && <p className="text-xs" style={{ color: "#B23A2E" }}>{erreur}</p>}
            <button onClick={suivant} className="w-full rounded-xl py-3 font-semibold" style={{ background: COLORS.accentPrimary, color: COLORS.background }}>
              {t("panier.continuer")}
            </button>
          </div>
        )}

        {/* ================= ÉTAPE 3 — Logistique & sécurité ================= */}
        {niveau && etape === 3 && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <label className="text-xs font-semibold block mb-2">{t("vendeur.commentRemetsTu")}</label>
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
                  {t(`vendeur.${m.cle}`)}
                </button>
              ))}

              {modePhysiqueActif && (
                <div className="rounded-lg px-3 py-2.5 mt-1 text-[11px]" style={{ background: "rgba(232,93,47,0.08)", color: "#9A3412" }}>
                  {t("vendeur.modePhysiqueChoisiDesc")}
                </div>
              )}
            </div>

            {estOfficiel && (
              <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <label className="text-xs font-semibold block mb-1 flex items-center gap-1"><FileText size={13} /> {t("vendeur.pieceIdentiteLabel")}</label>
                {identiteDejaVerifiee ? (
                  <div className="rounded-lg p-3 flex items-center gap-2 text-xs mb-3" style={{ background: "rgba(58,138,92,0.1)", color: "#3A8A5C" }}>
                    <CheckCircle2 size={16} /> {t("vendeur.identiteDejaVerifieeDesc")}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <label
                      className="rounded-lg p-3 flex flex-col items-center justify-center text-[11px] cursor-pointer text-center"
                      style={{ border: `1px dashed ${COLORS.border}`, color: COLORS.textMuted }}
                    >
                      <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFichierIdentiteRecto(e.target.files?.[0] || null)} />
                      <Upload size={18} color={COLORS.accentSecondary} className="mb-1" />
                      {fichierIdentiteRecto ? `✓ ${fichierIdentiteRecto.name}` : t("vendeur.recto")}
                    </label>
                    <label
                      className="rounded-lg p-3 flex flex-col items-center justify-center text-[11px] cursor-pointer text-center"
                      style={{ border: `1px dashed ${COLORS.border}`, color: COLORS.textMuted }}
                    >
                      <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFichierIdentiteVerso(e.target.files?.[0] || null)} />
                      <Upload size={18} color={COLORS.accentSecondary} className="mb-1" />
                      {fichierIdentiteVerso ? `✓ ${fichierIdentiteVerso.name}` : t("vendeur.verso")}
                    </label>
                  </div>
                )}

                <label className="text-xs font-semibold block mb-1">{t("vendeur.preuveActiviteLabel")}</label>
                <label
                  className="w-full rounded-lg p-3 flex flex-col items-center justify-center text-xs cursor-pointer mb-3"
                  style={{ border: `1px dashed ${COLORS.border}`, color: COLORS.textMuted }}
                >
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFichierActivite(e.target.files?.[0] || null)} />
                  <Upload size={18} color={COLORS.accentSecondary} className="mb-1" />
                  {fichierActivite ? `✓ ${fichierActivite.name}` : t("vendeur.importerJustificatif")}
                </label>

                <label className="text-xs font-semibold block mb-1">{t("vendeur.justificationActiviteLabel")}</label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  rows={3}
                  placeholder={t("vendeur.justificationPlaceholder")}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                />
              </div>
            )}

            <p className="text-[10.5px] text-center flex items-center justify-center gap-1" style={{ color: COLORS.textMuted }}>
              <Lock size={11} /> {t("vendeur.pinDejaCreeDesc")}
            </p>

            {erreur && <p className="text-xs" style={{ color: "#B23A2E" }}>{erreur}</p>}
            <button
              onClick={soumettre}
              disabled={envoiEnCours}
              className="w-full rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
              style={{ background: COLORS.accentPrimary, color: COLORS.background }}
            >
              <CheckCircle2 size={16} /> {envoiEnCours ? t("vendeur.envoiEnCoursMot") : estOfficiel ? t("vendeur.envoyerMaDemande") : t("vendeur.confirmerCreerBoutique")}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
