import { NextResponse } from "next/server";
import crypto from "crypto";
import supabaseAdmin from "../../../../lib/supabaseAdmin";

/*
  URL à passer comme callback_url à l'initiation de CHAQUE recharge et
  CHAQUE retrait (voir lib/sebpay.js) — SebPay appelle cette route
  lui-même quand une transaction atteint un statut final, jamais le
  navigateur du client.

  SÉCURITÉ — CONFIRMÉ par la doc SebPay (section Webhooks) : chaque
  requête webhook porte un header `X-SebPay-Signature` contenant un
  HMAC-SHA256 du corps JSON BRUT, calculé avec la même clé secrète
  (SEEPAY_SECRET_KEY, sk_live_/sk_test_) utilisée pour authentifier nos
  propres appels à l'API. Pas de secret séparé à configurer : on
  réutilise SEEPAY_SECRET_KEY pour vérifier la signature ci-dessous.

  IMPORTANT : on doit calculer le HMAC sur le corps EXACTEMENT tel que
  reçu (texte brut), jamais sur JSON.stringify(objetParsé) — reparser
  puis restringifier peut réordonner les clés et casser la vérification
  (avertissement explicite de la doc SebPay). D'où req.text() puis
  JSON.parse manuel ci-dessous, plutôt que req.json().

  Payload confirmé (doc SebPay) : transaction_id, external_reference,
  status ("approved"|"rejected"|"pending"), amount, currency,
  customer_phone, created_at, updated_at.

  recharge ET retrait passent tous les deux par cette même route (le
  champ "type" de transactions_wallet distingue les deux) — la doc
  confirme que /v1/collections ET /v1/payouts utilisent le même format
  de webhook.
*/
export async function POST(req) {
  try {
    if (!process.env.SEEPAY_SECRET_KEY) {
      console.error("SEEPAY_SECRET_KEY absent — impossible de vérifier la signature du webhook Sebpay.");
      return NextResponse.json({ error: "Webhook non configuré." }, { status: 503 });
    }

    const corpsBrut = await req.text();
    const signatureRecue = req.headers.get("x-sebpay-signature");

    if (!signatureRecue) {
      return NextResponse.json({ error: "Signature manquante." }, { status: 401 });
    }

    const signatureAttendue = crypto
      .createHmac("sha256", process.env.SEEPAY_SECRET_KEY)
      .update(corpsBrut)
      .digest("hex");

    // Comparaison à temps constant pour éviter une attaque par timing.
    // Les deux chaînes doivent faire la même longueur, sinon
    // timingSafeEqual lève une exception — on rejette proprement dans ce cas.
    const bufferRecu = Buffer.from(signatureRecue);
    const bufferAttendu = Buffer.from(signatureAttendue);
    const signatureValide =
      bufferRecu.length === bufferAttendu.length && crypto.timingSafeEqual(bufferRecu, bufferAttendu);

    if (!signatureValide) {
      return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
    }

    const payload = JSON.parse(corpsBrut);
    const referenceInterne = payload.external_reference; // = transactions_wallet.id envoyé à l'initiation
    const statutSebpay = payload.status;

    if (!referenceInterne) {
      return NextResponse.json({ error: "external_reference manquante" }, { status: 400 });
    }

    const { data: transaction } = await supabaseAdmin
      .from("transactions_wallet")
      .select("id, user_id, montant, statut, type")
      .eq("id", referenceInterne)
      .single();

    if (!transaction || transaction.statut !== "en_attente" || !["recharge", "retrait"].includes(transaction.type)) {
      // Déjà traité, transaction inconnue, ou type non concerné — on
      // répond 200 pour éviter que SebPay ne réessaie indéfiniment.
      return NextResponse.json({ ok: true });
    }

    if (statutSebpay === "approved") {
      // Verrou atomique anti-double-traitement (idempotence) : SebPay
      // peut renvoyer le même webhook plusieurs fois en cas de retry
      // réseau (mentionné explicitement dans "Bonnes pratiques" de la
      // doc). On "réclame" la transaction ici ; seul le premier appel gagne.
      const { data: transactionVerrouillee } = await supabaseAdmin
        .from("transactions_wallet")
        .update({ statut: "reussi" })
        .eq("id", transaction.id)
        .eq("statut", "en_attente")
        .select()
        .single();
      if (!transactionVerrouillee) {
        return NextResponse.json({ ok: true }); // déjà traité par un appel concurrent
      }

      if (transaction.type === "recharge") {
        // Recharge confirmée : c'est le SEUL moment où le wallet interne
        // est crédité (jamais avant, pour éviter de créditer un paiement
        // qui n'a pas réellement eu lieu).
        const { error: erreurCredit } = await supabaseAdmin.rpc("crediter_wallet_atomique", {
          p_user_id: transaction.user_id,
          p_montant: Number(transaction.montant),
        });
        if (erreurCredit) throw erreurCredit;
      }
      // type === "retrait" : le wallet interne a déjà été débité à
      // l'initiation (voir /api/wallet/retirer) — "approved" confirme
      // juste que l'argent est bien arrivé chez le bénéficiaire, rien
      // de plus à faire ici.
    } else if (statutSebpay === "rejected") {
      if (transaction.type === "retrait") {
        // Le retrait a échoué côté SebPay après avoir débité le wallet
        // interne à l'initiation : on rembourse l'utilisateur.
        const { error: erreurRemboursement } = await supabaseAdmin.rpc("crediter_wallet_atomique", {
          p_user_id: transaction.user_id,
          p_montant: Number(transaction.montant),
        });
        if (erreurRemboursement) throw erreurRemboursement;
      }
      // type === "recharge" rejetée : le wallet n'a jamais été crédité,
      // rien à rembourser côté plateforme.
      await supabaseAdmin.from("transactions_wallet").update({ statut: "echoue" }).eq("id", transaction.id);
    }
    // "pending" : rien à faire, on attend le webhook final (approved/rejected).

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
