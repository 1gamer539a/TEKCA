import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { initierRetrait, urlWebhookSebpay } from "../../../../lib/sebpay";

const SEUIL_VERIFICATION_CNI = 15000;
const SEUIL_RETRAIT_MIN = 1500;
const LIMITE_RETRAITS_SANS_CNI_PAR_JOUR = 2; // le 3e retrait du jour déclenche la règle

/*
  Le client construit déjà le numéro complet avec l'indicatif du pays
  choisi (voir lib/pays.js) — ne devine plus jamais +242 par défaut,
  ça forçait le Congo pour tout le monde même hors zone CEMAC.
*/
function nettoyerNumero(numero) {
  const nettoye = numero.replace(/[\s-]/g, "");
  return nettoye.startsWith("+") ? nettoye : null;
}

export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { montant, moyen, numeroDestinataire, operateur, pays } = await req.json();
    const montantNum = parseFloat(montant);

    if (!montantNum || montantNum <= 0) {
      return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
    }
    if (montantNum < SEUIL_RETRAIT_MIN) {
      return NextResponse.json({ error: `Le montant minimum pour un retrait est de ${SEUIL_RETRAIT_MIN.toLocaleString()} FCFA.` }, { status: 400 });
    }
    if (!numeroDestinataire) {
      return NextResponse.json({ error: "Numéro destinataire requis." }, { status: 400 });
    }
    if (!operateur) {
      return NextResponse.json({ error: "Opérateur Mobile Money requis (ex: MTN Mobile Money, Airtel Money)." }, { status: 400 });
    }
    const numeroNettoye = nettoyerNumero(numeroDestinataire);
    if (!numeroNettoye) {
      return NextResponse.json({ error: "Numéro invalide — indicatif pays manquant." }, { status: 400 });
    }

    // Charge le profil une seule fois (utile pour le seuil montant, la règle
    // des 3 retraits/jour, ET le recipient_name requis par SebPay ci-dessous)
    const { data: profil } = await supabaseAdmin
      .from("users")
      .select("piece_identite_verifiee, nom")
      .eq("id", user.id)
      .single();

    // Wallet gelé — bloque tout retrait tant que le signalement n'est pas résolu
    const { data: walletStatut } = await supabaseAdmin
      .from("wallets")
      .select("is_frozen, freeze_reason")
      .eq("user_id", user.id)
      .single();
    if (walletStatut?.is_frozen) {
      return NextResponse.json(
        { error: "wallet_gele", message: walletStatut.freeze_reason || "Ton portefeuille est temporairement gelé. Contacte le support." },
        { status: 403 }
      );
    }

    // Seuil CNI par montant — retrait >= 15 000 FCFA nécessite une pièce d'identité vérifiée
    if (montantNum >= SEUIL_VERIFICATION_CNI && !profil?.piece_identite_verifiee) {
      return NextResponse.json(
        {
          error: "verification_requise",
          message: `Les retraits à partir de ${SEUIL_VERIFICATION_CNI.toLocaleString()} FCFA nécessitent une vérification d'identité.`,
        },
        { status: 403 }
      );
    }

    // Règle du 3e retrait du jour — même sous le seuil, un compte non
    // vérifié ne peut pas retirer plus de 2 fois par jour. Le 3e retrait
    // impose soit la vérification CNI, soit d'attendre 24h.
    if (!profil?.piece_identite_verifiee) {
      const debutJournee = new Date();
      debutJournee.setHours(0, 0, 0, 0);
      const { count } = await supabaseAdmin
        .from("transactions_wallet")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("type", "retrait")
        .in("statut", ["reussi", "en_attente"])
        .gte("date_creation", debutJournee.toISOString());

      if ((count || 0) >= LIMITE_RETRAITS_SANS_CNI_PAR_JOUR) {
        return NextResponse.json(
          {
            error: "verification_requise",
            message: "Tu as atteint la limite de 2 retraits aujourd'hui sans identité vérifiée. Vérifie ton identité pour continuer, ou réessaie dans 24h.",
          },
          { status: 403 }
        );
      }
    }

    // Débit atomique — lecture ET écriture dans la même requête SQL
    // (voir fix_wallet_atomique.sql). Empêche deux retraits simultanés
    // de tous les deux passer la vérification de solde (race condition).
    // Si null : solde insuffisant, rien n'a été débité.
    const { data: soldeApresDebit, error: erreurDebit } = await supabaseAdmin.rpc(
      "debiter_wallet_atomique",
      { p_user_id: user.id, p_montant: montantNum }
    );
    if (erreurDebit) throw erreurDebit;
    if (soldeApresDebit === null) {
      return NextResponse.json({ error: "Solde insuffisant." }, { status: 400 });
    }

    // Trace la transaction comme "en_attente" avant l'appel SeePay
    const { data: transaction, error: erreurTransaction } = await supabaseAdmin
      .from("transactions_wallet")
      .insert({
        user_id: user.id,
        type: "retrait",
        montant: montantNum,
        moyen,
        numero_destinataire: numeroDestinataire,
        statut: "en_attente",
      })
      .select()
      .single();
    if (erreurTransaction) throw erreurTransaction;

    try {
      const resultatSeePay = await initierRetrait({
        montant: montantNum,
        numeroDestinataire: numeroNettoye,
        nomDestinataire: profil?.nom || "Client Tekça",
        operateur,
        pays: pays || "CG",
        referenceInterne: transaction.id,
        callbackUrl: urlWebhookSebpay(),
      });

      // Ne PAS marquer "reussi" ici : la doc SebPay est explicite — un
      // payout est toujours créé avec le statut "pending", et la
      // confirmation finale (approved/rejected) arrive uniquement via
      // webhook. On garde donc "en_attente" et c'est le webhook qui
      // décidera de "reussi" ou "echoue" (avec remboursement) ci-dessous.
      await supabaseAdmin
        .from("transactions_wallet")
        .update({ reference_sebpay: resultatSeePay.transaction_id })
        .eq("id", transaction.id);

      return NextResponse.json({ succes: true, transaction: transaction.id, statut: "en_attente" });
    } catch (erreurSeePay) {
      // Echec SeePay : on recrédite le wallet (atomique) et on marque la transaction échouée
      await supabaseAdmin.rpc("crediter_wallet_atomique", { p_user_id: user.id, p_montant: montantNum });
      await supabaseAdmin.from("transactions_wallet").update({ statut: "echoue" }).eq("id", transaction.id);

      return NextResponse.json({ error: `Retrait échoué : ${erreurSeePay.message}` }, { status: 502 });
    }
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur inconnue" }, { status: 500 });
  }
}
