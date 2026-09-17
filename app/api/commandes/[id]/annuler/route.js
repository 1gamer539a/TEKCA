import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../../lib/auth-serveur";
import { notifier } from "../../../../../lib/notifications";

/*
  Annulation d'une commande, côté acheteur OU vendeur (les deux
  boutons de "Mes commandes" / dashboard vendeur pointent ici).

  Volontairement limité aux commandes encore au statut "paye" — une
  fois "livre" (voir confirmer-reception et valider-code, qui
  libèrent le séquestre vers le vendeur), il n'y a plus rien à
  annuler unilatéralement ; ça deviendrait un litige/remboursement,
  pas une simple annulation.

  Le séquestre (table sequestres) reste la source de vérité sur "cet
  argent a-t-il déjà été traité" — même verrou atomique anti-double-
  traitement que confirmer-reception et valider-code (update
  conditionné sur statut = "retenu").
*/
export async function POST(req, { params }) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const commandeId = params.id;

    const { data: commande } = await supabaseAdmin
      .from("commandes")
      .select("id, client_id, vendeur_id, montant_total, statut")
      .eq("id", commandeId)
      .single();
    if (!commande) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });

    const { data: vendeurRow } = await supabaseAdmin.from("vendeurs").select("user_id").eq("id", commande.vendeur_id).single();
    const estAcheteur = commande.client_id === user.id;
    const estVendeur = vendeurRow?.user_id === user.id;
    if (!estAcheteur && !estVendeur) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
    }

    if (commande.statut !== "paye") {
      return NextResponse.json({ error: "Cette commande ne peut plus être annulée." }, { status: 400 });
    }

    const { data: sequestre } = await supabaseAdmin
      .from("sequestres")
      .select("id, statut")
      .eq("commande_id", commandeId)
      .single();
    if (!sequestre) return NextResponse.json({ error: "Séquestre introuvable." }, { status: 404 });

    // Verrou atomique anti double-traitement : n'écrit que si le
    // séquestre est encore "retenu" pile au moment de la requête —
    // empêche une annulation de percuter une confirmation de
    // réception qui se ferait en même temps.
    const { data: sequestreVerrouille, error: erreurVerrou } = await supabaseAdmin
      .from("sequestres")
      .update({ statut: "annule", date_liberation: new Date().toISOString() })
      .eq("id", sequestre.id)
      .eq("statut", "retenu")
      .select()
      .single();
    if (erreurVerrou || !sequestreVerrouille) {
      return NextResponse.json({ error: "Cette commande a déjà été traitée." }, { status: 400 });
    }

    // Rembourse l'acheteur — l'argent n'a jamais quitté le séquestre
    // TEKÇA (le vendeur n'est crédité qu'à la livraison confirmée),
    // donc un remboursement intégral du montant payé suffit.
    const { error: erreurCredit } = await supabaseAdmin.rpc("crediter_wallet_atomique", {
      p_user_id: commande.client_id,
      p_montant: commande.montant_total,
    });
    if (erreurCredit) throw erreurCredit;

    await supabaseAdmin.from("transactions_wallet").insert({
      user_id: commande.client_id,
      type: "remboursement",
      montant: commande.montant_total,
      statut: "reussi",
    });

    await supabaseAdmin.from("commandes").update({ statut: "annule" }).eq("id", commandeId);

    const destinataireNotif = estAcheteur ? vendeurRow?.user_id : commande.client_id;
    if (destinataireNotif) {
      await notifier(supabaseAdmin, {
        user_id: destinataireNotif,
        type: "commande",
        texte: estAcheteur ? "L'acheteur a annulé une commande." : "Le vendeur a annulé ta commande, tu as été remboursé intégralement.",
      });
    }

    return NextResponse.json({ succes: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur inconnue" }, { status: 500 });
  }
}
