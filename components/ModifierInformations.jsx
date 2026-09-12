"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, User, Phone, MapPin, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabase";

const COLORS = { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" };

/*
  CORRECTIF — le lien "Informations personnelles" dans Mon Compte
  pointait vers /compte, la page où on se trouve déjà (lien mort en
  boucle sur lui-même). Cette page permet réellement de modifier nom,
  téléphone et ville — les seuls champs du profil qui ont du sens à
  éditer soi-même (l'email est lié à l'authentification Supabase, pas
  modifiable ici sans un flux de reconfirmation séparé).
*/
export default function ModifierInformations() {
  const router = useRouter();
  const [chargement, setChargement] = useState(true);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [ville, setVille] = useState("");
  const [email, setEmail] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);
  const [succes, setSucces] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || "");
      const { data: profil } = await supabase.from("users").select("nom, telephone, ville").eq("id", user.id).single();
      if (profil) {
        setNom(profil.nom || "");
        setTelephone(profil.telephone || "");
        setVille(profil.ville || "");
      }
      setChargement(false);
    })();
  }, []);

  const enregistrer = async () => {
    setErreur(null);
    if (!nom.trim()) {
      setErreur("Le nom ne peut pas être vide.");
      return;
    }
    setEnregistrement(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée, reconnecte-toi.");
      const { error } = await supabase.from("users").update({ nom, telephone, ville }).eq("id", user.id);
      if (error) throw error;
      setSucces(true);
      setTimeout(() => setSucces(false), 2000);
    } catch (e) {
      setErreur(e.message || "Erreur lors de l'enregistrement.");
    } finally {
      setEnregistrement(false);
    }
  };

  if (chargement) {
    return <div style={{ background: COLORS.background, minHeight: "100vh" }} />;
  }

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label="Retour">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-base">Informations personnelles</h1>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-24 flex flex-col gap-4">
        <div>
          <label className="text-xs font-semibold block mb-1">Nom complet</label>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <User size={16} color={COLORS.textMuted} />
            <input value={nom} onChange={(e) => setNom(e.target.value)} className="flex-1 bg-transparent outline-none text-sm" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">Téléphone</label>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <Phone size={16} color={COLORS.textMuted} />
            <input value={telephone} onChange={(e) => setTelephone(e.target.value)} className="flex-1 bg-transparent outline-none text-sm" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">Ville</label>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <MapPin size={16} color={COLORS.textMuted} />
            <input value={ville} onChange={(e) => setVille(e.target.value)} className="flex-1 bg-transparent outline-none text-sm" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">Email</label>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 opacity-60" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <input value={email} disabled className="flex-1 bg-transparent outline-none text-sm" />
          </div>
          <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>L'email n'est pas modifiable ici.</p>
        </div>

        {erreur && <p className="text-sm" style={{ color: "#DC2626" }}>{erreur}</p>}

        <button
          onClick={enregistrer}
          disabled={enregistrement}
          className="rounded-lg py-3 font-semibold text-sm flex items-center justify-center gap-2 mt-2"
          style={{ background: COLORS.accentPrimary, color: "#FFFFFF" }}
        >
          {succes ? <><CheckCircle2 size={16} /> Enregistré</> : enregistrement ? "Enregistrement..." : "Enregistrer"}
        </button>
      </main>
    </div>
  );
}
