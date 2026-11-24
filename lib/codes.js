/*
  Alphabet volontairement privé des caractères ambigus à l'oral/à
  l'écrit (0/O, 1/I/L) — ces codes sont lus à voix haute ou recopiés
  à la main entre acheteur et vendeur (code de livraison) ou tapés
  pour un transfert (identifiant client), une confusion coûte du
  temps ou une commande bloquée.
*/
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

// crypto.getRandomValues (et non Math.random, prévisible) : ces codes
// protègent de l'argent (code de livraison) ou identifient un compte.
// L'alphabet fait 32 caractères : 256 % 32 === 0, donc aucun biais.
export function genererCodeAlphanumerique(longueur) {
  const octets = new Uint8Array(longueur);
  globalThis.crypto.getRandomValues(octets);
  let code = "";
  for (let i = 0; i < longueur; i++) code += ALPHABET[octets[i] % ALPHABET.length];
  return code;
}
