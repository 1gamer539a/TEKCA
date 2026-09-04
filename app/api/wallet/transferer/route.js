import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { resoudreDestinataire } from "../../../../lib/resoudre-destinataire";
import { tauxFraisTransfert } from "../../../../lib/commission";

export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { montant, identifiantDestinataire } = await req.json();
    const montantNum = parseFloat(montant);

    if (!montantNum || montantNum <= 0) {
      return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
    }

    // Wallet gelé — bloque tout transfert sortant tant que le signalement n'est pas résolu
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

    const destinataire = await resoudreDestinataire(identifiantDestinataire);

    if (!destinataire) {
      return NextResponse.json({ error: "Destinataire introuvable." }, { status: 404 });
    }
    if (destinataire.id === user.id) {
      return NextResponse.json({ error: "Impossible de te transférer à toi-même." }, { status: 400 });
    }

    // Frais de transfert selon le palier de l'EXPÉDITEUR — le
    // destinataire reçoit toujours le montant plein, les frais sont
    // une marge TEKÇA séparée, prélevée en plus sur l'expéditeur.
    const tauxFrais = await tauxFraisTransfert(user.id);
    const frais = Math.round(montantNum * tauxFrais);
    const montantDebite = montantNum + frais;

    const { data: walletExpediteur } = await supabaseAdmin
      .from("wallets")
      .select("solde")
      .eq("user_id", user.id)
      .single();

    const soldeExpediteur = Number(walletExpediteur?.solde || 0);
    if (montantDebite > soldeExpediteur) {
      return NextResponse.json({ error: `Solde insuffisant (montant + ${frais} FCFA de frais de transfert).` }, { status: 400 });
    }

    // Débit expéditeur (montant + frais)
    await supabaseAdmin
      .from("wallets")
      .update({ solde: soldeExpediteur - montantDebite, date_maj: new Date().toISOString() })
      .eq("user_id", user.id);

    // Crédit destinataire (crée son wallet s'il n'existe pas encore) — montant plein, jamais amputé des frais
    const { data: walletDestinataire } = await supabaseAdmin
      .from("wallets")
      .select("solde")
      .eq("user_id", destinataire.id)
      .single();

    if (walletDestinataire) {
      await supabaseAdmin
        .from("wallets")
        .update({ solde: Number(walletDestinataire.solde) + montantNum, date_maj: new Date().toISOString() })
        .eq("user_id", destinataire.id);
    } else {
      await supabaseAdmin.from("wallets").insert({ user_id: destinataire.id, solde: montantNum });
    }

    await supabaseAdmin.from("transactions_wallet").insert([
      { user_id: user.id, type: "transfert_envoye", montant: montantNum, frais, destinataire_id: destinataire.id, statut: "reussi" },
      { user_id: destinataire.id, type: "transfert_recu", montant: montantNum, destinataire_id: user.id, statut: "reussi" },
    ]);

    return NextResponse.json({ succes: true, destinataire: destinataire.pseudo, frais });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur inconnue" }, { status: 500 });
  }
}
