import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";

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

    const { clientId } = await req.json();
    if (!clientId) return NextResponse.json({ error: "Client requis." }, { status: 400 });

    const { data: vendeur, error: erreurVendeur } = await supabaseAdmin
      .from("vendeurs")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (erreurVendeur || !vendeur) return NextResponse.json({ error: "Tu n'es pas vendeur." }, { status: 403 });

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
    return NextResponse.json({ error: e.message || "Erreur serveur." }, { status: 500 });
  }
}
