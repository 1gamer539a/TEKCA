import crypto from "crypto";

/*
  Utilise scrypt (module natif Node, pas de dépendance à ajouter) au
  lieu d'un simple hash SHA — scrypt est volontairement lent et
  coûteux en mémoire, ce qui rend le brute force hors ligne beaucoup
  plus difficile qu'avec un hash rapide. Le sel est généré par
  tentative et stocké à côté du hash (format "sel:hash"), comme pour
  un mot de passe classique.
*/
export function hacherPin(pin) {
  const sel = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, sel, 64).toString("hex");
  return `${sel}:${hash}`;
}

export function verifierPin(pin, hachageStocke) {
  if (!hachageStocke || !hachageStocke.includes(":")) return false;
  const [sel, hashAttendu] = hachageStocke.split(":");
  const hashCalcule = crypto.scryptSync(pin, sel, 64).toString("hex");
  const bufAttendu = Buffer.from(hashAttendu, "hex");
  const bufCalcule = Buffer.from(hashCalcule, "hex");
  // Comparaison en temps constant — évite qu'un attaquant déduise le
  // PIN correct en mesurant le temps de réponse (timing attack).
  if (bufAttendu.length !== bufCalcule.length) return false;
  return crypto.timingSafeEqual(bufAttendu, bufCalcule);
}
