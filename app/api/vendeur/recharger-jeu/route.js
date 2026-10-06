import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";

/*
  CORRECTIF — le bloc "Solde de votre portefeuille — [jeu]" dans
  FormulaireProduit.jsx affichait un montant codé en dur (32 500 FCFA,
  toujours le même peu importe le vendeur) et le bouton "Recharger mon
  portefeuille" n'avait aucun onClick : ce système de wallet par jeu
  (table wallets_recharge, prévue pour les recharges "sans preuve
  requise") n'a en fait jamais été branché à quoi que ce soit. Cette
  route débite le wallet principal du vendeur pour créditer son
  wallet dédié au jeu concerné.
*/
export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { jeu, montant } = await req.json();
    const montantNombre = Number(montant);
    if (!jeu?.trim() || !montantNombre || montantNombre <= 0) {
      return NextResponse.json({ error: "Jeu et montant valides requis." }, { status: 400 });
    }

    const { data: vendeur } = await supabaseAdmin.from("vendeurs").select("id").eq("user_id", user.id).single();
    if (!vendeur) return NextResponse.json({ error: "Aucun profil vendeur trouvé." }, { status: 404 });

    const { data: wallet } = await supabaseAdmin.from("wallets").select("solde").eq("user_id", user.id).single();
    const soldePrincipal = Number(wallet?.solde || 0);
    if (soldePrincipal < montantNombre) {
      return NextResponse.json({ error: "Solde du portefeuille principal insuffisant." }, { status: 400 });
    }

    await supabaseAdmin.from("wallets").update({ solde: soldePrincipal - montantNombre, date_maj: new Date().toISOString() }).eq("user_id", user.id);

    const { data: walletJeu } = await supabaseAdmin
      .from("wallets_recharge")
      .select("id, solde")
      .eq("vendeur_id", vendeur.id)
      .eq("jeu", jeu.trim())
      .maybeSingle();

    let nouveauSolde;
    if (walletJeu) {
      nouveauSolde = Number(walletJeu.solde) + montantNombre;
      await supabaseAdmin.from("wallets_recharge").update({ solde: nouveauSolde, date_maj: new Date().toISOString() }).eq("id", walletJeu.id);
    } else {
      nouveauSolde = montantNombre;
      await supabaseAdmin.from("wallets_recharge").insert({ vendeur_id: vendeur.id, jeu: jeu.trim(), solde: nouveauSolde });
    }

    await supabaseAdmin.from("transactions_wallet").insert({
      user_id: user.id,
      type: "retrait", // sort du wallet principal — reste dans l'écosystème TEKÇA (transfert interne, pas un vrai retrait externe)
      montant: montantNombre,
      statut: "reussi",
    });

    return NextResponse.json({ ok: true, solde: nouveauSolde });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur serveur." }, { status: 500 });
  }
}
