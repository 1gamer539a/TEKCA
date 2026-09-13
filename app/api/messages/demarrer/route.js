import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";

/*
  CORRECTIF — le bouton "Discuter avec le vendeur" (BoutiqueVendeur.jsx)
  renvoyait vers /messages/<sous-domaine-vendeur>, alors que
  FilDiscussion.jsx attend un vrai id de conversation (uuid) et fait
  directement .eq("id", conversationId) dessus : aucune conversation
  n'était jamais créée, le lien n'ouvrait donc jamais rien de valide.
  Cette route cherche une conversation existante entre l'acheteur
  connecté et ce vendeur, ou en crée une si besoin, puis renvoie son
  id — c'est CE id qui doit servir de destination à /messages/[id].
*/
export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { vendeurId } = await req.json();
    if (!vendeurId) return NextResponse.json({ error: "Vendeur requis." }, { status: 400 });

    const { data: vendeur, error: erreurVendeur } = await supabaseAdmin
      .from("vendeurs")
      .select("id, user_id")
      .eq("id", vendeurId)
      .single();
    if (erreurVendeur || !vendeur) return NextResponse.json({ error: "Vendeur introuvable." }, { status: 404 });

    if (vendeur.user_id === user.id) {
      return NextResponse.json({ error: "Tu ne peux pas t'envoyer un message à toi-même." }, { status: 400 });
    }

    const { data: existante } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("client_id", user.id)
      .eq("vendeur_id", vendeur.id)
      .maybeSingle();

    if (existante) return NextResponse.json({ ok: true, conversationId: existante.id });

    const { data: nouvelle, error: erreurCreation } = await supabaseAdmin
      .from("conversations")
      .insert({ client_id: user.id, vendeur_id: vendeur.id })
      .select("id")
      .single();
    if (erreurCreation) throw erreurCreation;

    return NextResponse.json({ ok: true, conversationId: nouvelle.id });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur serveur." }, { status: 500 });
  }
}
