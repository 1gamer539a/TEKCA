import supabaseAdmin from "./supabaseAdmin";

/*
  Commission VENDEUR — purement basée sur le palier d'abonnement,
  remplace l'ancien barème par catégorie (recharge 3%, vêtement 5%...)
  qui n'a plus lieu d'être depuis la refonte à 4 paliers.
*/
const TAUX_COMMISSION_VENDEUR = {
  premium: 0.01,
  pro: 0.04,
  basic: 0.07,
};
const TAUX_COMMISSION_VENDEUR_GRATUIT = 0.10; // pas d'abonnement actif

/*
  Cashback ACHETEUR — uniquement pour le palier Premium, crédité sur
  le wallet, prélevé sur la commission TEKÇA (jamais sur ce que
  touche le vendeur). Les paliers Basic/Pro n'ont plus de réduction
  de commission côté acheteur — leurs avantages sont ailleurs (badge,
  accès anticipé aux ventes flash, litiges prioritaires...), pas géré
  dans ce fichier.
*/
const TAUX_CASHBACK_ACHETEUR_PREMIUM = 0.05;

/*
  Frais de transfert P2P — dégressifs selon le palier de
  l'EXPÉDITEUR. Marge TEKÇA, jamais déduite du montant reçu par le
  destinataire (l'expéditeur paie montant + frais).
*/
const TAUX_FRAIS_TRANSFERT = {
  premium: 0.01,
  pro: 0.03,
  basic: 0.05,
};
const TAUX_FRAIS_TRANSFERT_GRATUIT = 0.07;

/*
  Limite de produits publiables simultanément — appliquée aussi côté
  base (voir le trigger limiter_produits_par_palier dans
  abonnements_v2_cashback_flash.sql), ceci n'est que pour l'affichage
  côté interface (ex: "8/10 produits utilisés").
*/
const LIMITE_PRODUITS = { premium: null, pro: 200, basic: 50 };
const LIMITE_PRODUITS_GRATUIT = 10;

/*
  Renvoie le palier actif d'un utilisateur ('basic' | 'pro' |
  'premium') ou null s'il n'a pas d'abonnement en cours (= palier
  Gratuit implicite — jamais modélisé comme une vraie ligne
  d'abonnement à 0 FCFA, juste l'absence d'abonnement actif). Un
  abonnement expiré (date_fin dépassée) ne compte jamais, même si
  statut='actif' n'a pas encore été mis à jour par le job quotidien —
  la date fait toujours foi, jamais le seul champ statut.
*/
export async function palierActif(userId) {
  const { data } = await supabaseAdmin
    .from("abonnements_utilisateur")
    .select("palier")
    .eq("user_id", userId)
    .eq("statut", "actif")
    .gte("date_fin", new Date().toISOString())
    .order("date_fin", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.palier || null;
}

export async function tauxCommissionVendeur(userId) {
  const palier = await palierActif(userId);
  return TAUX_COMMISSION_VENDEUR[palier] ?? TAUX_COMMISSION_VENDEUR_GRATUIT;
}

export async function tauxCashbackAcheteur(userId) {
  const palier = await palierActif(userId);
  return palier === "premium" ? TAUX_CASHBACK_ACHETEUR_PREMIUM : 0;
}

export async function tauxFraisTransfert(userId) {
  const palier = await palierActif(userId);
  return TAUX_FRAIS_TRANSFERT[palier] ?? TAUX_FRAIS_TRANSFERT_GRATUIT;
}

export async function limiteProduits(userId) {
  const palier = await palierActif(userId);
  if (palier && LIMITE_PRODUITS[palier] === null) return null; // illimité (premium)
  return LIMITE_PRODUITS[palier] ?? LIMITE_PRODUITS_GRATUIT;
}
