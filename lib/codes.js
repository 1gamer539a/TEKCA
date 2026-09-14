/*
  Alphabet volontairement privé des caractères ambigus à l'oral/à
  l'écrit (0/O, 1/I/L) — ces codes sont lus à voix haute ou recopiés
  à la main entre acheteur et vendeur (code de livraison) ou tapés
  pour un transfert (identifiant client), une confusion coûte du
  temps ou une commande bloquée.
*/
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function genererCodeAlphanumerique(longueur) {
  let code = "";
  for (let i = 0; i < longueur; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
