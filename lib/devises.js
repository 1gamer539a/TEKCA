/*
  Devises par pays et conversion à partir du FCFA.

  PRINCIPE : TEKÇA fonctionne en FCFA (prix, commissions, séquestre, solde,
  remboursements). L'utilisateur saisit toujours un montant en FCFA. Seul
  l'appel au prestataire de paiement (recharge / retrait) est fait dans la
  devise du pays de l'utilisateur, avec un taux enregistré dans la table
  `taux_change` (mise à jour à la main par l'équipe : Salle de surveillance
  > Taux de change). Le solde de l'utilisateur, lui, reste en FCFA.

  - Pays en FCFA (XAF / XOF) : aucune conversion, aucun taux nécessaire.
  - Autres pays : sans taux saisi, l'opération est refusée (rien n'est inventé).
  - MARGE_CHANGE couvre les variations du taux entre deux mises à jour :
    l'utilisateur paie un peu plus à la recharge et reçoit un peu moins au
    retrait. Mets 0 pour la supprimer.
  - Les codes de devise (3 lettres) sont ceux de la norme ISO 4217 ; à
    vérifier auprès du prestataire de paiement pays par pays.
*/
export const DEVISE_PAR_PAYS = {
  CG: "XAF", CM: "XAF", GA: "XAF", TD: "XAF",
  CI: "XOF", SN: "XOF", BJ: "XOF", TG: "XOF", BF: "XOF", ML: "XOF", NE: "XOF", GW: "XOF",
  CD: "CDF", GN: "GNF", GM: "GMD", GH: "GHS", NG: "NGN", KE: "KES", UG: "UGX", TZ: "TZS",
};
export const MARGE_CHANGE = 0.02;

const SANS_DECIMALES = ["XAF", "XOF", "CDF", "GNF", "UGX", "TZS"];

export function deviseDuPays(codePays) {
  return DEVISE_PAR_PAYS[codePays] || "XAF";
}
export function estFCFA(devise) {
  return devise === "XAF" || devise === "XOF";
}
export function decimalesDevise(devise) {
  return SANS_DECIMALES.includes(devise) ? 0 : 2;
}

// Unités de devise locale pour 1 000 FCFA, ou null si aucun taux n'est saisi.
export async function tauxPour(supabaseAdmin, devise) {
  if (estFCFA(devise)) return 1000;
  const { data } = await supabaseAdmin.from("taux_change").select("unites_pour_1000_fcfa").eq("devise", devise).maybeSingle();
  const taux = Number(data?.unites_pour_1000_fcfa);
  return Number.isFinite(taux) && taux > 0 ? taux : null;
}

// sens "recharge" : l'utilisateur paie (arrondi au-dessus, marge en plus)
// sens "retrait"  : l'utilisateur reçoit (arrondi en dessous, marge en moins)
export function convertirDepuisFCFA(montantFcfa, taux, devise, sens) {
  if (estFCFA(devise)) return Number(montantFcfa);
  const facteur = sens === "retrait" ? 1 - MARGE_CHANGE : 1 + MARGE_CHANGE;
  const p = 10 ** decimalesDevise(devise);
  const valeur = Math.round(((Number(montantFcfa) * taux) / 1000) * facteur * p * 1e6) / 1e6;
  return (sens === "retrait" ? Math.floor(valeur) : Math.ceil(valeur)) / p;
}
