"use client";

import React, { useState } from "react";
import {
  ArrowLeft, Sun, Moon, ShieldCheck, Store, Upload, Clock,
  CheckCircle2, MapPin, Phone, User, Building2, FileText, CreditCard
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { PAYS_SEBPAY } from "../lib/pays";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

export default function DevenirVendeur() {
  const router = useRouter();
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];

  const [niveau, setNiveau] = useState(null);
  const [envoye, setEnvoye] = useState(false);

  const [nomMarche, setNomMarche] = useState("");
  const [telMarche, setTelMarche] = useState("");
  const [villeMarche, setVilleMarche] = useState("");

  const [nomBoutique, setNomBoutique] = useState("");
  const [pays, setPays] = useState("CG");
  const [sousDomaine, setSousDomaine] = useState("");
  const [categories, setCategories] = useState([]);
  const [prestataire, setPrestataire] = useState("sebpay");
  const [fichierIdentite, setFichierIdentite] = useState(null);
  const [fichierActivite, setFichierActivite] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

const CATEGORIES = ["Accessoires", "Vêtements", "Recharges de jeu", "Abonnements"];
const CATEGORIES_PHYSIQUES = ["Accessoires", "Vêtements"];
/*
  Liste basée sur les captures d'écran réelles du sélecteur de pays
  Sebpay — voir lib/pays.js pour la source unique (Togo confirmé,
  Tchad exclu).
*/
const PAYS_DISPONIBLES = PAYS_SEBPAY;
  const toggleCategorie = (c) =>
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const MAP_TYPE_CATEGORIE = {
    "Accessoires": "accessoire",
    "Vêtements": "vetement",
    "Recharges de jeu": "recharge_jeu",
    "Abonnements": "abonnement_service",
  };

  const soumettreMarche = async () => {
    setErreur(null);
    if (!nomMarche || !telMarche || !villeMarche) return;
    setEnvoiEnCours(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Tu dois être connecté.");

      const { error } = await supabase.from("vendeurs").insert({
        user_id: user.id,
        nom_boutique: nomMarche,
        niveau: "vendeur_simple",
        statut: "valide", // quasi instantané, pas de vérification lourde
        ville: villeMarche,
        pays: "CG", // Le Marché = biens physiques uniquement = Congo
        visible_publiquement: true,
      });
      if (error) throw error;

      await supabase.from("users").update({ telephone: telMarche }).eq("id", user.id);

      setNiveau("vendeur_simple");
      setEnvoye(true);
    } catch (e) {
      setErreur(e.message || "Erreur lors de l'inscription.");
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const soumettreRevendeurOfficiel = async () => {
    setErreur(null);
    if (!nomBoutique || !sousDomaine || categories.length === 0 || !fichierIdentite || !fichierActivite) return;
    setEnvoiEnCours(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Tu dois être connecté.");

      // Vérifie que le sous-domaine n'est pas déjà pris
      const { data: existant } = await supabase.from("vendeurs").select("id").eq("sous_domaine", sousDomaine).single();
      if (existant) throw new Error("Ce sous-domaine est déjà utilisé, choisis-en un autre.");

      const cheminIdentite = `${user.id}/identite-${Date.now()}-${fichierIdentite.name}`;
      const { error: erreurUploadIdentite } = await supabase.storage.from("preuves").upload(cheminIdentite, fichierIdentite);
      if (erreurUploadIdentite) throw erreurUploadIdentite;

      const cheminActivite = `${user.id}/activite-${Date.now()}-${fichierActivite.name}`;
      const { error: erreurUploadActivite } = await supabase.storage.from("preuves").upload(cheminActivite, fichierActivite);
      if (erreurUploadActivite) throw erreurUploadActivite;

      const { data: vendeur, error: erreurVendeur } = await supabase
        .from("vendeurs")
        .insert({
          user_id: user.id,
          nom_boutique: nomBoutique,
          sous_domaine: sousDomaine,
          niveau: "revendeur_officiel",
          statut: "en_attente", // vérification rigoureuse, 72h
          pays,
          mode_remuneration: "hybride",
          prestataire_paiement: prestataire,
        })
        .select()
        .single();
      if (erreurVendeur) throw erreurVendeur;

      // Trace la demande dans contacts_support pour que l'équipe la
      // retrouve dans la Salle de surveillance (onglet Signalements)
      await supabase.from("contacts_support").insert({
        client_id: user.id,
        motif: "autre",
        message: `Demande de compte Revendeur officiel — boutique "${nomBoutique}" (${sousDomaine}). Documents : identité + activité joints.`,
        statut: "ouvert",
      });

      setNiveau("revendeur_officiel");
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
          {niveau === "revendeur_officiel" ? <Clock size={22} color={COLORS.accentPrimary} /> : <CheckCircle2 size={22} color={COLORS.accentPrimary} />}
        </div>
        <p className="font-bold text-lg">
          {niveau === "revendeur_officiel" ? "Demande envoyée" : "Ton profil marché est prêt !"}
        </p>
        <p className="text-sm mt-2" style={{ color: COLORS.textMuted }}>
          {niveau === "revendeur_officiel"
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
        <button onClick={() => niveau && setNiveau(null)} aria-label="Retour">
          <ArrowLeft size={22} color={COLORS.textPrimary} />
        </button>
        <span className="text-sm font-semibold">Vendre sur la plateforme</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-10 flex flex-col gap-4">
        {!niveau && (
          <div className="flex flex-col gap-3">
            <p className="text-xs" style={{ color: COLORS.textMuted }}>
              Tu peux changer de formule plus tard si besoin.
            </p>
            <button
              onClick={() => setNiveau("vendeur_simple")}
              className="rounded-2xl p-4 text-left"
              style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Store size={20} color={COLORS.accentPrimary} />
                <span className="text-base font-bold">Le Marché — vends vite fait</span>
              </div>
              <p className="text-xs" style={{ color: COLORS.textMuted }}>
                Comme un marché local, mais en ligne. Nom, téléphone, ville — c'est tout.
                Vends des vêtements, objets, accessoires... Publication quasi instantanée.
              </p>
            </button>
            <button
              onClick={() => setNiveau("revendeur_officiel")}
              className="rounded-2xl p-4 text-left"
              style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
            >
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={20} color={COLORS.accentPrimary} />
                <span className="text-base font-bold">Revendeur officiel</span>
              </div>
              <p className="text-xs" style={{ color: COLORS.textMuted }}>
                Partenariat sérieux : boutique dédiée, clients apportés par la plateforme,
                mise en avant. Vérification rigoureuse de ton identité et de ton activité.
              </p>
            </button>
          </div>
        )}

        {niveau === "vendeur_simple" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl px-3 py-2 text-xs" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.textMuted }}>
              Ton profil sera visible publiquement (nom, ville, articles). Biens physiques uniquement — pas de recharges ni d'abonnements.
            </div>

            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <div>
                <label className="text-xs font-semibold flex items-center gap-1 mb-1"><User size={12} /> Nom</label>
                <input
                  value={nomMarche}
                  onChange={(e) => setNomMarche(e.target.value)}
                  placeholder="Ton nom ou pseudo public"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold flex items-center gap-1 mb-1"><Phone size={12} /> Téléphone</label>
                <input
                  value={telMarche}
                  onChange={(e) => setTelMarche(e.target.value)}
                  placeholder="+242 06 000 00 00"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold flex items-center gap-1 mb-1"><MapPin size={12} /> Ville</label>
                <input
                  value={villeMarche}
                  onChange={(e) => setVilleMarche(e.target.value)}
                  placeholder="Brazzaville, Pointe-Noire..."
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                />
              </div>
            </div>

            <button
              onClick={soumettreMarche}
              disabled={!nomMarche || !telMarche || !villeMarche || envoiEnCours}
              className="w-full rounded-xl py-3 font-semibold"
              style={{
                background: nomMarche && telMarche && villeMarche ? COLORS.accentPrimary : COLORS.border,
                color: nomMarche && telMarche && villeMarche ? COLORS.background : COLORS.textMuted,
              }}
            >
              Commencer à vendre
            </button>
            {erreur && niveau === "vendeur_simple" && <p className="text-xs" style={{ color: "#B23A2E" }}>{erreur}</p>}
          </div>
        )}

        {niveau === "revendeur_officiel" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl px-3 py-2 text-xs" style={{ background: COLORS.surface, border: `1px solid ${COLORS.accentPrimary}`, color: COLORS.textMuted }}>
              Procédure de vérification rigoureuse — identité, activité réelle et document justificatif obligatoires.
            </div>

            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
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
              <div>
                <label className="text-xs font-semibold block mb-1">Pays</label>
                <select
                  value={pays}
                  onChange={(e) => setPays(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: COLORS.background, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
                >
                  {PAYS_DISPONIBLES.map((p) => (
                    <option key={p.code} value={p.code}>{p.nom}</option>
                  ))}
                </select>
                {pays !== "CG" && (
                  <p className="text-[11px] mt-1" style={{ color: COLORS.textMuted }}>
                    Hors Congo, seuls les produits digitaux (recharges, abonnements) sont vendables.
                  </p>
                )}
              </div>
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
            </div>

            <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <label className="text-xs font-semibold block mb-2">Catégories vendues</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.filter((c) => pays === "CG" || !CATEGORIES_PHYSIQUES.includes(c)).map((c) => (
                  <button
                    key={c}
                    onClick={() => toggleCategorie(c)}
                    className="text-xs px-3 py-1.5 rounded-full"
                    style={{
                      background: categories.includes(c) ? COLORS.accentPrimary : COLORS.background,
                      color: categories.includes(c) ? COLORS.background : COLORS.textPrimary,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <label className="text-xs font-semibold block mb-2 flex items-center gap-1"><CreditCard size={13} /> Prestataire de paiement</label>
              <div className="flex gap-2">
                {["sebpay", "cinetpay", "autre"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPrestataire(p)}
                    className="flex-1 rounded-lg py-2 text-xs font-semibold uppercase"
                    style={{
                      background: prestataire === p ? COLORS.accentPrimary : COLORS.background,
                      color: prestataire === p ? COLORS.background : COLORS.textPrimary,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <label className="text-xs font-semibold block mb-1 flex items-center gap-1"><FileText size={13} /> Pièce d'identité</label>
              <label
                className="w-full rounded-lg p-3 flex flex-col items-center justify-center text-xs mb-3 cursor-pointer"
                style={{ border: `1px dashed ${COLORS.border}`, color: COLORS.textMuted }}
              >
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFichierIdentite(e.target.files?.[0] || null)} />
                <Upload size={18} color={COLORS.accentSecondary} className="mb-1" />
                {fichierIdentite ? `✓ ${fichierIdentite.name}` : "Importer une pièce d'identité"}
              </label>

              <label className="text-xs font-semibold block mb-1">Preuve d'activité (registre, patente...)</label>
              <label
                className="w-full rounded-lg p-3 flex flex-col items-center justify-center text-xs cursor-pointer"
                style={{ border: `1px dashed ${COLORS.border}`, color: COLORS.textMuted }}
              >
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFichierActivite(e.target.files?.[0] || null)} />
                <Upload size={18} color={COLORS.accentSecondary} className="mb-1" />
                {fichierActivite ? `✓ ${fichierActivite.name}` : "Importer un justificatif"}
              </label>
            </div>

            {erreur && niveau === "revendeur_officiel" && <p className="text-xs" style={{ color: "#B23A2E" }}>{erreur}</p>}

            <button
              onClick={soumettreRevendeurOfficiel}
              disabled={!nomBoutique || !sousDomaine || categories.length === 0 || !fichierIdentite || !fichierActivite || envoiEnCours}
              className="w-full rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
              style={{
                background: nomBoutique && sousDomaine && categories.length > 0 && fichierIdentite && fichierActivite ? COLORS.accentPrimary : COLORS.border,
                color: nomBoutique && sousDomaine && categories.length > 0 && fichierIdentite && fichierActivite ? COLORS.background : COLORS.textMuted,
              }}
            >
              <CheckCircle2 size={16} /> {envoiEnCours ? "Envoi..." : "Envoyer ma demande"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
