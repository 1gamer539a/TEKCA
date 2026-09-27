"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Sun, Moon, User, Phone, Mail, LogOut, ChevronRight,
  Bell, Globe, ShieldCheck, Store, Sparkles, HelpCircle, Wallet, Lock, MessageCircle, KeyRound
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/ThemeContext";
import { activerPush, desactiverPush, abonnementPushActif, pushSupporte } from "../lib/push-client";
import { useLanguage } from "../lib/i18n/LanguageContext";

const THEMES = {
  sombre: { background: "#0A1220", surface: "#132039", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#FFFFFF", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", surface: "#F8FAFC", accentPrimary: "#E85D2F", accentSecondary: "#C99A3A", textPrimary: "#0F172A", textMuted: "#64748B", border: "#E2E8F0" },
};

const UTILISATEUR_VIDE = {
  nom: "",
  telephone: "",
  email: "",
  role: "client", // client | vendeur
  forfaitIA: "free",
};

export default function ProfilParametres() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const COLORS = THEMES[theme];
  const [notifsActives, setNotifsActives] = useState(false);
  const [notifsEnCours, setNotifsEnCours] = useState(false);
  const [notifsErreur, setNotifsErreur] = useState(null);
  const [utilisateur, setUtilisateur] = useState(UTILISATEUR_VIDE);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    abonnementPushActif().then(setNotifsActives);
  }, []);

  const basculerNotifs = async () => {
    setNotifsErreur(null);
    setNotifsEnCours(true);
    if (notifsActives) {
      await desactiverPush();
      setNotifsActives(false);
    } else {
      const resultat = await activerPush();
      if (resultat.ok) {
        setNotifsActives(true);
      } else {
        const messages = {
          non_supporte: t("compte.notifNonSupporte"),
          refuse: t("compte.notifRefuse"),
          cle_manquante: t("compte.notifCleManquante"),
          erreur_serveur: t("compte.notifErreurServeur"),
        };
        setNotifsErreur(messages[resultat.raison] || t("compte.notifImpossible"));
      }
    }
    setNotifsEnCours(false);
  };

  useEffect(() => {
    const chargerProfil = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setChargement(false); return; }

      const { data: profil } = await supabase
        .from("users")
        .select("nom, telephone, email, role")
        .eq("id", user.id)
        .single();

      const { data: abo } = await supabase
        .from("ia_abonnements")
        .select("forfait")
        .eq("user_id", user.id)
        .order("date_debut", { ascending: false })
        .limit(1)
        .single();

      setUtilisateur({
        nom: profil?.nom || "",
        telephone: profil?.telephone || "",
        email: profil?.email || user.email || "",
        role: profil?.role || "client",
        forfaitIA: abo?.forfait || "free",
      });
      setChargement(false);
    };
    chargerProfil();
  }, []);

  /*
    signOut() révoque le refresh token côté serveur Supabase — la
    session ne peut pas être rejouée après déconnexion, même si le
    token JWT en mémoire n'a pas encore expiré.
  */
  const seDeconnecter = async () => {
    await fetch("/api/securite/pin/deconnecter", { method: "POST" }).catch(() => {});
    await supabase.auth.signOut();
    router.push("/auth");
  };

  const SECTIONS = [
    {
      titre: t("compte.sectionCompte"),
      items: [
        { label: t("compte.informationsPersonnelles"), icon: User, href: "/compte/informations" },
        { label: t("compte.verifierMonIdentite"), icon: ShieldCheck, href: "/verification-identite" },
        { label: t("compte.mesReclamations"), icon: MessageCircle, href: "/reclamations" },
        { label: t("compte.monPortefeuille"), icon: Wallet, href: "/portefeuille" },
        { label: t("compte.mesCommandes"), icon: Store, href: "/commandes" },
        { label: t("compte.mesAchatsNumeriques"), icon: KeyRound, href: "/achats-numeriques" },
        { label: t("favoris.mesFavoris"), icon: Bell, href: "/favoris" },
        { label: t("compte.langueDevise"), icon: Globe, href: "/compte" },
      ],
    },
    {
      titre: t("compte.sectionBoutique"),
      items: [
        utilisateur.role === "vendeur"
          ? { label: t("compte.monDashboardVendeur"), icon: Store, href: "/dashboard" }
          : { label: t("home.devenirVendeur"), icon: Store, href: "/vendre" },
      ],
    },
    {
      titre: t("compte.sectionIA"),
      items: [
        { label: t("compte.forfaitIA", { forfait: utilisateur.forfaitIA === "premium" ? t("compte.planPremium") : t("compte.planFree") }), icon: Sparkles, href: "/ia" },
      ],
    },
    {
      titre: t("compte.sectionSecurite"),
      items: [
        { label: t("compte.modifierMonCodePin"), icon: Lock, href: "/securite/modifier-pin" },
      ],
    },
    {
      titre: t("compte.sectionSupport"),
      items: [
        { label: t("compte.nousContacter"), icon: HelpCircle, href: "/contact" },
        { label: t("compte.politiqueLivraisonRetours"), icon: ShieldCheck, href: "/politique-livraison" },
      ],
    },
  ];

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", color: COLORS.textPrimary }}>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: COLORS.background, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => router.back()} aria-label={t("common.retour")}><ArrowLeft size={22} color={COLORS.textPrimary} /></button>
        <span className="text-sm font-semibold">{t("compte.monCompte")}</span>
        <button onClick={() => setTheme(theme === "sombre" ? "clair" : "sombre")} aria-label={t("common.changerTheme")}>
          {theme === "sombre" ? <Sun size={20} color={COLORS.accentSecondary} /> : <Moon size={20} color={COLORS.accentSecondary} />}
        </button>
      </header>

      <main className="max-w-md mx-auto w-full px-4 pt-20 pb-10">
        {/* En-tête profil */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <User size={26} color={COLORS.accentPrimary} />
          </div>
          <div>
            <p className="font-bold text-base">{utilisateur.nom}</p>
            <p className="text-xs flex items-center gap-1" style={{ color: COLORS.textMuted }}>
              <Phone size={11} /> {utilisateur.telephone}
            </p>
            <p className="text-xs flex items-center gap-1" style={{ color: COLORS.textMuted }}>
              <Mail size={11} /> {utilisateur.email}
            </p>
          </div>
        </div>

        {/* Toggle notifications */}
        <div className="rounded-xl p-3 mb-6" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={16} color={COLORS.accentSecondary} />
              <span className="text-sm">{t("compte.notificationsPush")}</span>
            </div>
            <button
              onClick={basculerNotifs}
              disabled={notifsEnCours}
              className="w-10 h-6 rounded-full relative"
              style={{ background: notifsActives ? COLORS.accentPrimary : COLORS.border, opacity: notifsEnCours ? 0.6 : 1 }}
            >
              <div
                className="w-4 h-4 rounded-full absolute top-1 transition-all"
                style={{ background: COLORS.background, left: notifsActives ? 22 : 4 }}
              />
            </button>
          </div>
          {notifsErreur && <p className="text-[11px] mt-2" style={{ color: "#B23A2E" }}>{notifsErreur}</p>}
          {!pushSupporte() && !notifsErreur && (
            <p className="text-[11px] mt-2" style={{ color: COLORS.textMuted }}>
              {t("compte.iphoneNotifDesc")}
            </p>
          )}
        </div>

        {/* Sections */}
        {SECTIONS.map((section) => (
          <div key={section.titre} className="mb-5">
            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: COLORS.accentPrimary }}>
              {section.titre}
            </p>
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
              {section.items.map((item, i) => (
                <Link
                  href={item.href || "/compte"}
                  key={item.label}
                  className="w-full flex items-center gap-3 px-3 py-3"
                  style={{
                    background: COLORS.surface,
                    borderBottom: i < section.items.length - 1 ? `1px solid ${COLORS.border}` : "none",
                  }}
                >
                  <item.icon size={16} color={COLORS.accentSecondary} />
                  <span className="flex-1 text-left text-sm">{item.label}</span>
                  <ChevronRight size={15} color={COLORS.textMuted} />
                </Link>
              ))}
            </div>
          </div>
        ))}

        <button
          onClick={seDeconnecter}
          className="w-full rounded-xl py-3 font-semibold flex items-center justify-center gap-2 mt-4"
          style={{ border: `1px solid #B23A2E`, color: "#B23A2E" }}
        >
          <LogOut size={16} /> {t("compte.seDeconnecter")}
        </button>
      </main>
    </div>
  );
}
