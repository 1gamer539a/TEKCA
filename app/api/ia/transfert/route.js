import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { refuserDoublon, limiterDebit } from "../../../../lib/anti-doublon";
import { reponseErreurServeur } from "../../../../lib/erreurs";

/*
  Relais humain : quand l'assistant ne peut pas aider, la personne peut transmettre sa
  conversation à l'équipe. Elle devient une RÉCLAMATION normale (table contacts_support,
  motif « autre ») : l'équipe « Relation client » la voit dans la Salle de surveillance
  et répond dans le fil de discussion, que l'utilisateur retrouve dans Mes réclamations.
  Aucun gel de portefeuille, aucune accusation : c'est une simple demande d'aide.
*/
export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    const doublon = await refuserDoublon(req, user, { fenetre: 20 });
    if (doublon) return doublon;
    const tropDeRequetes = await limiterDebit(user, "ia/transfert", 3, 600);
    if (tropDeRequetes) return tropDeRequetes;

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 60) {
      return NextResponse.json({ error: "Conversation invalide." }, { status: 400 });
    }
    const lignes = [];
    for (const m of messages.slice(-30)) {
      if (!m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string") {
        return NextResponse.json({ error: "Conversation invalide." }, { status: 400 });
      }
      lignes.push(`${m.role === "user" ? "Client" : "Assistant IA"} : ${m.content.trim().slice(0, 600)}`);
    }
    const message = `[Transféré depuis l'assistant IA]\n${lignes.join("\n")}`.slice(0, 4000);

    const { data, error } = await supabaseAdmin
      .from("contacts_support")
      .insert({ client_id: user.id, motif: "autre", message, statut: "ouvert" })
      .select("id")
      .single();
    if (error) throw error;

    return NextResponse.json({ succes: true, reclamationId: data.id });
  } catch (e) {
    return reponseErreurServeur(e, "app/api/ia/transfert");
  }
}
