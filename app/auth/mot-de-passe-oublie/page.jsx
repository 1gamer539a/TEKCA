import { Suspense } from "react";
import OubliMotDePasse from "../../../components/OubliMotDePasse";

export const metadata = { title: "Mot de passe oublié", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OubliMotDePasse />
    </Suspense>
  );
}
