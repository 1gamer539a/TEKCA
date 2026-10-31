"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, User, Phone, MapPin, CheckCircle2, Camera, Globe } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { PAYS_SEBPAY, indicatifPourPays } from "../lib/pays";

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
  const { t } = useLanguage();
  const [chargement, setChargement] = useState(true);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [ville, setVille] = useState("");
  const [email, setEmail] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);
  const [succes, setSucces] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [paysResidence, setPaysResidence] = useState("");
  const [adresseLivraison, setAdresseLivraison] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [envoiPhoto, setEnvoiPhoto] = useState(false);

  // Redimensionne la photo (512 px max, JPEG) avant l'envoi : léger et rapide
  // même avec une photo de téléphone de plusieurs Mo.
  const reduireImage = (fichier, max = 512) => new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(fichier);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image")); };
    img.src = url;
  });

  const choisirPhoto = async (e) => {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    setErreur(null);
    if (!fichier.type.startsWith("image/") || fichier.size > 5 * 1024 * 1024) return setErreur(t("profil.photoErreur"));
    setEnvoiPhoto(true);
    try {
      const blob = await reduireImage(fichier);
      const { data: { user } } = await supabase.auth.getUser();
      const chemin = `${user.id}/avatar-${Date.now()}.jpg`;
      const { error: erreurEnvoi } = await supabase.storage.from("avatars").upload(chemin, blob, { contentType: "image/jpeg" });
      if (erreurEnvoi) throw erreurEnvoi;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(chemin);
      const { error: erreurMaj } = await supabase.from("users").update({ avatar_url: pub.publicUrl }).eq("id", user.id);
      if (erreurMaj) throw erreurMaj;
      setAvatarUrl(pub.publicUrl);
    } catch {
      setErreur(t("profil.photoErreur"));
    } finally {
      setEnvoiPhoto(false);
    }
  };

  // Changer de pays ajuste l'indicatif du numéro (ex. +242 → +237).
  const changerPays = (code) => {
    setPaysResidence(code);
    const indicatif = indicatifPourPays(code);
    if (!indicatif) return;
    const tel = telephone.trim();
    const autre = PAYS_SEBPAY.find((pays) => tel.startsWith(pays.indicatif));
    if (autre) setTelephone(indicatif + tel.slice(autre.indicatif.length));
    else if (tel && !tel.startsWith("+")) setTelephone(indicatif + tel.replace(/^0+/, ""));
  };

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
      // Champs ajoutés par migration_profil_parametres.sql : lecture séparée et
      // tolérante, pour que la page marche même avant que la migration soit lancée.
      const { data: extra } = await supabase.from("users").select("pays_residence, adresse_livraison, avatar_url").eq("id", user.id).maybeSingle();
      if (extra) {
        setPaysResidence(extra.pays_residence || "");
        setAdresseLivraison(extra.adresse_livraison || "");
        setAvatarUrl(extra.avatar_url || null);
      }
      setChargement(false);
    })();
  }, []);

  const enregistrer = async () => {
    setErreur(null);
    if (!nom.trim()) {
      setErreur(t("info.nomVide"));
      return;
    }
    setEnregistrement(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t("info.sessionExpiree"));
      const { error } = await supabase.from("users").update({ nom, telephone, ville }).eq("id", user.id);
      if (error) throw error;
      const { error: erreurExtra } = await supabase
        .from("users")
        .update({ pays_residence: paysResidence || null, adresse_livraison: adresseLivraison.trim() || null })
        .eq("id", user.id);
      if (erreurExtra) throw new Error(t("info.erreurEnregistrement"));
      setSucces(true);
      setTimeout(() => setSucces(false), 2000);
    } catch (e) {
      setErreur(e.message || t("info.erreurEnregistrement"));
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
        <button onClick={() => router.back()} aria-label={t("common.retour")}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-base">{t("compte.informationsPersonnelles")}</h1>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 flex flex-col gap-4" style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}>
        <div className="flex flex-col items-center gap-2 mb-2">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : <User size={36} color={COLORS.textMuted} />}
            </div>
            <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer" style={{ background: COLORS.accentPrimary }} aria-label={t("profil.changerPhoto")}>
              <Camera size={15} color="#FFFFFF" />
              <input type="file" accept="image/*" className="hidden" onChange={choisirPhoto} disabled={envoiPhoto} />
            </label>
          </div>
          <p className="text-xs" style={{ color: COLORS.textMuted }}>{envoiPhoto ? t("info.enregistrementEnCours") : t("profil.photo")}</p>
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">{t("auth.nomComplet")}</label>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <User size={16} color={COLORS.textMuted} />
            <input value={nom} onChange={(e) => setNom(e.target.value)} className="flex-1 bg-transparent outline-none text-sm" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">{t("auth.telephone")}</label>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <Phone size={16} color={COLORS.textMuted} />
            <input value={telephone} onChange={(e) => setTelephone(e.target.value)} className="flex-1 bg-transparent outline-none text-sm" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">{t("vendeur.villeLabel")}</label>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <MapPin size={16} color={COLORS.textMuted} />
            <input value={ville} onChange={(e) => setVille(e.target.value)} className="flex-1 bg-transparent outline-none text-sm" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">{t("profil.paysResidence")}</label>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <Globe size={16} color={COLORS.textMuted} />
            <select value={paysResidence} onChange={(e) => changerPays(e.target.value)} className="flex-1 bg-transparent outline-none text-sm">
              <option value="">{t("profil.choisirPays")}</option>
              {PAYS_SEBPAY.map((pays) => (
                <option key={pays.code} value={pays.code}>{pays.drapeau} {pays.nom} ({pays.indicatif})</option>
              ))}
            </select>
          </div>
          <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>{t("profil.paysAide")}</p>
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">{t("profil.adresseLivraison")}</label>
          <div className="flex items-start gap-2 rounded-lg px-3 py-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <MapPin size={16} color={COLORS.textMuted} className="mt-0.5" />
            <textarea
              value={adresseLivraison}
              onChange={(e) => setAdresseLivraison(e.target.value)}
              placeholder={t("profil.adresseLivraisonPlaceholder")}
              rows={2}
              maxLength={300}
              className="flex-1 bg-transparent outline-none text-sm resize-none"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">{t("auth.email")}</label>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 opacity-60" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <input value={email} disabled className="flex-1 bg-transparent outline-none text-sm" />
          </div>
          <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>{t("info.emailNonModifiable")}</p>
        </div>

        {erreur && <p className="text-sm" style={{ color: "#DC2626" }}>{erreur}</p>}

        <button
          onClick={enregistrer}
          disabled={enregistrement}
          className="rounded-lg py-3 font-semibold text-sm flex items-center justify-center gap-2 mt-2"
          style={{ background: COLORS.accentPrimary, color: "#FFFFFF" }}
        >
          {succes ? <><CheckCircle2 size={16} /> {t("info.enregistre")}</> : enregistrement ? t("info.enregistrementEnCours") : t("info.enregistrerBtn")}
        </button>
      </main>
    </div>
  );
}
