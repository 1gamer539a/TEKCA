/*
  Association pays → opérateurs Mobile Money réellement proposés par
  SebPay (liste officielle des 14 opérateurs : Orange Money, MTN
  Money, Moov Money, Wave Money, Airtel Money, Mpesa, T-Money,
  E-money, Free Money, Celtiis Money, Coris Money, Wallet LigdiCash,
  Afri Money, Vodacom — voir sebpay.africa).

  IMPORTANT : SebPay ne publie pas de tableau détaillé pays↔opérateur
  sur son site public. Le mapping ci-dessous est construit à partir de
  la couverture réelle connue de chaque opérateur dans chaque pays
  (quel opérateur télécom est présent où), PAS d'un tableau officiel
  SebPay confirmé. Vérifie chaque pays une fois en conditions réelles
  (surtout Ghana, Kenya, Ouganda, Tanzanie — absents de la page
  marketing SebPay qui n'annonce que 15 pays d'Afrique de l'Ouest/
  Centre, alors que lib/pays.js en liste 19 d'après le sélecteur du
  formulaire d'inscription Sebpay) et ajuste les clés `operateur`
  ci-dessous si besoin — ce sont ces valeurs qui partent telles
  quelles dans le champ `operator` de l'appel API SebPay.
*/
export const OPERATEURS_PAR_PAYS = {
  CG: [{ operateur: "mtn_mobile_money", label: "MTN Mobile Money" }, { operateur: "airtel_money", label: "Airtel Money" }],
  CM: [{ operateur: "orange_money", label: "Orange Money" }, { operateur: "mtn_mobile_money", label: "MTN Mobile Money" }],
  GA: [{ operateur: "airtel_money", label: "Airtel Money" }, { operateur: "moov_money", label: "Moov Money" }],
  CD: [{ operateur: "orange_money", label: "Orange Money" }, { operateur: "airtel_money", label: "Airtel Money" }, { operateur: "vodacom", label: "Vodacom M-Pesa" }],
  CI: [{ operateur: "orange_money", label: "Orange Money" }, { operateur: "mtn_mobile_money", label: "MTN Mobile Money" }, { operateur: "moov_money", label: "Moov Money" }, { operateur: "wave_money", label: "Wave" }],
  SN: [{ operateur: "orange_money", label: "Orange Money" }, { operateur: "free_money", label: "Free Money" }, { operateur: "wave_money", label: "Wave" }],
  BJ: [{ operateur: "mtn_mobile_money", label: "MTN Mobile Money" }, { operateur: "moov_money", label: "Moov Money" }, { operateur: "celtiis_money", label: "Celtiis Money" }],
  TG: [{ operateur: "t_money", label: "T-Money" }, { operateur: "moov_money", label: "Moov Money (Flooz)" }],
  BF: [{ operateur: "orange_money", label: "Orange Money" }, { operateur: "moov_money", label: "Moov Money" }, { operateur: "coris_money", label: "Coris Money" }],
  ML: [{ operateur: "orange_money", label: "Orange Money" }, { operateur: "moov_money", label: "Moov Money" }],
  NE: [{ operateur: "orange_money", label: "Orange Money" }, { operateur: "moov_money", label: "Moov Money" }, { operateur: "airtel_money", label: "Airtel Money" }],
  GN: [{ operateur: "orange_money", label: "Orange Money" }, { operateur: "mtn_mobile_money", label: "MTN Mobile Money" }],
  GW: [{ operateur: "orange_money", label: "Orange Money" }, { operateur: "mtn_mobile_money", label: "MTN Mobile Money" }],
  GM: [{ operateur: "afri_money", label: "Afri Money" }],
  GH: [{ operateur: "mtn_mobile_money", label: "MTN Mobile Money" }],
  KE: [{ operateur: "mpesa", label: "M-Pesa" }],
  NG: [{ operateur: "wallet_ligdicash", label: "LigdiCash" }],
  UG: [{ operateur: "mtn_mobile_money", label: "MTN Mobile Money" }, { operateur: "airtel_money", label: "Airtel Money" }],
  TZ: [{ operateur: "vodacom", label: "Vodacom M-Pesa" }, { operateur: "airtel_money", label: "Airtel Money" }],
};

export function operateursPourPays(codePays) {
  return OPERATEURS_PAR_PAYS[codePays] || OPERATEURS_PAR_PAYS.CG;
}
