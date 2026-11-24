import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { reponseErreurServeur } from "../../../../lib/erreurs";
import { trouverVendeurUtilisateur } from "../../../../lib/vendeur-serveur";
import { limiterDebit } from "../../../../lib/anti-doublon";

export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    const tropDeRequetes = await limiterDebit(user, "vendeur/pause", 20, 600);
    if (tropDeRequetes) return tropDeRequetes;

    const { enPause, messagePause } = await req.json();

    const vendeur = await trouverVendeurUtilisateur(user.id);
    if (!vendeur) return NextResponse.json({ error: "Aucune boutique associée à ce compte." }, { status: 404 });

    const { error } = await supabaseAdmin
      .from("vendeurs")
      .update({ en_pause: !!enPause, message_pause: enPause ? (messagePause || null) : null })
      .eq("id", vendeur.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return reponseErreurServeur(e, "app/api/vendeur/pause");
  }
}
