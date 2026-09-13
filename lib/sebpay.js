/*
  IMPORTANT — ce fichier ne doit JAMAIS être importé depuis un
  composant "use client" ni depuis le dossier components/. Il n'est
  utilisé que dans les routes serveur (app/api/.../route.js), où
  process.env.SEEPAY_SECRET_KEY reste invisible au navigateur.

  Basé sur la documentation officielle SeePay Africa (newapi.sebpay.bj) :
  - Auth : headers X-Public-Key / X-Secret-Key
  - POST /v1/payments        → créer un paiement (recharge)
  - GET  /v1/payments/{id}   → vérifier le statut d'un paiement
  - POST /v1/payouts         → effectuer un transfert (retrait)
  - GET  /v1/balance         → consulter le solde du compte marchand

  Payload confirmé par l'exemple officiel : amount, currency (ex: "XAF"),
  operator (ex: "Orange Money", "MTN Mobile Money", "Airtel Money"),
  phone, country (ex: "CG" pour Congo Brazzaville).
  Réponse confirmée : { status: "success"|..., transaction_id: "..." }
*/

const SEEPAY_BASE_URL = process.env.SEEPAY_BASE_URL || "https://newapi.sebpay.bj/api";

function entetesAuth() {
  if (!process.env.SEEPAY_SECRET_KEY || !process.env.SEEPAY_PUBLIC_KEY) {
    throw new Error("SEEPAY_SECRET_KEY / SEEPAY_PUBLIC_KEY non configurées côté serveur (.env.local).");
  }
  return {
    "X-Public-Key": process.env.SEEPAY_PUBLIC_KEY,
    "X-Secret-Key": process.env.SEEPAY_SECRET_KEY,
    "Content-Type": "application/json",
  };
}

/**
 * Initie une recharge (le client paie vers le compte marchand SeePay
 * de la plateforme) via POST /v1/payments.
 */
export async function initierRecharge({ montant, numeroClient, operateur, pays = "CG", devise = "XAF", referenceInterne }) {
  const reponse = await fetch(`${SEEPAY_BASE_URL}/v1/payments`, {
    method: "POST",
    headers: entetesAuth(),
    body: JSON.stringify({
      amount: montant,
      currency: devise,
      operator: operateur,
      phone: numeroClient,
      country: pays,
      reference: referenceInterne,
    }),
  });
  if (!reponse.ok) throw new Error(`Erreur SeePay (recharge) : ${await reponse.text()}`);
  return reponse.json();
}

/**
 * Déclenche un retrait (payout) depuis le compte marchand SeePay de
 * la plateforme vers le numéro Mobile Money du bénéficiaire, via
 * POST /v1/payouts.
 */
export async function initierRetrait({ montant, numeroDestinataire, operateur, pays = "CG", devise = "XAF", referenceInterne }) {
  const reponse = await fetch(`${SEEPAY_BASE_URL}/v1/payouts`, {
    method: "POST",
    headers: entetesAuth(),
    body: JSON.stringify({
      amount: montant,
      currency: devise,
      operator: operateur,
      phone: numeroDestinataire,
      country: pays,
      reference: referenceInterne,
    }),
  });
  if (!reponse.ok) throw new Error(`Erreur SeePay (retrait) : ${await reponse.text()}`);
  return reponse.json();
}

/**
 * Vérifie le statut d'un paiement via GET /v1/payments/{id}.
 */
export async function verifierStatutTransaction(idTransaction) {
  const reponse = await fetch(`${SEEPAY_BASE_URL}/v1/payments/${idTransaction}`, {
    headers: entetesAuth(),
  });
  if (!reponse.ok) throw new Error(`Erreur SeePay (statut) : ${await reponse.text()}`);
  return reponse.json();
}

/**
 * Consulte le solde du compte marchand SeePay (pas le wallet interne
 * d'un utilisateur — celui de la plateforme chez SeePay) via GET /v1/balance.
 */
export async function consulterSoldeMarchand() {
  const reponse = await fetch(`${SEEPAY_BASE_URL}/v1/balance`, {
    headers: entetesAuth(),
  });
  if (!reponse.ok) throw new Error(`Erreur SeePay (solde) : ${await reponse.text()}`);
  return reponse.json();
}
