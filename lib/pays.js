/*
  Source unique pour les pays couverts par Sebpay + leur indicatif
  téléphonique. Basé sur les captures d'écran réelles du sélecteur de
  pays Sebpay (28/08/2026) — 19 pays confirmés (Togo inclus, Tchad
  exclu — absent du sélecteur malgré sa présence sur le site
  marketing Sebpay). À mettre à jour si Sebpay étend sa couverture —
  et à répercuter dans contraintes_pays.sql côté base.
*/
export const PAYS_SEBPAY = [
  { code: "CG", nom: "Congo Brazzaville", indicatif: "+242" },
  { code: "CM", nom: "Cameroun", indicatif: "+237" },
  { code: "GA", nom: "Gabon", indicatif: "+241" },
  { code: "CD", nom: "R.D. Congo", indicatif: "+243" },
  { code: "CI", nom: "Côte d'Ivoire", indicatif: "+225" },
  { code: "SN", nom: "Sénégal", indicatif: "+221" },
  { code: "BJ", nom: "Bénin", indicatif: "+229" },
  { code: "TG", nom: "Togo", indicatif: "+228" },
  { code: "BF", nom: "Burkina Faso", indicatif: "+226" },
  { code: "ML", nom: "Mali", indicatif: "+223" },
  { code: "NE", nom: "Niger", indicatif: "+227" },
  { code: "GN", nom: "Guinée", indicatif: "+224" },
  { code: "GW", nom: "Guinée-Bissau", indicatif: "+245" },
  { code: "GM", nom: "Gambie", indicatif: "+220" },
  { code: "GH", nom: "Ghana", indicatif: "+233" },
  { code: "KE", nom: "Kenya", indicatif: "+254" },
  { code: "NG", nom: "Nigeria", indicatif: "+234" },
  { code: "UG", nom: "Ouganda", indicatif: "+256" },
  { code: "TZ", nom: "Tanzanie", indicatif: "+255" },
];

export function indicatifPourPays(codePays) {
  return PAYS_SEBPAY.find((p) => p.code === codePays)?.indicatif || "+242";
}
