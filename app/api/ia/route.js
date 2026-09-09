import { NextResponse } from "next/server";

/*
  Route serveur : le navigateur appelle /api/ia, jamais directement
  OpenAI — la clé OPENAI_API_KEY ne doit JAMAIS être exposée côté
  client (jamais de préfixe NEXT_PUBLIC_ sur cette variable).

  Body attendu : { messages: [{role: "user"|"assistant", content: string}], generation: boolean }
*/

const PROMPT_SYSTEME = `Tu es "IA Assistant", l'agent IA intégré à la plateforme gaming (marketplace, tournois, formation, marketing digital). Ton rôle :
- Répondre aux questions des utilisateurs sur la plateforme (commandes, comment devenir vendeur, comment fonctionne le séquestre, etc.)
- Générer du contenu gaming à la demande : sensibilités Free Fire, codes lobby GTA, idées de contenu
- Rester bref, direct et utile — les utilisateurs sont sur mobile
- Ne jamais inventer de vrais numéros de commande, prix ou informations de compte : dire que tu n'as pas accès à ces données précises si on te le demande
- Répondre en français par défaut, sauf si l'utilisateur écrit dans une autre langue`;

export async function POST(req) {
  try {
    const { messages, generation } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY non configurée côté serveur (.env.local)." },
        { status: 500 }
      );
    }

    const reponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: PROMPT_SYSTEME }, ...messages],
        max_tokens: 500,
      }),
    });

    if (!reponse.ok) {
      const erreurTexte = await reponse.text();
      return NextResponse.json({ error: `Erreur OpenAI : ${erreurTexte}` }, { status: 502 });
    }

    const data = await reponse.json();
    const texte = data.choices?.[0]?.message?.content || "Désolé, je n'ai pas pu générer de réponse.";

    return NextResponse.json({ texte });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur inconnue" }, { status: 500 });
  }
}
