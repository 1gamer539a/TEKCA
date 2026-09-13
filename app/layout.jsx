import "./globals.css";
import LayoutRacine from "../components/LayoutRacine";
import { LanguageProvider } from "../lib/i18n/LanguageContext";
import { ThemeProvider } from "../lib/ThemeContext";

export const metadata = {
  title: "TEKÇA",
  description: "TEKÇA — marketplace gaming : accessoires, vêtements, recharges, IA et plus",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <ThemeProvider>
          <LanguageProvider>
            <LayoutRacine>{children}</LayoutRacine>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
