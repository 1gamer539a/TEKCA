"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, ShoppingCart, MessageSquare, User } from "lucide-react";
import { useLanguage } from "../lib/i18n/LanguageContext";

const THEMES = {
  sombre: { background: "#0A1220", accentPrimary: "#E85D2F", textMuted: "#8B96AD", border: "#1E2D4A" },
  clair: { background: "#FFFFFF", accentPrimary: "#E85D2F", textMuted: "#64748B", border: "#E2E8F0" },
};

const ONGLETS = [
  { cle: "nav.accueil", icon: Home, href: "/" },
  { cle: "nav.categories", icon: LayoutGrid, href: "/categories" },
  { cle: "nav.panier", icon: ShoppingCart, href: "/panier" },
  { cle: "nav.messages", icon: MessageSquare, href: "/messages" },
  { cle: "nav.compte", icon: User, href: "/compte" },
];

// Pages où la nav principale ne doit PAS s'afficher : elle y ferait
// doublon ou gênerait un autre élément fixé en bas d'écran déjà
// présent sur ces pages (input de chat, résumé de paiement, tunnel
// d'inscription, tableau de bord vendeur qui a ses propres onglets).
const PREFIXES_MASQUES = ["/auth", "/securite", "/admin", "/dashboard", "/panier", "/messages/"];

/*
  CORRECTIF — la nav du bas n'était codée en dur QUE dans HomePage.jsx
  (et dans DashboardVendeur.jsx pour le tableau de bord vendeur) : dès
  qu'on quittait l'accueil pour une autre page (marché, IA, favoris,
  etc.), elle disparaissait purement et simplement, ces pages ne la
  contenant pas. En la montant une seule fois ici, dans
  LayoutRacine.jsx (donc au-dessus de {children} sur CHAQUE page), elle
  reste visible partout sauf sur la petite liste d'exceptions ci-dessus.
  L'onglet actif se déduit maintenant de l'URL réelle (usePathname),
  donc il reste juste même après une navigation directe ou un
  rafraîchissement — avant, activeTab était un state local à
  HomePage.jsx qui n'existait nulle part ailleurs.
*/
export default function NavigationBas({ theme = "clair" }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const COLORS = THEMES[theme] || THEMES.clair;

  if (PREFIXES_MASQUES.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex justify-around py-2"
      style={{ background: COLORS.background, borderTop: `1px solid ${COLORS.border}` }}
    >
      {ONGLETS.map(({ cle, icon: Icon, href }) => {
        const actif = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link href={href} key={cle} className="flex flex-col items-center gap-1">
            <Icon size={20} color={actif ? COLORS.accentPrimary : COLORS.textMuted} />
            <span className="text-[10px]" style={{ color: actif ? COLORS.accentPrimary : COLORS.textMuted }}>
              {t(cle)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
