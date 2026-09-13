import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { flouterContenu } from "../../../../lib/floutage";

// Après ce nombre de tentatives de contact hors plateforme détectées,
// le compte est bloqué et doit passer par le support pour être
// débloqué (pas d'auto-déblocage).
const SEUIL_BLOCAGE = 3;

export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { conversationId, contenu } = await req.json();
    if (!conversationId || !contenu?.trim()) {
      return NextResponse.json({ error: "Message vide." }, { status: 400 });
    }

    const { data: profil } = await supabaseAdmin
      .from("users")
      .select("compte_bloque, tentatives_contact_externe")
      .eq("id", user.id)
      .single();
    if (profil?.compte_bloque) {
      return NextResponse.json(
        { error: "compte_bloque", message: "Ton compte est bloqué. Contacte le support pour le débloquer." },
        { status: 403 }
      );
    }

    // Vérifie que l'utilisateur participe bien à cette conversation
    // (client ou vendeur) — sans ça, n'importe qui pourrait poster
    // dans la conversation de quelqu'un d'autre en connaissant juste
    // son id.
    const { data: conversation } = await supabaseAdmin
      .from("conversations")
      .select("id, client_id, vendeur_id, vendeurs(user_id)")
      .eq("id", conversationId)
      .single();
    if (!conversation) return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });

    const estParticipant = conversation.client_id === user.id || conversation.vendeurs?.user_id === user.id;
    if (!estParticipant) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

    // Floute le contenu AVANT insertion — jamais le texte brut en base
    const { texte, detecte } = flouterContenu(contenu.trim());

    let compteVientDetreBloque = false;
    if (detecte) {
      const nouvellesTentatives = (profil?.tentatives_contact_externe || 0) + 1;
      const doitBloquer = nouvellesTentatives >= SEUIL_BLOCAGE;

      await supabaseAdmin
        .from("users")
        .update({
          tentatives_contact_externe: nouvellesTentatives,
          ...(doitBloquer
            ? { compte_bloque: true, motif_blocage: "Tentatives répétées de contact hors plateforme", date_blocage: new Date().toISOString() }
            : {}),
        })
        .eq("id", user.id);

      compteVientDetreBloque = doitBloquer;
    }

    const { data: message, error } = await supabaseAdmin
      .from("messages_chat")
      .insert({ conversation_id: conversationId, expediteur_id: user.id, contenu: texte })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({
      succes: true,
      message,
      avertissement: detecte
        ? compteVientDetreBloque
          ? "Ton message contenait des coordonnées non autorisées. Ton compte a été bloqué — contacte le support pour le débloquer."
          : "Ton message contenait des coordonnées non autorisées et a été masqué. Les échanges de contacts en dehors de TEKÇA ne sont pas autorisés."
        : null,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur inconnue" }, { status: 500 });
  }
}
