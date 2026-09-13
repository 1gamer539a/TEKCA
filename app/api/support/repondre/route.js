import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";

export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { contactId, message } = await req.json();
    if (!contactId || !message?.trim()) {
      return NextResponse.json({ error: "Message vide." }, { status: 400 });
    }

    const { data: contact, error: erreurContact } = await supabaseAdmin
      .from("contacts_support")
      .select("id, client_id")
      .eq("id", contactId)
      .single();
    if (erreurContact || !contact) return NextResponse.json({ error: "Réclamation introuvable." }, { status: 404 });
    if (contact.client_id !== user.id) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

    const { error } = await supabaseAdmin.from("messages_support").insert({
      contact_id: contactId,
      expediteur_id: user.id,
      contenu: message.trim(),
    });
    if (error) throw error;

    // Rouvre la réclamation si l'équipe l'avait laissée "en cours" —
    // un nouveau message du client mérite d'être revu.
    await supabaseAdmin.from("contacts_support").update({ statut: "ouvert" }).eq("id", contactId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur serveur." }, { status: 500 });
  }
}
