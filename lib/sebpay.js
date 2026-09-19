/*
  IMPORTANT — ce fichier ne doit JAMAIS être importé depuis un
  composant "use client" ni depuis le dossier components/. Il n'est
  utilisé que dans les routes serveur (app/api/.../route.js), où
  process.env.SEEPAY_SECRET_KEY reste invisible au navigateur.

  Basé sur la documentation officielle SebPay Africa (new.sebpay.bj),
  vérifiée directement dans la doc (captures du 13/09) :

  - Auth : headers X-Public-Key (pk_live_/pk_test_) et
    X-Secret-Key (sk_live_/sk_test_).

  - TOUTES les réponses de l'API sont enveloppées dans un objet commun :
      { "success": true|false, "data": { ... }, "message": "..." }
    → les fonctions ci-dessous renvoient directement le contenu de
      "data" (pas l'enveloppe complète), et lèvent une erreur si
      success === false même quand le HTTP status est 2xx.

  - POST /v1/collections        → créer une recharge (le client paie la plateforme) [CONFIRMÉ]
    Body : amount, currency (3 lettres), phone (sans le +), operator (slug: mtn/moov/orange/wav...),
           country (code ISO2: BJ/CI/SN...), external_reference (idempotence),
           callback_url (optionnel), otp_code (optionnel — requis pour certains opérateurs,
           ex Orange CI/BF/SN — voir GET /operators pour savoir si otp_required)
    Réponse (data) : transaction_id, status ("pending" à la création), external_reference,
                     amount, currency, provider_link (optionnel — si présent, l'utilisateur
                     DOIT être redirigé vers cette URL dans un nouvel onglet, ex: Wave),
                     message

  - GET  /v1/collections/{id_or_reference}  → statut d'une recharge [CONFIRMÉ]
    Réponse (data) : transaction_id, external_reference, status ("pending"|"approved"|"rejected"),
                     amount, currency, created_at, updated_at

  - POST /v1/payouts            → créer un retrait [CONFIRMÉ]
    Body : recipient_name, phone (sans le +), operator, country, amount, currency,
           external_reference, callback_url (optionnel), description (optionnel, 500 car max)
    Réponse (data) : transaction_id, status ("pending" à la création), external_reference,
                     amount, fee_amount, total_deducted, currency, created_at, updated_at

  - GET  /v1/payouts/{id_or_reference}  → statut d'un retrait [CONFIRMÉ]
    Réponse (data) : transaction_id, external_reference, status ("pending"|"approved"|"rejected"),
                     amount, fee_amount, currency, created_at, updated_at

  - Statut final (recharge ET retrait) livré par webhook à callback_url — le GET
    ci-dessus n'est qu'un complément de polling, pas le mécanisme principal
    (recommandation explicite de la doc SebPay : "Ne vous reposez pas uniquement
    sur la consultation manuelle pour confirmer les paiements").
    En cas de "rejected" sur un payout, SebPay rembourse automatiquement le wallet marchand.

  - GET /operators               → liste des slugs d'opérateurs valides par pays,
    avec un champ otp_required par opérateur [mentionné dans la doc, pas encore
    consulté en détail — pas encore utilisé dans ce fichier]

  Encore À CONFIRMER (pas vu dans les captures reçues jusqu'ici) :
  - GET /v1/balance               → solde du compte marchand (deviné, pas vu dans la doc)
*/

const SEEPAY_BASE_URL = process.env.SEEPAY_BASE_URL || "https://newapi.sebpay.bj/api";

function entetesAuth() {
  if (!process.env.SEEPAY_SECRET_KEY || !process.env.SEEPAY_PUBLIC_KEY) {
    throw new Error("SEEPAY_SECRET_KEY / SEEPAY_PUBLIC_KEY non configurées — ajoute-les dans Vercel (Project Settings → Environment Variables), pas seulement en local.");
  }
  return {
    "X-Public-Key": process.env.SEEPAY_PUBLIC_KEY,
    "X-Secret-Key": process.env.SEEPAY_SECRET_KEY,
    "Content-Type": "application/json",
  };
}

// SebPay veut le téléphone SANS le "+" (ex: "22997000000"), alors que le
// reste de la plateforme stocke les numéros avec un "+" devant l'indicatif.
function sansIndicatifPlus(numero) {
  return (numero || "").replace(/^\+/, "");
}

/**
 * Toutes les réponses SebPay sont enveloppées dans { success, data, message }.
 * Cette fonction fait l'appel, parse le JSON, et renvoie "data" — en levant
 * une erreur si le HTTP status n'est pas ok OU si success === false (l'un
 * n'implique pas forcément l'autre selon les API).
 */
