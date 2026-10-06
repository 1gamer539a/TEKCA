import "./globals.css";
import LayoutRacine from "../components/LayoutRacine";
import GardePIN from "../components/GardePIN";
import RetourToucher from "../components/RetourToucher";
import { LanguageProvider } from "../lib/i18n/LanguageContext";
import { ThemeProvider } from "../lib/ThemeContext";

export const metadata = {
  title: "TEKÇA",
  description: "TEKÇA — marketplace gaming : accessoires, vêtements, recharges, IA et plus",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport = {
  themeColor: "#E85D2F",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <ThemeProvider>
          <LanguageProvider>
            <GardePIN />
            <RetourToucher />
            <LayoutRacine>{children}</LayoutRacine>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
