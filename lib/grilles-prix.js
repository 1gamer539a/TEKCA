/*
  Grilles de budget affichées en haut de la liste du Marché, par catégorie (montants en FCFA).
  Chaque palier = [minimum, maximum] ; maximum = null → « et plus ».
  Pour changer une grille, modifie simplement les nombres ci-dessous.
*/
const k = (n) => n * 1000;
const M = (n) => n * 1000000;

export const GRILLES_PRIX = {
  // Téléphones : jusqu'à 2 M
  telephone: [[0, k(5)], [k(5), k(15)], [k(15), k(30)], [k(30), k(60)], [k(60), k(100)], [k(100), k(200)], [k(200), k(400)], [k(400), k(800)], [k(800), M(1.2)], [M(1.2), M(2)]],
  // Véhicules : jusqu'à 100 M
  vehicule: [[0, M(1)], [M(1), M(3)], [M(3), M(5)], [M(5), M(10)], [M(10), M(20)], [M(20), M(40)], [M(40), M(70)], [M(70), M(100)]],
  immobilier: [[0, M(5)], [M(5), M(15)], [M(15), M(40)], [M(40), M(100)], [M(100), M(250)], [M(250), null]],
  high_tech: [[0, k(50)], [k(50), k(100)], [k(100), k(200)], [k(200), k(350)], [k(350), k(500)], [k(500), k(800)], [k(800), M(1.2)], [M(1.2), M(2)], [M(2), M(3)]],
  console_gaming: [[0, k(25)], [k(25), k(75)], [k(75), k(150)], [k(150), k(300)], [k(300), k(600)], [k(600), null]],
  accessoire: [[0, k(2)], [k(2), k(5)], [k(5), k(15)], [k(15), k(30)], [k(30), k(60)], [k(60), null]],
  vetement: [[0, k(5)], [k(5), k(10)], [k(10), k(25)], [k(25), k(50)], [k(50), k(100)], [k(100), null]],
  mode_beaute: [[0, k(5)], [k(5), k(15)], [k(15), k(30)], [k(30), k(60)], [k(60), k(100)], [k(100), null]],
  jouet_enfant: [[0, k(3)], [k(3), k(8)], [k(8), k(20)], [k(20), k(50)], [k(50), null]],
  meuble_deco: [[0, k(25)], [k(25), k(75)], [k(75), k(150)], [k(150), k(300)], [k(300), k(600)], [k(600), null]],
  recharge_jeu: [[0, k(1)], [k(1), k(3)], [k(3), k(10)], [k(10), k(25)], [k(25), k(50)], [k(50), null]],
  abonnement_service: [[0, k(2)], [k(2), k(5)], [k(5), k(10)], [k(10), k(25)], [k(25), null]],
};

export const grillePour = (categorie) => GRILLES_PRIX[categorie] || null;

// 5000 → « 5 kF » ; 1200000 → « 1,2 MF »
export function formaterMontantCourt(n) {
  if (n >= 1000000) return `${String(n / 1000000).replace(".", ",")} MF`;
  return `${String(n / 1000).replace(".", ",")} kF`;
}

// Le dernier palier est inclusif (un téléphone à exactement 2 MF reste trouvable) ; les autres excluent leur maximum.
export function prixDansPalier(prix, grille, indice) {
  const palier = grille?.[indice];
  if (!palier) return true;
  const [min, max] = palier;
  if (prix < min) return false;
  if (max === null) return true;
  return indice === grille.length - 1 ? prix <= max : prix < max;
}
