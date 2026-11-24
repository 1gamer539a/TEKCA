/*
  Marques proposées par catégorie. Utilisées à deux endroits :
  - à la mise en ligne (FormulaireProduit) : la marque est OBLIGATOIRE pour ces catégories, pour que
    chaque produit soit classé par marque ;
  - au Marché (LeMarche) : barre de marques pour trouver rapidement ce qu'on cherche.
  « Autre » (clé `autre`) couvre toutes les marques non listées : le vendeur précise alors le nom.
  Pour ajouter une marque connue, il suffit d'ajouter une ligne ici (clé en minuscules, sans espace).
*/
export const MARQUE_AUTRE = "autre";

export const MARQUES = {
  telephone: [
    { cle: "apple", nom: "Apple (iPhone)" },
    { cle: "samsung", nom: "Samsung" },
    { cle: "tecno", nom: "Tecno" },
    { cle: "infinix", nom: "Infinix" },
    { cle: "itel", nom: "itel" },
    { cle: "xiaomi", nom: "Xiaomi" },
    { cle: "redmi", nom: "Redmi" },
    { cle: "poco", nom: "Poco" },
    { cle: "oppo", nom: "Oppo" },
    { cle: "vivo", nom: "Vivo" },
    { cle: "realme", nom: "Realme" },
    { cle: "huawei", nom: "Huawei" },
    { cle: "honor", nom: "Honor" },
    { cle: "motorola", nom: "Motorola" },
    { cle: "nokia", nom: "Nokia" },
    { cle: "google", nom: "Google Pixel" },
    { cle: "oneplus", nom: "OnePlus" },
    { cle: "wiko", nom: "Wiko" },
    { cle: "zte", nom: "ZTE" },
  ],
  // High-Tech = ordinateurs, informatique, TV / Son
  high_tech: [
    { cle: "hp", nom: "HP" },
    { cle: "dell", nom: "Dell" },
    { cle: "lenovo", nom: "Lenovo" },
    { cle: "apple", nom: "Apple" },
    { cle: "asus", nom: "Asus" },
    { cle: "acer", nom: "Acer" },
    { cle: "microsoft", nom: "Microsoft" },
    { cle: "msi", nom: "MSI" },
    { cle: "toshiba", nom: "Toshiba" },
    { cle: "samsung", nom: "Samsung" },
    { cle: "lg", nom: "LG" },
    { cle: "sony", nom: "Sony" },
    { cle: "tcl", nom: "TCL" },
    { cle: "hisense", nom: "Hisense" },
    { cle: "philips", nom: "Philips" },
    { cle: "panasonic", nom: "Panasonic" },
    { cle: "skyworth", nom: "Skyworth" },
    { cle: "nasco", nom: "Nasco" },
    { cle: "jbl", nom: "JBL" },
    { cle: "bose", nom: "Bose" },
    { cle: "huawei", nom: "Huawei" },
    { cle: "xiaomi", nom: "Xiaomi" },
  ],
  console_gaming: [
    { cle: "sony", nom: "Sony (PlayStation)" },
    { cle: "microsoft", nom: "Microsoft (Xbox)" },
    { cle: "nintendo", nom: "Nintendo" },
    { cle: "valve", nom: "Valve (Steam Deck)" },
    { cle: "asus", nom: "Asus (ROG Ally)" },
  ],
  vehicule: [
    { cle: "toyota", nom: "Toyota" },
    { cle: "hyundai", nom: "Hyundai" },
    { cle: "kia", nom: "Kia" },
    { cle: "nissan", nom: "Nissan" },
    { cle: "honda", nom: "Honda" },
    { cle: "mercedes", nom: "Mercedes-Benz" },
    { cle: "bmw", nom: "BMW" },
    { cle: "peugeot", nom: "Peugeot" },
    { cle: "renault", nom: "Renault" },
    { cle: "volkswagen", nom: "Volkswagen" },
    { cle: "ford", nom: "Ford" },
    { cle: "suzuki", nom: "Suzuki" },
    { cle: "mitsubishi", nom: "Mitsubishi" },
    { cle: "mazda", nom: "Mazda" },
    { cle: "lexus", nom: "Lexus" },
    { cle: "landrover", nom: "Land Rover" },
    { cle: "chevrolet", nom: "Chevrolet" },
    { cle: "opel", nom: "Opel" },
    { cle: "citroen", nom: "Citroën" },
    { cle: "isuzu", nom: "Isuzu" },
    { cle: "yamaha", nom: "Yamaha (moto)" },
    { cle: "bajaj", nom: "Bajaj (moto)" },
    { cle: "tvs", nom: "TVS (moto)" },
    { cle: "haojue", nom: "Haojue (moto)" },
  ],
};

export const categorieAvecMarques = (categorie) => Array.isArray(MARQUES[categorie]);

// Nom à afficher pour une marque enregistrée (clé de liste ou « autre » + nom saisi).
export function nomMarque(categorie, cle, marqueAutre, libelleAutre = "Autre") {
  if (!cle) return null;
  if (cle === MARQUE_AUTRE) return marqueAutre || libelleAutre;
  return (MARQUES[categorie] || []).find((m) => m.cle === cle)?.nom || cle;
}
