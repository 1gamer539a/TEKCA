/*
  Détecte et floute, dans un message : les numéros de téléphone
  (chiffres, avec ou sans espaces/tirets/points), les numéros écrits
  en toutes lettres ("zéro six vingt..."), et les mentions de réseaux
  sociaux/messageries externes (WhatsApp, Instagram, TikTok,
  Snapchat, Telegram, Facebook) accompagnées d'un pseudo probable.

  Honnête sur les limites : ceci couvre les tournures courantes, pas
  toutes les variantes possibles. Quelqu'un de suffisamment motivé
  trouvera toujours une façon d'écrire un numéro qui passe à travers
  (ex: avec des caractères invisibles, des synonymes obscurs). C'est
  un filtre raisonnable, pas une garantie à 100%.
*/

// Suites de 7 chiffres ou plus, espaces/tirets/points tolérés entre
// les chiffres (couvre +242 06 xxx xx xx, 06.xxx.xx.xx, 06xxxxxxxx...)
const REGEX_NUMERO_CHIFFRES = /(\+?\d[\d\s\-.]{6,}\d)/g;

const CHIFFRES_EN_LETTRES = [
  "zéro", "zero", "un", "une", "deux", "trois", "quatre", "cinq",
  "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize",
  "quatorze", "quinze", "seize", "vingt", "trente", "quarante",
  "cinquante", "soixante", "cent",
];
// Détecte une SUITE d'au moins 5 mots-nombres à la suite (avec
// tirets, espaces ou "et" entre eux) — un seul chiffre en toutes
// lettres perdu dans une phrase normale ne déclenche rien.
const REGEX_NUMERO_LETTRES = new RegExp(
  `\\b((?:${CHIFFRES_EN_LETTRES.join("|")})(?:[\\s\\-]+(?:et[\\s\\-]+)?(?:${CHIFFRES_EN_LETTRES.join("|")})){4,}\\b)`,
  "gi"
);

const MOTS_CLES_RESEAUX = [
  "whatsapp", "whats app", "wtsp", "insta", "instagram", "tiktok", "tik tok",
  "snap", "snapchat", "telegram", "facebook", "messenger", "numéro", "numero",
  "appelle-moi", "appelle moi", "contacte-moi", "contacte moi",
];
const REGEX_MOT_CLE_RESEAU = new RegExp(`\\b(${MOTS_CLES_RESEAUX.join("|")})\\b`, "gi");

export function flouterContenu(texteOriginal) {
  let texte = texteOriginal;
  let detecte = false;

  texte = texte.replace(REGEX_NUMERO_CHIFFRES, (correspondance) => {
    detecte = true;
    return "•••• masqué ••••";
  });

  texte = texte.replace(REGEX_NUMERO_LETTRES, () => {
    detecte = true;
    return "•••• masqué ••••";
  });

  texte = texte.replace(REGEX_MOT_CLE_RESEAU, (correspondance) => {
    detecte = true;
    return "•••• masqué ••••";
  });

  return { texte, detecte };
}
