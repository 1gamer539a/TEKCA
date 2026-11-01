"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, Sun, Moon, Mic, Send, Sparkles, Lock, Zap,
  MessageSquare, Wand2, Crown, Image as ImageIcon
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import ConfirmationPIN from "./ConfirmationPIN";
import { useTheme } from "../lib/ThemeContext";
import { useLanguage } from "../lib/i18n/LanguageContext";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

// Libellés traduits à l'affichage (voir le composant) — ce texte est
// aussi celui envoyé comme message à l'IA quand on clique dessus,
// donc il est normal qu'il change avec la langue de l'utilisateur.
const SUGGESTIONS_RAPIDES = [
  { cle: "sugSensibiliteFreeFire", icon: Wand2, generation: true, lourde: true },
  { cle: "sugCodeLobbyGta", icon: Wand2, generation: true, lourde: false },
  { cle: "sugGenererImage", icon: ImageIcon, action: "image" },
  { cle: "sugOuEnEstCommande", icon: MessageSquare, generation: false },
  { cle: "sugCommentDevenirVendeur", icon: MessageSquare, generation: false },
];

const LIMITE_FREE_PAR_JOUR = 3;

export default function IAAssistant({ onFermer }) {
  const { theme, setTheme } = useTheme();
  const { t, langue } = useLanguage();
  const router = useRouter();
  const COLORS = THEMES[theme];

  const [forfait, setForfait] = useState("free");
  const [generationsUtilisees, setGenerationsUtilisees] = useState(0);
  const [saisie, setSaisie] = useState("");
  const [messages, setMessages] = useState([
    { role: "ia", texte: t("ia.salutMessage") },
  ]);
  const [modalPremium, setModalPremium] = useState(false);
  const [forfaitEnAttentePin, setForfaitEnAttentePin] = useState(null);
  const [achatEnCours, setAchatEnCours] = useState(false);
  const [erreurAchat, setErreurAchat] = useState(null);
  const [enTrainDecrire, setEnTrainDecrire] = useState(false);
  const [userId, setUserId] = useState(null);
  const finMessagesRef = useRef(null);
  const fichierPhotoRef = useRef(null);
  // Abonnement TEKÇA (Basic 2 500 FCFA/mois et plus) : débloque les images et les fiches produit depuis une photo.
  const [plan, setPlan] = useState({ niveau: 0, quotaImages: 0, imagesUtilisees: 0 });
  const [modalPlan, setModalPlan] = useState(false);
  const [attenteImage, setAttenteImage] = useState(false); // le prochain message = description de l'image
  const [photoEnCours, setPhotoEnCours] = useState(false);
  const [transfertEnCours, setTransfertEnCours] = useState(false);
  const [transfertFait, setTransfertFait] = useState(false);

  useEffect(() => {
    const initUtilisateur = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: abo } = await supabase
        .from("ia_abonnements")
        .select("forfait, date_fin")
        .eq("user_id", user.id)
        .order("date_debut", { ascending: false })
        .limit(1)
        .maybeSingle();
      // Forfait expiré (date_fin dépassée) = retour à "free" (voir ProfilParametres).
      if (abo && (!abo.date_fin || new Date(abo.date_fin) > new Date())) setForfait(abo.forfait);

      const debutJournee = new Date();
      debutJournee.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("ia_generations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("date_creation", debutJournee.toISOString());
      setGenerationsUtilisees(count || 0);

      try {
        const { data: { session: sessionPlan } } = await supabase.auth.getSession();
        const reponsePlan = await fetch("/api/ia/plan", { headers: { Authorization: `Bearer ${sessionPlan?.access_token}` }, cache: "no-store" });
        if (reponsePlan.ok) setPlan(await reponsePlan.json());
      } catch {}
    };
    initUtilisateur();
  }, []);

  const limiteAtteinte = forfait === "free" && generationsUtilisees >= LIMITE_FREE_PAR_JOUR;

  const acheterForfait = async (nomForfait, pinConfirme) => {
    setAchatEnCours(true);
    setErreurAchat(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const reponse = await fetch("/api/ia-abonnements/souscrire", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ nomForfait, pin: pinConfirme }),
      });
      const data = await reponse.json();
      if (!reponse.ok) throw new Error(data.error || t("ia.echecPaiement"));
      setForfait("premium");
      setModalPremium(false);
    } catch (e) {
      setErreurAchat(e.message || t("ia.echecPaiement"));
    } finally {
      setAchatEnCours(false);
    }
  };

  const ajouterIA = (message) => setMessages((m) => [...m, { role: "ia", ...message }]);

  const jetonSession = async () => (await supabase.auth.getSession()).data.session?.access_token;

  // 1) Génération d'image — réservée aux abonnés
  const demarrerImage = () => {
    if (plan.niveau < 1) return setModalPlan(true);
    if (plan.imagesUtilisees >= plan.quotaImages) return ajouterIA({ texte: t("ia.imageQuotaAtteint") });
    setAttenteImage(true);
    ajouterIA({ texte: t("ia.decrisImage") });
  };

  const genererImageDepuis = async (description) => {
    setAttenteImage(false);
    setSaisie("");
    setMessages((m) => [...m, { role: "user", texte: description }]);
    setEnTrainDecrire(true);
    try {
      const reponse = await fetch("/api/ia/image", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await jetonSession()}` },
        body: JSON.stringify({ description }),
      });
      const data = await reponse.json().catch(() => ({}));
      if (reponse.status === 403 && data.code === "plan_requis") {
        setModalPlan(true);
      } else if (!reponse.ok) {
        ajouterIA({ texte: data.error || t("ia.imageErreur") });
      } else {
        setPlan((p) => ({ ...p, imagesUtilisees: p.quotaImages - data.imagesRestantes }));
        ajouterIA({ texte: t("ia.imageGeneree"), image: data.image });
      }
    } catch {
      ajouterIA({ texte: t("ia.imageErreur") });
    } finally {
      setEnTrainDecrire(false);
    }
  };

  // 2) Brouillon d'annonce depuis une photo — réservé aux abonnés
  const compresserImage = (fichier) =>
    new Promise((resolve, reject) => {
      const lecteur = new FileReader();
      lecteur.onerror = reject;
      lecteur.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const echelle = Math.min(1, 1280 / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * echelle);
          canvas.height = Math.round(img.height * echelle);
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.src = lecteur.result;
      };
      lecteur.readAsDataURL(fichier);
    });

  const clicPhoto = () => {
    if (plan.niveau < 1) return setModalPlan(true);
    fichierPhotoRef.current?.click();
  };

  const choisirPhoto = async (e) => {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier || photoEnCours) return;
    setPhotoEnCours(true);
    const indication = saisie.trim();
    setSaisie("");
    try {
      const dataUrl = await compresserImage(fichier);
      setMessages((m) => [...m, { role: "user", texte: indication || t("ia.photoEnvoyee"), apercu: dataUrl }]);
      setEnTrainDecrire(true);
      const reponse = await fetch("/api/ia/fiche-produit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await jetonSession()}` },
        body: JSON.stringify({ image: dataUrl, indication, langue }),
      });
      const data = await reponse.json().catch(() => ({}));
      if (reponse.status === 403 && data.code === "plan_requis") setModalPlan(true);
      else if (!reponse.ok) ajouterIA({ texte: data.error || t("ia.brouillonErreur") });
      else ajouterIA({ texte: t("ia.brouillonPret"), brouillon: { ...data.brouillon, photo: dataUrl } });
    } catch {
      ajouterIA({ texte: t("ia.brouillonErreur") });
    } finally {
      setEnTrainDecrire(false);
      setPhotoEnCours(false);
    }
  };

  // Le brouillon est transmis au formulaire d'annonce habituel (photos, prix, preuve, validation de l'équipe).
  const utiliserBrouillon = (b) => {
    try {
      sessionStorage.setItem("tekca_brouillon_produit", JSON.stringify(b));
    } catch {}
    onFermer?.();
    router.push("/produit/nouveau");
  };

  const envoyer = async (texte, item = {}) => {
    const { generation = false, lourde = false } = item;
    if (!texte.trim() || enTrainDecrire) return;
    if (attenteImage) return genererImageDepuis(texte.trim());
    if (generation && lourde && limiteAtteinte) {
      setModalPremium(true);
      return;
    }

    const nouveauxMessages = [...messages, { role: "user", texte }];
    setMessages(nouveauxMessages);
    setSaisie("");
    setEnTrainDecrire(true);

    if (generation && lourde) {
      setGenerationsUtilisees((n) => n + 1);
      if (userId) {
        await supabase.from("ia_generations").insert({ user_id: userId, type_generation: texte });
      }
    }

    try {
      const historique = nouveauxMessages
        .filter((m) => m.role !== "ia" || nouveauxMessages.indexOf(m) !== 0) // exclut le message d'accueil
        .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.texte }));

      const { data: { session: sessionIA } } = await supabase.auth.getSession();
      const reponse = await fetch("/api/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionIA?.access_token}` },
        body: JSON.stringify({ messages: historique, generation, langue }),
      });
      const data = await reponse.json();

      setMessages((m) => [
        ...m,
        { role: "ia", texte: data.texte || data.error || t("ia.erreurSurvenue"), transfert: !!data.transfert },
      ]);
    } catch (e) {
      setMessages((m) => [...m, { role: "ia", texte: t("ia.connexionIAImpossible") }]);
    } finally {
      setEnTrainDecrire(false);
    }
  };

  // Garde toujours le dernier message visible (nouvelle réponse, « l'IA écrit… »).
  useEffect(() => {
    finMessagesRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, enTrainDecrire]);

  // Relais humain : la conversation devient une réclamation que l'équipe « Relation client » traite.
  const transmettreALEquipe = async () => {
    if (transfertEnCours || transfertFait) return;
    setTransfertEnCours(true);
    try {
      const historique = messages
        .filter((m, i) => !(i === 0 && m.role === "ia"))
        .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.texte }));
      const { data: { session: sessionTransfert } } = await supabase.auth.getSession();
      const reponse = await fetch("/api/ia/transfert", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionTransfert?.access_token}` },
        body: JSON.stringify({ messages: historique }),
      });
      const data = await reponse.json().catch(() => ({}));
      if (!reponse.ok) throw new Error(data.error || t("ia.transfertErreur"));
      setTransfertFait(true);
      setMessages((m) => [...m, { role: "ia", texte: t("ia.transfertEnvoye") }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "ia", texte: e.message || t("ia.transfertErreur") }]);
    } finally {
      setTransfertEnCours(false);
    }
  };

  return (
    <div style={{ background: COLORS.background, height: "100dvh", color: COLORS.textPrimary }} className="flex flex-col overflow-hidden">
      <header
        className="shrink-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}`, paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <button onClick={onFermer} aria-label={t("ia.fermerAssistant")}><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold flex items-center gap-1">
          <Sparkles size={15} color={COLORS.accentPrimary} /> {t("ia.titreAssistant")}
        </span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label={t("common.changerTheme")}>
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      {/* Bandeau statut forfait */}
      <div
        className="shrink-0 z-30 flex items-center justify-between px-4 py-2"
        style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <div className="flex items-center gap-2">
          {forfait === "premium" ? (
            <Crown size={14} color={COLORS.accentPrimary} />
          ) : (
            <Zap size={14} color={COLORS.accentSecondary} />
          )}
          <span className="text-xs" style={{ color: COLORS.textPrimary }}>
            {forfait === "premium"
              ? t("ia.premiumIllimitees")
              : t("ia.generationsLourdesJour", { utilisees: generationsUtilisees, limite: LIMITE_FREE_PAR_JOUR })}
          </span>
        </div>
        {forfait === "free" && (
          <button onClick={() => setModalPremium(true)} className="text-[11px] font-semibold" style={{ color: COLORS.accentPrimary }}>
            {t("ia.passerPremium")}
          </button>
        )}
      </div>

      {plan.niveau >= 1 && (
        <p className="shrink-0 text-center text-[11px] py-1" style={{ background: COLORS.background, color: COLORS.textMuted, borderBottom: `1px solid ${COLORS.border}` }}>
          {t("ia.imagesQuota", { utilisees: plan.imagesUtilisees, quota: plan.quotaImages })}
        </p>
      )}

      {/* FIL DE CHAT */}
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
      <div className="max-w-md mx-auto w-full px-4 py-4 flex flex-col gap-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="rounded-2xl px-3 py-2 text-sm max-w-[80%] whitespace-pre-wrap break-words"
              style={{
                background: m.role === "user" ? COLORS.accentPrimary : COLORS.surface,
                color: m.role === "user" ? COLORS.background : COLORS.textPrimary,
                border: m.role === "ia" ? `1px solid ${COLORS.border}` : "none",
              }}
            >
              {m.apercu && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.apercu} alt="" className="rounded-lg mb-1.5 max-h-40 w-auto" />
              )}
              {m.texte}
              {m.image && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.image} alt="" className="rounded-xl mt-2 w-full" />
                  <a href={m.image} download="tekca-image.png" className="inline-block mt-2 text-xs font-bold" style={{ color: COLORS.accentSecondary }}>
                    {t("ia.telechargerImage")}
                  </a>
                </>
              )}
              {m.brouillon && (
                <div className="mt-2 rounded-xl p-3" style={{ background: COLORS.background, border: `1px solid ${COLORS.border}` }}>
                  <p className="text-[10px] uppercase font-bold mb-1" style={{ color: COLORS.accentSecondary }}>{t("ia.brouillonTitre")}</p>
                  <p className="text-sm font-bold">{m.brouillon.nom}</p>
                  <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>{m.brouillon.description}</p>
                  <button
                    onClick={() => utiliserBrouillon(m.brouillon)}
                    className="block mt-3 w-full rounded-lg py-2 text-xs font-bold"
                    style={{ background: COLORS.accentPrimary, color: COLORS.background }}
                  >
                    {t("ia.utiliserBrouillon")}
                  </button>
                </div>
              )}
              {m.transfert && !transfertFait && (
                <button
                  onClick={transmettreALEquipe}
                  disabled={transfertEnCours}
                  className="block mt-2 w-full rounded-lg py-2 text-xs font-bold"
                  style={{ background: COLORS.accentPrimary, color: COLORS.background, opacity: transfertEnCours ? 0.6 : 1 }}
                >
                  {transfertEnCours ? t("ia.transfertEnCours") : t("ia.transfertBouton")}
                </button>
              )}
            </div>
          </div>
        ))}

        {enTrainDecrire && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-3 py-2 text-sm" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.textMuted }}>
              {t("ia.iaEcrit")}
            </div>
          </div>
        )}

        {/* Suggestions rapides */}
        <div className="flex flex-wrap gap-2 mt-2">
          {SUGGESTIONS_RAPIDES.map((item) => (
            <button
              key={item.cle}
              onClick={() => (item.action === "image" ? demarrerImage() : envoyer(t(`ia.${item.cle}`), item))}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full"
              style={{ background: COLORS.surface, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
            >
              <item.icon size={12} color={item.generation ? COLORS.accentPrimary : COLORS.accentSecondary} />
              {t(`ia.${item.cle}`)}
              {item.lourde && limiteAtteinte && <Lock size={10} color={COLORS.textMuted} />}
            </button>
          ))}
        </div>
        <div ref={finMessagesRef} />
      </div>
      </main>

      {/* BARRE DE SAISIE */}
      <div
        className="shrink-0 z-40 px-4 pt-3"
        style={{ background: COLORS.background, borderTop: `1px solid ${COLORS.border}`, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
      >
        <p className="text-[10px] text-center mb-1.5" style={{ color: COLORS.textMuted }}>{t("ia.avertissementConfidentialite")}</p>
        <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <button onClick={clicPhoto} disabled={photoEnCours} aria-label={t("ia.joindreImage")} style={{ opacity: photoEnCours ? 0.5 : 1 }}>
            <ImageIcon size={18} color={COLORS.accentSecondary} />
          </button>
          <input ref={fichierPhotoRef} type="file" accept="image/*" onChange={choisirPhoto} className="hidden" />
          <input
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && envoyer(saisie)}
            placeholder={enTrainDecrire ? t("ia.iaRepond") : t("ia.ecrisOuParle")}
            disabled={enTrainDecrire}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: COLORS.textPrimary }}
          />
          <button onClick={() => envoyer(saisie)} disabled={enTrainDecrire} aria-label={t("discussion.envoyer")}>
            <Send size={18} color={enTrainDecrire ? COLORS.textMuted : COLORS.accentPrimary} />
          </button>
        </div>
      </div>

      {/* FENÊTRE « RÉSERVÉ AUX ABONNÉS » (images et fiches produit) */}
      {modalPlan && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center gap-2 mb-2">
              <Crown size={20} color={COLORS.accentPrimary} />
              <p className="font-bold text-base">{t("ia.planRequisTitre")}</p>
            </div>
            <p className="text-sm mb-4" style={{ color: COLORS.textMuted }}>{t("ia.planRequisTexte")}</p>
            <button
              onClick={() => { setModalPlan(false); onFermer?.(); router.push("/abonnements"); }}
              className="w-full rounded-xl py-3 font-bold text-sm mb-2"
              style={{ background: COLORS.accentPrimary, color: COLORS.background }}
            >
              {t("ia.voirAbonnements")}
            </button>
            <button onClick={() => setModalPlan(false)} className="w-full text-xs py-2" style={{ color: COLORS.textMuted }}>{t("common.fermer")}</button>
          </div>
        </div>
      )}

      {/* MODAL UPSELL PREMIUM */}
      {modalPremium && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center gap-2 mb-2">
              <Crown size={20} color={COLORS.accentPrimary} />
              <p className="font-bold text-base">{t("ia.passeEnPremium")}</p>
            </div>
            <p className="text-sm mb-4" style={{ color: COLORS.textMuted }}>
              {t("ia.generationsAtteintesDesc", { limite: LIMITE_FREE_PAR_JOUR })}
            </p>
            <div className="flex flex-col gap-2 mb-4">
              {[
                { nom: "Basique", prix: "2 000 FCFA/mois" },
                { nom: "Pro", prix: "5 000 FCFA/mois" },
                { nom: "Ultra", prix: "10 000 FCFA/mois" },
              ].map((f) => (
                <button
                  key={f.nom}
                  onClick={() => { setErreurAchat(null); setForfaitEnAttentePin(f.nom); }}
                  disabled={achatEnCours}
                  className="rounded-xl p-3 flex items-center justify-between"
                  style={{ background: COLORS.background, border: `1px solid ${COLORS.border}` }}
                >
                  <span className="text-sm font-semibold">{f.nom}</span>
                  <span className="text-sm" style={{ color: COLORS.accentPrimary }}>{f.prix}</span>
                </button>
              ))}
            </div>
            {erreurAchat && (
              <p className="text-xs mb-3 text-center" style={{ color: "#B23A2E" }}>{erreurAchat}</p>
            )}
            <button
              onClick={() => setModalPremium(false)}
              className="w-full text-center text-xs py-2"
              style={{ color: COLORS.textMuted }}
            >
              {t("ia.plusTard")}
            </button>
          </div>
        </div>
      )}

      <ConfirmationPIN
        ouvert={!!forfaitEnAttentePin}
        theme={theme}
        onAnnuler={() => setForfaitEnAttentePin(null)}
        onSuccess={(pin) => {
          const nomForfait = forfaitEnAttentePin;
          setForfaitEnAttentePin(null);
          acheterForfait(nomForfait, pin);
        }}
      />
    </div>
  );
}
