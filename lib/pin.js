import crypto from "crypto";

/*
  Utilise scrypt (module natif Node, pas de dépendance à ajouter) au
  lieu d'un simple hash SHA — scrypt est volontairement lent et
  coûteux en mémoire, ce qui rend le brute force hors ligne beaucoup
  plus difficile qu'avec un hash rapide. Le sel est généré par
  tentative et stocké à côté du hash.

  CORRECTIF — le coût scrypt par défaut (N=16384, pensé pour un mot
  de passe) rendait la vérification du PIN perceptiblement lente sur
  les fonctions serverless de Vercel (CPU limité) : l'app semblait
  "se figer" après avoir tapé le code. Un PIN à 4 chiffres n'a que
  10 000 combinaisons possibles — sa vraie protection vient du
  rate-limit en ligne (5 essais / 15 min dans verifier/route.js), pas
  d'un coût de calcul élevé qui ne fait que ralentir chaque
  vérification légitime. N=2048 reste largement plus coûteux qu'un
  hash simple tout en étant nettement plus rapide.

  Le coût est stocké DANS le hachage ("N:sel:hash") pour rester
  compatible avec les PIN déjà enregistrés avant ce changement (créés
  avec l'ancien coût, format "sel:hash" sans N) — sans ça, tous les
  PIN existants auraient cessé de fonctionner du jour au lendemain.
*/
const COUT_PAR_DEFAUT_HISTORIQUE = 16384;
const COUT_RAPIDE = 2048;

export function hacherPin(pin) {
  const sel = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, sel, 64, { N: COUT_RAPIDE }).toString("hex");
  return `${COUT_RAPIDE}:${sel}:${hash}`;
}

export function verifierPin(pin, hachageStocke) {
  if (!hachageStocke) return false;
  const parties = hachageStocke.split(":");

  let cout, sel, hashAttendu;
  if (parties.length === 3) {
    [cout, sel, hashAttendu] = parties;
    cout = Number(cout);
  } else if (parties.length === 2) {
    // Ancien format, sans coût explicite — hachage créé avant ce
    // correctif, vérifié avec l'ancien coût historique.
    [sel, hashAttendu] = parties;
    cout = COUT_PAR_DEFAUT_HISTORIQUE;
  } else {
    return false;
  }

  const hashCalcule = crypto.scryptSync(pin, sel, 64, { N: cout }).toString("hex");
  const bufAttendu = Buffer.from(hashAttendu, "hex");
  const bufCalcule = Buffer.from(hashCalcule, "hex");
  // Comparaison en temps constant — évite qu'un attaquant déduise le
  // PIN correct en mesurant le temps de réponse (timing attack).
  if (bufAttendu.length !== bufCalcule.length) return false;
  return crypto.timingSafeEqual(bufAttendu, bufCalcule);
}
