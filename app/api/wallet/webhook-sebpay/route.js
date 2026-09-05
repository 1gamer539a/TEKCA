import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";

/*
  URL à configurer dans le dashboard Sebpay comme "webhook URL" pour
  les confirmations de paiement. Sebpay appelle cette route lui-même
  quand un paiement de recharge est confirmé — jamais le navigateur du
  client.

  Vérification : Sebpay ne documentant pas de signature HMAC connue au
  moment de l'écriture, on utilise un secret partagé passé dans l'URL
  elle-même (`?secret=...`), configuré une seule fois dans le
  dashboard Sebpay. C'est un filet de sécurité minimal — si Sebpay
  fournit un jour un vrai mécanisme de signature (header HMAC), il
  faudra basculer dessus, c'est plus robuste qu'un secret dans l'URL
  (qui peut fuiter dans des logs d'accès HTTP).

  Dans .env.local / variables Vercel :
    SEEPAY_WEBHOOK_SECRET=<chaîne aléatoire longue, générée une fois>
  Puis configurer dans Sebpay :
    https://tondomaine.com/api/wallet/webhook-sebpay?secret=<la_même_chaîne>
*/
export async function POST(req) {
  try {
    if (!process.env.SEEPAY_WEBHOOK_SECRET) {
      console.error("SEEPAY_WEBHOOK_SECRET absent — webhook Sebpay désactivé par sécurité.");
      return NextResponse.json({ error: "Webhook non configuré." }, { status: 503 });
    }

    const secretRecu = req.nextUrl.searchParams.get("secret");
    if (secretRecu !== process.env.SEEPAY_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }

    const payload = await req.json();

    const referenceInterne = payload.reference; // = transactions_wallet.id envoyé à l'initiation
    const statutSebpay = payload.status; // ex: "success" | "failed"

    if (!referenceInterne) {
      return NextResponse.json({ error: "reference manquante" }, { status: 400 });
    }

    const { data: transaction } = await supabaseAdmin
      .from("transactions_wallet")
      .select("id, user_id, montant, statut, type")
      .eq("id", referenceInterne)
      .single();

    if (!transaction || transaction.type !== "recharge" || transaction.statut !== "en_attente") {
      // Déjà traité, ou transaction inconnue — on répond 200 pour éviter
      // que Sebpay ne réessaie indéfiniment sur un cas déjà géré.
      return NextResponse.json({ ok: true });
    }

    if (statutSebpay === "success") {
      // Verrou atomique anti-double-crédit : SeePay peut renvoyer le
      // même webhook plusieurs fois (retry réseau) — deux appels
      // simultanés pourraient sinon tous les deux lire statut ===
      // "en_attente" ci-dessus avant que l'un des deux n'écrive. On
      // "réclame" la transaction ici ; seul le premier appel gagne.
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

      const { error: erreurCredit } = await supabaseAdmin.rpc("crediter_wallet_atomique", {
        p_user_id: transaction.user_id,
        p_montant: Number(transaction.montant),
      });
      if (erreurCredit) throw erreurCredit;
    } else {
      await supabaseAdmin.from("transactions_wallet").update({ statut: "echoue" }).eq("id", transaction.id);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
