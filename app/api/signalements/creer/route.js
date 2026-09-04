import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";

/*
  Dès qu'un signalement est créé contre un vendeur (ou, via
  utilisateurConcerneId, contre n'importe quel utilisateur porteur
  d'un wallet), son portefeuille est immédiatement gelé — plus aucun
  retrait ni transfert possible tant que l'équipe n'a pas résolu le
  signalement depuis la Salle de surveillance.
*/
export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { motif, message, commandeId, vendeurConcerneId, utilisateurConcerneId } = await req.json();
    if (!motif || !message) return NextResponse.json({ error: "Motif et message requis." }, { status: 400 });

    const { data: signalement, error: erreurSignalement } = await supabaseAdmin
      .from("contacts_support")
      .insert({
        client_id: user.id,
        motif,
        message,
        commande_id: commandeId || null,
        vendeur_concerne_id: vendeurConcerneId || null,
        statut: "ouvert",
      })
      .select()
      .single();
    if (erreurSignalement) throw erreurSignalement;

    // Détermine quel user_id doit voir son wallet gelé
    let userIdAGeler = utilisateurConcerneId || null;
    if (!userIdAGeler && vendeurConcerneId) {
      const { data: vendeurRow } = await supabaseAdmin.from("vendeurs").select("user_id").eq("id", vendeurConcerneId).single();
      userIdAGeler = vendeurRow?.user_id || null;
    }

    if (userIdAGeler) {
      const raison = `Signalement reçu (${motif}) le ${new Date().toLocaleDateString("fr-FR")} — en attente de résolution par l'équipe.`;
      const { data: walletExistant } = await supabaseAdmin.from("wallets").select("user_id").eq("user_id", userIdAGeler).single();
      if (walletExistant) {
        await supabaseAdmin.from("wallets").update({ is_frozen: true, freeze_reason: raison }).eq("user_id", userIdAGeler);
      } else {
        await supabaseAdmin.from("wallets").insert({ user_id: userIdAGeler, solde: 0, is_frozen: true, freeze_reason: raison });
      }

      await supabaseAdmin.from("notifications").insert({
        user_id: userIdAGeler,
        type: "message",
        texte: "Ton portefeuille a été temporairement gelé suite à un signalement. Contacte le support pour plus d'infos.",
      });
    }

    return NextResponse.json({ succes: true, signalementId: signalement.id });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur inconnue" }, { status: 500 });
  }
}
