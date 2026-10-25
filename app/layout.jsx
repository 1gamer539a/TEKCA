import "./globals.css";
import LayoutRacine from "../components/LayoutRacine";
import GardePIN from "../components/GardePIN";
import RetourToucher from "../components/RetourToucher";
import SurveillanceMaintenance from "../components/SurveillanceMaintenance";
import { LanguageProvider } from "../lib/i18n/LanguageContext";
import { ThemeProvider } from "../lib/ThemeContext";
import { PAYS_SEBPAY } from "../lib/pays";
import { headers } from "next/headers";
import AntiDoubleClic from "../components/AntiDoubleClic";

const SITE_URL = "https://tekca.store";
const DESCRIPTION =
  "TEKÇA (tekca.store) — marketplace panafricaine : accessoires gaming, vêtements, recharges, abonnements, assistant IA, événements, formations et marketing digital. Achats protégés par séquestre.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "TEKÇA — Tout le e-commerce, un seul écosystème", template: "%s | TEKÇA" },
  description: DESCRIPTION,
  applicationName: "TEKÇA",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "TEKÇA",
    title: "TEKÇA — Tout le e-commerce, un seul écosystème",
    description: DESCRIPTION,
    locale: "fr_FR",
    images: [{ url: "/logo-tekca.png", alt: "Logo TEKÇA" }],
  },
  twitter: { card: "summary", title: "TEKÇA", description: DESCRIPTION, images: ["/logo-tekca.png"] },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

// Carte d'identité officielle pour Google (Schema.org / JSON-LD) : lève la
// confusion avec des services au nom proche en donnant le nom, le site, le
// logo et les comptes officiels de TEKÇA.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organisation`,
      name: "TEKÇA",
      alternateName: ["TEKCA", "Tekca", "tekca.store"],
      url: SITE_URL,
      logo: `${SITE_URL}/logo-tekca.png`,
      description: DESCRIPTION,
      disambiguatingDescription:
        "TEKÇA (tekca.store) est une marketplace panafricaine multi-catégories avec paiement sécurisé par séquestre. À ne pas confondre avec d'autres services au nom proche.",
      sameAs: ["https://www.instagram.com/tekca3/"],
      areaServed: PAYS_SEBPAY.map((p) => ({ "@type": "Country", name: p.nom })),
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#site`,
      url: SITE_URL,
      name: "TEKÇA",
      alternateName: "TEKCA",
      inLanguage: "fr",
      publisher: { "@id": `${SITE_URL}/#organisation` },
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/recherche?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export const viewport = {
  themeColor: "#E85D2F",
};

export default function RootLayout({ children }) {
  // Lire les en-têtes rend toutes les pages dynamiques : indispensable pour que
  // chaque affichage reçoive son propre nonce CSP (une page générée à l'avance
  // n'en aurait pas et ses scripts seraient bloqués en mode "enforce").
  const nonce = headers().get("x-nonce") || undefined;
  return (
    <html lang="fr">
      <body>
        <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
        <AntiDoubleClic />
        <ThemeProvider>
          <LanguageProvider>
            <GardePIN />
            <RetourToucher />
            <SurveillanceMaintenance />
            <LayoutRacine>{children}</LayoutRacine>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
