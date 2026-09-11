import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";

/*
  Appelée périodiquement (voir DashboardVendeur.jsx) tant que le
  vendeur a l'app ouverte, pour alimenter le badge "En ligne" affiché
  sur son profil public — calculé côté lecture à partir de cet
  horodatage (vu il y a moins de 5 min = en ligne), plutôt qu'un
  simple booléen qui resterait bloqué sur "en ligne" si l'app se
  ferme brutalement (crash, perte réseau) sans prévenir le serveur.
*/
export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { error } = await supabaseAdmin
      .from("vendeurs")
      .update({ derniere_activite: new Date().toISOString() })
      .eq("user_id", user.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur serveur." }, { status: 500 });
  }
}
