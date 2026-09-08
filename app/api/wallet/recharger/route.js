import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { initierRecharge } from "../../../../lib/sebpay";

export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { montant, numeroClient, operateur, pays } = await req.json();
    const montantNum = parseFloat(montant);

    if (!montantNum || montantNum <= 0) {
      return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
    }
    if (!operateur) {
      return NextResponse.json({ error: "Opérateur Mobile Money requis (ex: MTN Mobile Money, Airtel Money)." }, { status: 400 });
    }
    // Le client construit déjà le numéro complet avec l'indicatif du
    // pays choisi (voir lib/pays.js) — on ne devine plus jamais un
    // préfixe pays par défaut ici, ça a longtemps forcé +242 pour
    // tout le monde même hors Congo.
    const numeroNettoye = (numeroClient || "").replace(/[\s-]/g, "");
    if (!numeroNettoye.startsWith("+")) {
      return NextResponse.json({ error: "Numéro invalide — indicatif pays manquant." }, { status: 400 });
    }

    const { data: transaction, error: erreurTransaction } = await supabaseAdmin
      .from("transactions_wallet")
      .insert({
        user_id: user.id,
        type: "recharge",
        montant: montantNum,
        moyen: "sebpay",
        statut: "en_attente",
      })
      .select()
      .single();
    if (erreurTransaction) throw erreurTransaction;

    const resultatSeePay = await initierRecharge({
      montant: montantNum,
      numeroClient: numeroNettoye,
      operateur,
      pays: pays || "CG",
      referenceInterne: transaction.id,
    });

    // Le crédit réel du wallet se fait via le webhook SeePay
    // (/api/wallet/webhook-sebpay) une fois le paiement confirmé côté
    // SeePay — jamais ici, pour éviter de créditer avant paiement réel.
    await supabaseAdmin
      .from("transactions_wallet")
      .update({ reference_sebpay: resultatSeePay.transaction_id || resultatSeePay.id })
      .eq("id", transaction.id);

    return NextResponse.json({
      succes: true,
      transaction: transaction.id,
      lienPaiement: resultatSeePay.payment_url || resultatSeePay.url || null,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur inconnue" }, { status: 500 });
  }
}
