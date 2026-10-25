import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { reponseErreurServeur } from "../../../../lib/erreurs";
import { trouverVendeurUtilisateur } from "../../../../lib/vendeur-serveur";
import { limiterDebit } from "../../../../lib/anti-doublon";

/*
  Pendant de /api/messages/demarrer, mais dans l'autre sens : là-bas
  c'est toujours l'ACHETEUR connecté qui initie (client_id = auth.uid()
  imposé par la policy RLS conversations_insert_client — un vendeur ne
  peut donc jamais insérer lui-même une conversation). Ici c'est le
  VENDEUR qui veut ouvrir la conversation liée à une commande reçue
  (onglet "Commandes" du dashboard) quand aucune conversation n'existe
  encore avec cet acheteur — d'où une route à part en service_role.
*/
export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    const tropDeRequetes = await limiterDebit(user, "messages/demarrer-vendeur", 30, 600);
    if (tropDeRequetes) return tropDeRequetes;

    const { clientId } = await req.json();
    if (!clientId) return NextResponse.json({ error: "Client requis." }, { status: 400 });

    const vendeur = await trouverVendeurUtilisateur(user.id);
    if (!vendeur) return NextResponse.json({ error: "Tu n'es pas vendeur." }, { status: 403 });

    const { data: existante } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("client_id", clientId)
      .eq("vendeur_id", vendeur.id)
      .maybeSingle();

    if (existante) return NextResponse.json({ ok: true, conversationId: existante.id });

    const { data: nouvelle, error: erreurCreation } = await supabaseAdmin
      .from("conversations")
      .insert({ client_id: clientId, vendeur_id: vendeur.id })
      .select("id")
      .single();
    if (erreurCreation) throw erreurCreation;

    return NextResponse.json({ ok: true, conversationId: nouvelle.id });
  } catch (e) {
    return reponseErreurServeur(e, "app/api/messages/demarrer-vendeur");
  }
}
