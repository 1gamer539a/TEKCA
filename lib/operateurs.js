/*
  Association pays → opérateurs Mobile Money réellement supportés par
  SebPay, ET leur slug exact tel qu'affiché dans la colonne "CODE" de
  la page officielle "Liste des opérateurs supportés" (new.sebpay.bj),
  vérifiée par captures d'écran le 14/09. C'est cette valeur `code`
  qu'il faut envoyer telle quelle dans le champ `operator` des appels
  /v1/collections et /v1/payouts (confirmé par l'exemple curl officiel :
  "operator": "mtn").

  La doc affiche une 4e colonne "SLUG" (tronquée sur mobile, ex:
  "wligdicash_bf", "afrimoney_cd") qui semble être un identifiant unique
  interne opérateur+pays — PAS ce qui est attendu dans le champ
  `operator` d'après l'exemple curl officiel (qui utilise juste "mtn",
  pas "mtn_bj"). On utilise donc la colonne CODE ci-dessous, pas SLUG.
  À revérifier si un appel échoue avec "opérateur invalide".

  Le Tchad (TD) n'apparaît PAS dans cette table (ses 2 lignes Airtel/
  Moov sont grisées dans la doc, comme dans le sélecteur de pays) —
  cohérent avec son exclusion de lib/pays.js.

  Quelques opérateurs apparaissent en gris dans la doc (Gabon: Airtel
  Money, Mali: Mobicash, Sénégal: E-money) — probablement des
  opérateurs désactivés/dépréciés côté SebPay. Ils sont quand même
  listés ci-dessous (au cas où ils redeviennent actifs) mais À TESTER
  avant d'être proposés en prod ; commente-les si un appel échoue dessus.

  Tanzanie : la doc affiche les codes en MAJUSCULES et certains avec un
  espace ("EZY PESA", "HALO PESA", "TIGO PESA") — inhabituel pour un
  slug d'API et possiblement un artefact d'affichage. Codes mis en
  minuscule sans espace ci-dessous par cohérence avec le reste de la
  table (ex: "ezypesa") — À CONFIRMER en conditions réelles avant
  d'activer la Tanzanie en prod, ce sont les seuls slugs non vus sous
  leur forme exacte.
*/
export const OPERATEURS_PAR_PAYS = {
  CG: [
    { operateur: "airtel", label: "Airtel Money" },
    { operateur: "mtn", label: "MTN Money" },
  ],
  CM: [
    { operateur: "mtn", label: "MTN Money" },
    { operateur: "orange", label: "Orange Money" },
  ],
  GA: [
    { operateur: "airtel", label: "Airtel Money" }, // grisé dans la doc — à tester
    { operateur: "moov", label: "Moov Money" },
  ],
  CD: [
    { operateur: "afrimoney", label: "Afri Money" },
    { operateur: "airtel", label: "Airtel Money" },
    { operateur: "mpesa", label: "Mpesa Money" },
    { operateur: "orange", label: "Orange Money" },
    { operateur: "vodacom", label: "Vodacom" },
  ],
  CI: [
    { operateur: "moov", label: "Moov Money" },
    { operateur: "mtn", label: "MTN Money" },
    { operateur: "orange", label: "Orange Money" },
    { operateur: "wave", label: "Wave Money" },
  ],
  SN: [
    { operateur: "emoney", label: "E-money" }, // grisé dans la doc — à tester
    { operateur: "free", label: "Free Money" },
    { operateur: "orange", label: "Orange Money" },
    { operateur: "wave", label: "Wave Money" },
  ],
  BJ: [
    { operateur: "celtiis", label: "Celtiis Money" },
    { operateur: "coris", label: "Coris Money" },
    { operateur: "moov", label: "Moov Money" },
    { operateur: "mtn", label: "MTN Money" },
  ],
  TG: [
    { operateur: "moov", label: "Moov Money" },
    { operateur: "tmoney", label: "T-Money" },
  ],
  BF: [
    { operateur: "moov", label: "Moov Money" },
    { operateur: "orange", label: "Orange Money" },
    { operateur: "wligdicash", label: "Wallet LigdiCash" },
  ],
  ML: [
    { operateur: "mobicash", label: "Mobicash" }, // grisé dans la doc — à tester
    { operateur: "moov", label: "Moov Money" },
    { operateur: "orange", label: "Orange Money" },
  ],
  NE: [
    { operateur: "airtel", label: "Airtel Money" },
    { operateur: "amanata", label: "Amanata" },
    { operateur: "moov", label: "Moov Money" },
    { operateur: "nita", label: "Nita" },
    { operateur: "wligdicash", label: "Wallet LigdiCash" },
    { operateur: "zamani", label: "Zamani" },
  ],
  GN: [
    { operateur: "mtn", label: "MTN Money" },
    { operateur: "orange", label: "Orange Money" },
  ],
  GW: [{ operateur: "orange", label: "Orange Money" }],
  GM: [{ operateur: "afrimoney", label: "Afri Money" }],
  GH: [
    { operateur: "airtel", label: "Airtel Money" },
    { operateur: "mtn", label: "MTN Money" },
    { operateur: "telecel", label: "Telecel Cash" },
  ],
  KE: [
    { operateur: "airtel", label: "Airtel Money" },
    { operateur: "mpesa", label: "Mpesa" },
  ],
  NG: [
    { operateur: "airtel", label: "Airtel Money" },
    { operateur: "mtn", label: "MTN Money" },
  ],
  UG: [
    { operateur: "airtel", label: "Airtel Money" },
    { operateur: "mtn", label: "MTN Money" },
  ],
  // Codes non confirmés à 100% (voir note Tanzanie ci-dessus) — teste
  // avant d'ouvrir ce pays aux utilisateurs.
  TZ: [
    { operateur: "airtel", label: "Airtel Money" },
    { operateur: "ezypesa", label: "Ezy Pesa" },
    { operateur: "halopesa", label: "Halo Pesa" },
    { operateur: "mpesa", label: "Mpesa" },
    { operateur: "tigopesa", label: "Tigo Pesa" },
  ],
};

export function operateursPourPays(codePays) {
  return OPERATEURS_PAR_PAYS[codePays] || OPERATEURS_PAR_PAYS.CG;
}
