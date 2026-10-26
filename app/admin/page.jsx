import SalleSurveillance from "../../components/SalleSurveillance";

// Adresse officielle de l'administration : https://tekca.store/admin
// (avant, seule /admin/signalements existait : /admin renvoyait « This page could not be found »).
// L'accès reste contrôlé par middleware.js, par /api/admin/moi et par les règles de la base.
export const metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

export default function PageAdmin() {
  return <SalleSurveillance />;
}
