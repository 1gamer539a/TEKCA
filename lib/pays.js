/*
  Source unique pour les pays couverts par Sebpay + leur indicatif
  téléphonique. Basé sur les captures d'écran réelles du sélecteur de
  pays Sebpay (28/08/2026) — 19 pays confirmés (Togo inclus, Tchad
  exclu — absent du sélecteur malgré sa présence sur le site
  marketing Sebpay). À mettre à jour si Sebpay étend sa couverture —
  et à répercuter dans contraintes_pays.sql côté base.
*/
export const PAYS_SEBPAY = [
  { code: "CG", nom: "Congo Brazzaville", indicatif: "+242", drapeau: "🇨🇬" },
  { code: "CM", nom: "Cameroun", indicatif: "+237", drapeau: "🇨🇲" },
  { code: "GA", nom: "Gabon", indicatif: "+241", drapeau: "🇬🇦" },
  { code: "CD", nom: "R.D. Congo", indicatif: "+243", drapeau: "🇨🇩" },
  { code: "CI", nom: "Côte d'Ivoire", indicatif: "+225", drapeau: "🇨🇮" },
  { code: "SN", nom: "Sénégal", indicatif: "+221", drapeau: "🇸🇳" },
  { code: "BJ", nom: "Bénin", indicatif: "+229", drapeau: "🇧🇯" },
  { code: "TG", nom: "Togo", indicatif: "+228", drapeau: "🇹🇬" },
  { code: "BF", nom: "Burkina Faso", indicatif: "+226", drapeau: "🇧🇫" },
  { code: "ML", nom: "Mali", indicatif: "+223", drapeau: "🇲🇱" },
  { code: "NE", nom: "Niger", indicatif: "+227", drapeau: "🇳🇪" },
  { code: "GN", nom: "Guinée", indicatif: "+224", drapeau: "🇬🇳" },
  { code: "GW", nom: "Guinée-Bissau", indicatif: "+245", drapeau: "🇬🇼" },
  { code: "GM", nom: "Gambie", indicatif: "+220", drapeau: "🇬🇲" },
  { code: "GH", nom: "Ghana", indicatif: "+233", drapeau: "🇬🇭" },
  { code: "KE", nom: "Kenya", indicatif: "+254", drapeau: "🇰🇪" },
  { code: "NG", nom: "Nigeria", indicatif: "+234", drapeau: "🇳🇬" },
  { code: "UG", nom: "Ouganda", indicatif: "+256", drapeau: "🇺🇬" },
  { code: "TZ", nom: "Tanzanie", indicatif: "+255", drapeau: "🇹🇿" },
];

export function indicatifPourPays(codePays) {
  return PAYS_SEBPAY.find((p) => p.code === codePays)?.indicatif || "+242";
}

export function drapeauPourPays(codePays) {
  return PAYS_SEBPAY.find((p) => p.code === codePays)?.drapeau || "🌍";
}

export function nomPourPays(codePays) {
  return PAYS_SEBPAY.find((p) => p.code === codePays)?.nom || codePays;
}
