import { NextResponse } from "next/server";
import crypto from "crypto";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { reponseErreurServeur } from "../../../../lib/erreurs";
import { notifier } from "../../../../lib/notifications";

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
// Notification + push : un échec d'envoi ne doit JAMAIS faire échouer le traitement
// (le crédit/remboursement est déjà fait à ce stade).
async function prevenirUtilisateur(userId, texte) {
  try {
    await notifier(supabaseAdmin, { user_id: userId, type: "wallet", texte });
  } catch (e) {
    console.error("notification wallet non envoyée :", e);
  }
}

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

      // Prévient l'utilisateur du résultat réel, même s'il a fermé l'écran.
      await prevenirUtilisateur(
        transaction.user_id,
        transaction.type === "recharge"
          ? `Recharge de ${Number(transaction.montant).toLocaleString("fr-FR")} FCFA confirmée. Ton solde a été mis à jour.`
          : `Retrait de ${Number(transaction.montant).toLocaleString("fr-FR")} FCFA effectué.`
      );
    } else if (statutSebpay === "rejected") {
      // Motif du refus, SI l'opérateur en transmet un (la doc SebPay ne documente
      // que status/amount/currency…). On journalise les champs reçus (jamais leurs
      // valeurs personnelles) pour savoir, dans Vercel → Logs, ce qui est disponible.
      console.log("[webhook-sebpay] transaction rejetée — champs reçus :", Object.keys(payload).join(", "));
      const motifBrut = [payload.message, payload.reason, payload.failure_reason, payload.error, payload.description].find(
        (v) => typeof v === "string" && v.trim()
      );
      const motif = motifBrut ? motifBrut.trim().slice(0, 200) : null;

      // CORRECTIF (double traitement) — avant, le remboursement d'un retrait refusé se
      // faisait AVANT de marquer la transaction : deux webhooks identiques (SebPay
      // renvoie en cas de retry réseau) pouvaient rembourser DEUX fois. On "réclame"
      // d'abord la transaction de façon atomique : un seul appel gagne.
      const { data: reclamee } = await supabaseAdmin
        .from("transactions_wallet")
        .update({ statut: "echoue" })
        .eq("id", transaction.id)
        .eq("statut", "en_attente")
        .select("id");
      if (!reclamee?.length) {
        return NextResponse.json({ ok: true }); // déjà traité par un appel concurrent
      }

      if (transaction.type === "retrait") {
        // Le retrait a échoué côté SebPay après avoir débité le wallet
        // interne à l'initiation : on rembourse l'utilisateur.
        const { error: erreurRemboursement } = await supabaseAdmin.rpc("crediter_wallet_atomique", {
          p_user_id: transaction.user_id,
          p_montant: Number(transaction.montant),
        });
        if (erreurRemboursement) {
          // Remboursement raté : on remet la transaction "en attente" pour qu'un
          // nouvel essai de SebPay puisse le refaire, puis on répond en erreur.
          await supabaseAdmin.from("transactions_wallet").update({ statut: "en_attente" }).eq("id", transaction.id);
          throw erreurRemboursement;
        }
      }
      // type === "recharge" rejetée : le wallet n'a jamais été crédité,
      // rien à rembourser côté plateforme.

      // Enregistrement du motif : à part et sans conséquence si la colonne n'existe pas
      // encore (migration_suivi_transactions.sql pas exécutée).
      if (motif) {
        try {
          await supabaseAdmin.from("transactions_wallet").update({ motif_echec: motif }).eq("id", transaction.id);
        } catch (e) {
          console.error("motif_echec non enregistré :", e);
        }
      }

      const montantTexte = Number(transaction.montant).toLocaleString("fr-FR");
      await prevenirUtilisateur(
        transaction.user_id,
        transaction.type === "recharge"
          ? `Ta recharge de ${montantTexte} FCFA a été refusée par l'opérateur (solde Mobile Money insuffisant, paiement non validé ou délai dépassé). Rien n'a été ajouté à ton portefeuille.`
          : `Ton retrait de ${montantTexte} FCFA a été refusé par l'opérateur. Le montant a été remboursé sur ton portefeuille TEKÇA.`
      );
    }
    // "pending" : rien à faire, on attend le webhook final (approved/rejected).

    return NextResponse.json({ ok: true });
  } catch (e) {
    return reponseErreurServeur(e, "app/api/wallet/webhook-sebpay");
  }
}