async function appelSebpay(url, options, libelleErreur) {
  const reponse = await fetch(url, options);
  const texteBrut = await reponse.text();
  let enveloppe;
  try {
    enveloppe = JSON.parse(texteBrut);
  } catch {
    throw new Error(`Erreur SeePay (${libelleErreur}) : réponse non-JSON — ${texteBrut.slice(0, 300)}`);
  }
  if (!reponse.ok || enveloppe.success === false) {
    // On logue l'enveloppe COMPLÈTE côté serveur (visible dans Vercel →
    // Logs) — le champ "message" est parfois trop générique ("Failed to
    // initiate collection"), mais SebPay peut renvoyer d'autres champs
    // utiles (ex: un objet "errors" avec le détail par champ) qu'on ne
    // veut pas perdre silencieusement.
    console.error(`[SebPay ${libelleErreur}] HTTP ${reponse.status} —`, JSON.stringify(enveloppe));
    throw new Error(`Erreur SeePay (${libelleErreur}) : ${enveloppe.message || texteBrut}`);
  }
  return enveloppe.data;
}

// URL absolue du webhook à passer en callback_url pour recharge et retrait.
// NEXT_PUBLIC_SITE_URL doit être définie sur Vercel (ex: https://tekca.vercel.app),
// sinon on retombe sur VERCEL_URL (auto-injectée par Vercel, sans protocole).
// Plus de secret dans l'URL : la sécurité vient maintenant de la
// signature HMAC-SHA256 vérifiée dans webhook-sebpay/route.js.
export function urlWebhookSebpay() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return `${base}/api/wallet/webhook-sebpay`;
}

/**
 * Initie une recharge (le client paie vers le compte marchand SebPay
 * de la plateforme) via POST /v1/collections.
 *
 * callbackUrl : à passer explicitement (l'URL du webhook de recharge)
 * pour que SebPay notifie bien la confirmation finale — sans ça, le
 * paiement resterait "pending" côté plateforme indéfiniment.
 *
 * Le retour peut contenir provider_link (ex: Wave) — si présent, la
 * route appelante DOIT renvoyer cette URL au frontend pour redirection,
 * sinon l'utilisateur ne peut pas valider le paiement.
 */
export async function initierRecharge({ montant, numeroClient, operateur, pays = "CG", devise = "XAF", referenceInterne, callbackUrl, otpCode }) {
  const corpsRequete = {
    amount: montant,
    currency: devise,
    operator: operateur,
    phone: sansIndicatifPlus(numeroClient),
    country: pays,
    external_reference: referenceInterne,
    ...(callbackUrl ? { callback_url: callbackUrl } : {}),
    ...(otpCode ? { otp_code: otpCode } : {}),
  };
  // Logué côté serveur (Vercel → Logs) pour pouvoir corréler avec
  // l'erreur renvoyée par SebPay en cas d'échec — aucune clé secrète
  // dedans, uniquement les données de la transaction.
  console.log("[SebPay recharge] body envoyé :", JSON.stringify(corpsRequete));
  return appelSebpay(
    `${SEEPAY_BASE_URL}/v1/collections`,
    {
      method: "POST",
      headers: entetesAuth(),
      body: JSON.stringify(corpsRequete),
    },
    "recharge"
  );
}

/**
 * Déclenche un retrait (payout) depuis le compte marchand SebPay de
 * la plateforme vers le numéro Mobile Money du bénéficiaire, via
 * POST /v1/payouts. Le montant total (montant + frais SebPay) est
 * débité immédiatement du wallet marchand côté SebPay ; en cas
 * d'échec agrégateur, SebPay rembourse automatiquement et le statut
 * passe à "rejected".
 */
export async function initierRetrait({ montant, numeroDestinataire, nomDestinataire, operateur, pays = "CG", devise = "XAF", referenceInterne, callbackUrl, description }) {
  return appelSebpay(
    `${SEEPAY_BASE_URL}/v1/payouts`,
    {
      method: "POST",
      headers: entetesAuth(),
      body: JSON.stringify({
        recipient_name: nomDestinataire,
        amount: montant,
        currency: devise,
        operator: operateur,
        phone: sansIndicatifPlus(numeroDestinataire),
        country: pays,
        external_reference: referenceInterne,
        ...(callbackUrl ? { callback_url: callbackUrl } : {}),
        ...(description ? { description } : {}),
      }),
    },
    "retrait"
  );
}

/**
 * Vérifie le statut d'un retrait via GET /v1/payouts/{id_or_reference}.
 * idOuReference peut être l'identifiant SebPay (transaction_id) OU
 * l'external_reference envoyée à l'initiation.
 */
export async function verifierStatutRetrait(idOuReference) {
  return appelSebpay(
    `${SEEPAY_BASE_URL}/v1/payouts/${idOuReference}`,
    { headers: entetesAuth() },
    "statut retrait"
  );
}

/**
 * Vérifie le statut d'une recharge via GET /v1/collections/{id_or_reference}.
 */
export async function verifierStatutRecharge(idOuReference) {
  return appelSebpay(
    `${SEEPAY_BASE_URL}/v1/collections/${idOuReference}`,
    { headers: entetesAuth() },
    "statut recharge"
  );
}

/**
 * Consulte le solde du compte marchand SebPay (pas le wallet interne
 * d'un utilisateur — celui de la plateforme chez SebPay) via GET /v1/balance.
 * NON CONFIRMÉ par la doc consultée jusqu'ici — à vérifier si utilisé.
 */
export async function consulterSoldeMarchand() {
  return appelSebpay(
    `${SEEPAY_BASE_URL}/v1/balance`,
    { headers: entetesAuth() },
    "solde"
  );
}
