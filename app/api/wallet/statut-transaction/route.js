import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { limiterDebit } from "../../../../lib/anti-doublon";
import { reponseErreurServeur } from "../../../../lib/erreurs";

/*
  Statut RÉEL d'une recharge / d'un retrait de l'utilisateur connecté.

  Le portefeuille interroge cette route toutes les 3 secondes après avoir lancé
  l'opération, jusqu'à ce que le webhook SebPay ait fait passer la transaction à
  "reussi" ou "echoue". Cette route ne décide de RIEN : elle ne fait que lire ce
  que le webhook (signé) a écrit — le crédit du portefeuille reste exclusivement
  déclenché par lui.

  Sécurité : on ne renvoie que les transactions du compte connecté (filtre
  user_id), donc impossible de consulter celles d'un autre en devinant un id.
*/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    // Une opération = au plus ~40 interrogations (3 s pendant 2 min) : marge large.
    const tropDeRequetes = await limiterDebit(user, "wallet/statut-transaction", 300, 600);
    if (tropDeRequetes) return tropDeRequetes;

    const id = new URL(req.url).searchParams.get("id") || "";
    if (!UUID.test(id)) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });

    // Avec le motif d'échec si la colonne existe (migration_suivi_transactions.sql) ;
    // sinon on retombe sur la lecture sans motif.
    let { data, error } = await supabaseAdmin
      .from("transactions_wallet")
      .select("id, type, montant, statut, motif_echec")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      ({ data, error } = await supabaseAdmin
        .from("transactions_wallet")
        .select("id, type, montant, statut")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle());
    }
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Transaction introuvable." }, { status: 404 });

    return NextResponse.json(
      { id: data.id, type: data.type, montant: Number(data.montant), statut: data.statut, motif: data.motif_echec || null },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return reponseErreurServeur(e, "app/api/wallet/statut-transaction");
  }
}
