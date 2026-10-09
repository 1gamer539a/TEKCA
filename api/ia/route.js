import { NextResponse } from "next/server";
import { utilisateurConnecte } from "../../../lib/auth-serveur";

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

/*
  Protection de la route (elle était publique et illimitée : n'importe
  qui pouvait consommer le crédit OpenAI) :
  - connexion obligatoire (Authorization: Bearer <access_token>)
  - seuls les rôles "user" / "assistant" sont acceptés (plus de faux
    message "system" injecté par le client)
  - taille limitée (20 derniers messages, 2000 caractères chacun)
  - 20 requêtes / 10 min par utilisateur. NB : compteur en mémoire,
    donc propre à chaque instance serverless — freine l'abus sans être
    parfait ; pour une limite stricte, passer par une table en base.
  - les erreurs OpenAI ne sont plus renvoyées telles quelles au client.
*/
const MAX_MESSAGES = 20;
const MAX_CARACTERES = 2000;
const LIMITE_REQUETES = 20;
const FENETRE_MS = 10 * 60 * 1000;
const compteurs = new Map();

function limiteAtteinte(userId) {
  const maintenant = Date.now();
  const recentes = (compteurs.get(userId) || []).filter((t) => maintenant - t < FENETRE_MS);
  if (recentes.length >= LIMITE_REQUETES) {
    compteurs.set(userId, recentes);
    return true;
  }
  recentes.push(maintenant);
  compteurs.set(userId, recentes);
  if (compteurs.size > 5000) {
    for (const [cle, liste] of compteurs) {
      if (!liste.length || maintenant - liste[liste.length - 1] >= FENETRE_MS) compteurs.delete(cle);
    }
  }
  return false;
}

export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Connecte-toi pour utiliser l'assistant IA." }, { status: 401 });
    if (limiteAtteinte(user.id)) {
      return NextResponse.json({ error: "Trop de demandes. Réessaie dans quelques minutes." }, { status: 429 });
    }

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Message invalide." }, { status: 400 });
    }
    const propres = [];
    for (const m of messages.slice(-MAX_MESSAGES)) {
      if (!m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string") {
        return NextResponse.json({ error: "Message invalide." }, { status: 400 });
      }
      const contenu = m.content.trim();
      if (!contenu || contenu.length > MAX_CARACTERES) {
        return NextResponse.json({ error: `Message vide ou trop long (${MAX_CARACTERES} caractères maximum).` }, { status: 400 });
      }
      propres.push({ role: m.role, content: contenu });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY non configurée — ajoute-la dans Vercel (Project Settings → Environment Variables), pas seulement en local.");
      return NextResponse.json({ error: "Assistant IA indisponible pour le moment." }, { status: 500 });
    }

    const reponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: PROMPT_SYSTEME }, ...propres],
        max_tokens: 500,
      }),
    });

    if (!reponse.ok) {
      console.error("Erreur OpenAI :", await reponse.text());
      return NextResponse.json({ error: "Assistant IA indisponible pour le moment." }, { status: 502 });
    }

    const data = await reponse.json();
    const texte = data.choices?.[0]?.message?.content || "Désolé, je n'ai pas pu générer de réponse.";
    return NextResponse.json({ texte });
  } catch (e) {
    console.error("Erreur /api/ia :", e);
    return NextResponse.json({ error: "Assistant IA indisponible pour le moment." }, { status: 500 });
  }
}
