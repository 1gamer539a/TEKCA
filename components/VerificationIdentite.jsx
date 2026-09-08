"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Sun, Moon, ShieldCheck, Upload, Clock, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

/*
  Une fois soumise, la pièce est stockée dans le bucket privé "preuves"
  (déjà créé pour les produits — réutilisé ici) et une entrée part dans
  contacts_support (motif "autre") pour que l'équipe la traite depuis
  la Salle de surveillance. users.piece_identite_verifiee ne passe à
  true qu'après validation manuelle par l'équipe.
*/
export default function VerificationIdentite() {
  const router = useRouter();
  const [theme, setTheme] = useState("clair");
  const COLORS = THEMES[theme];
  const [dejaVerifie, setDejaVerifie] = useState(false);
  const [dejaEnvoye, setDejaEnvoye] = useState(false);
  const [fichier, setFichier] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const charger = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setChargement(false); return; }
      const { data: profil } = await supabase.from("users").select("piece_identite_verifiee").eq("id", user.id).single();
      if (profil?.piece_identite_verifiee) setDejaVerifie(true);
      setChargement(false);
    };
    charger();
  }, []);

  const envoyer = async () => {
    if (!fichier) return;
    setErreur(null);
    setEnvoiEnCours(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Tu dois être connecté.");

      const chemin = `${user.id}/cni-${Date.now()}-${fichier.name}`;
      const { error: erreurUpload } = await supabase.storage.from("preuves").upload(chemin, fichier);
      if (erreurUpload) throw erreurUpload;
      const { data: urlPreuve } = supabase.storage.from("preuves").getPublicUrl(chemin);

      await supabase.from("contacts_support").insert({
        client_id: user.id,
        motif: "autre",
        message: `Demande de vérification d'identité — pièce jointe : ${urlPreuve.publicUrl}`,
        statut: "ouvert",
      });

      setDejaEnvoye(true);
    } catch (e) {
      setErreur(e.message || "Erreur lors de l'envoi.");
    } finally {
      setEnvoiEnCours(false);
    }
  };

  if (chargement) {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh" }} className="flex items-center justify-center">
        <p className="text-sm" style={{ color: COLORS.textMuted }}>Chargement...</p>
      </div>
    );
  }

  if (dejaVerifie) {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }} className="flex flex-col items-center justify-center px-6 text-center gap-2">
        <CheckCircle2 size={28} color="#3A8A5C" />
        <p className="font-bold">Identité déjà vérifiée</p>
        <p className="text-sm" style={{ color: COLORS.textMuted }}>Tu peux effectuer des retraits sans limite.</p>
      </div>
    );
  }

  if (dejaEnvoye) {
    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }} className="flex flex-col items-center justify-center px-6 text-center gap-2">
        <Clock size={28} color={COLORS.accentPrimary} />
        <p className="font-bold">Document envoyé</p>
        <p className="text-sm" style={{ color: COLORS.textMuted }}>Notre équipe vérifie ta pièce d'identité, généralement sous 72h.</p>
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
        <span className="text-sm font-semibold">Vérification d'identité</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label="Changer de thème">
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-10 flex flex-col gap-4">
        <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.accentPrimary}` }}>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={18} color={COLORS.accentPrimary} />
            <p className="text-sm font-bold">Pourquoi c'est demandé</p>
          </div>
          <p className="text-xs" style={{ color: COLORS.textMuted }}>
            Les retraits à partir de 15 000 FCFA nécessitent une vérification d'identité, pour la sécurité de tous les utilisateurs.
          </p>
        </div>

        <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <label className="text-xs font-semibold block mb-2">Pièce d'identité (CNI, passeport...)</label>
          <label
            className="w-full rounded-lg p-4 flex flex-col items-center justify-center text-xs cursor-pointer"
            style={{ border: `1px dashed ${COLORS.border}`, color: COLORS.textMuted }}
          >
            <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFichier(e.target.files?.[0] || null)} />
            <Upload size={20} color={COLORS.accentSecondary} className="mb-1" />
            {fichier ? `✓ ${fichier.name}` : "Importer une photo ou un scan"}
          </label>
        </div>

        {erreur && <p className="text-xs" style={{ color: "#B23A2E" }}>{erreur}</p>}

        <button
          onClick={envoyer}
          disabled={!fichier || envoiEnCours}
          className="w-full rounded-xl py-3 font-semibold"
          style={{
            background: fichier ? COLORS.accentPrimary : COLORS.border,
            color: fichier ? COLORS.background : COLORS.textMuted,
          }}
        >
          {envoiEnCours ? "Envoi..." : "Envoyer pour vérification"}
        </button>
      </main>
    </div>
  );
}
