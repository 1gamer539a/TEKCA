import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { reponseErreurServeur } from "../../../../lib/erreurs";
import { trouverVendeurUtilisateur } from "../../../../lib/vendeur-serveur";
import { refuserDoublon } from "../../../../lib/anti-doublon";

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
    const doublon = await refuserDoublon(req, user, { fenetre: 8 });
    if (doublon) return doublon;

    const { jeu, montant } = await req.json();
    const montantNombre = Number(montant);
    if (!jeu?.trim() || !montantNombre || montantNombre <= 0) {
      return NextResponse.json({ error: "Jeu et montant valides requis." }, { status: 400 });
    }

    const vendeur = await trouverVendeurUtilisateur(user.id);
    if (!vendeur) return NextResponse.json({ error: "Aucun profil vendeur trouvé." }, { status: 404 });

    // CORRECTIF DOUBLE CLIC — avant : lecture du solde puis écriture séparée.
    // Deux clics rapides créditaient le wallet du jeu DEUX fois en ne
    // débitant le portefeuille principal qu'une fois. Débit atomique.
    const { data: soldeApresDebit, error: erreurDebit } = await supabaseAdmin.rpc("debiter_wallet_atomique", { p_user_id: user.id, p_montant: montantNombre });
    if (erreurDebit) throw erreurDebit;
    if (soldeApresDebit === null) {
      return NextResponse.json({ error: "Solde du portefeuille principal insuffisant." }, { status: 400 });
    }

    const { data: walletJeu } = await supabaseAdmin
      .from("wallets_recharge")
      .select("id, solde")
      .eq("vendeur_id", vendeur.id)
      .eq("jeu", jeu.trim())
      .maybeSingle();

    // Crédit du wallet du jeu : mise à jour "optimiste" (on n'écrit que si le
    // solde n'a pas bougé entre-temps). Si une autre requête est passée avant,
    // ou si l'écriture échoue, on REMBOURSE le débit au lieu de laisser le
    // vendeur perdre de l'argent.
    const rembourser = async () => {
      await supabaseAdmin.rpc("crediter_wallet_atomique", { p_user_id: user.id, p_montant: montantNombre });
    };

    let nouveauSolde;
    if (walletJeu) {
      nouveauSolde = Number(walletJeu.solde) + montantNombre;
      const { data: misAJour, error: erreurMaj } = await supabaseAdmin
        .from("wallets_recharge")
        .update({ solde: nouveauSolde, date_maj: new Date().toISOString() })
        .eq("id", walletJeu.id)
        .eq("solde", walletJeu.solde)
        .select("id");
      if (erreurMaj || !misAJour?.length) {
        await rembourser();
        return NextResponse.json({ error: "Une autre opération est en cours sur ce portefeuille. Réessaie dans un instant." }, { status: 409 });
      }
    } else {
      nouveauSolde = montantNombre;
      const { error: erreurCreation } = await supabaseAdmin.from("wallets_recharge").insert({ vendeur_id: vendeur.id, jeu: jeu.trim(), solde: nouveauSolde });
      if (erreurCreation) {
        await rembourser();
        return NextResponse.json({ error: "Une autre opération est en cours sur ce portefeuille. Réessaie dans un instant." }, { status: 409 });
      }
    }

    await supabaseAdmin.from("transactions_wallet").insert({
      user_id: user.id,
      type: "retrait", // sort du wallet principal — reste dans l'écosystème TEKÇA (transfert interne, pas un vrai retrait externe)
      montant: montantNombre,
      statut: "reussi",
    });

    return NextResponse.json({ ok: true, solde: nouveauSolde });
  } catch (e) {
    return reponseErreurServeur(e, "app/api/vendeur/recharger-jeu");
  }
}
