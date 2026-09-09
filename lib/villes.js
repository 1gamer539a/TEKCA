/*
  Liste indicative de villes principales par pays, utilisée
  uniquement pour la grille de sélection géographique du Marché
  (/marche) — ce n'est PAS une contrainte de données : la ville
  affichée sur chaque annonce reste le texte libre saisi par le
  vendeur (voir DevenirVendeur.jsx), cette liste ne sert qu'à
  proposer des raccourcis pratiques à l'acheteur. "Autre ville"
  reste toujours disponible pour ne bloquer personne.
*/
export const VILLES_PAR_PAYS = {
  CG: ["Brazzaville", "Pointe-Noire", "Dolisie", "Owando"],
  CM: ["Douala", "Yaoundé", "Bafoussam"],
  GA: ["Libreville", "Port-Gentil"],
  CD: ["Kinshasa", "Lubumbashi", "Goma"],
  CI: ["Abidjan", "Bouaké", "Yamoussoukro"],
  SN: ["Dakar", "Thiès", "Touba"],
  BJ: ["Cotonou", "Porto-Novo"],
  TG: ["Lomé", "Kara"],
  BF: ["Ouagadougou", "Bobo-Dioulasso"],
  ML: ["Bamako", "Sikasso"],
  NE: ["Niamey", "Zinder"],
  GN: ["Conakry", "Kankan"],
  GW: ["Bissau"],
  GM: ["Banjul", "Serrekunda"],
  GH: ["Accra", "Kumasi"],
  KE: ["Nairobi", "Mombasa"],
  NG: ["Lagos", "Abuja", "Kano"],
  UG: ["Kampala", "Entebbe"],
  TZ: ["Dar es Salaam", "Dodoma"],
};

export function villesPourPays(codePays) {
  return VILLES_PAR_PAYS[codePays] || [];
}
