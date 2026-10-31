/*
  FOURNISSEUR D'IA INTERCHANGEABLE — un seul fichier à toucher pour changer de modèle.

  Réglages (variables d'environnement Vercel) :
    IA_FOURNISSEUR   "gemini" | "openai"   (défaut : gemini si GEMINI_API_KEY existe, sinon openai)
    GEMINI_API_KEY   clé Google AI Studio
    OPENAI_API_KEY   clé OpenAI
    IA_MODELE_GEMINI (défaut : gemini-3.8-flash, avec repli automatique sur gemini-flash-latest)
    IA_MODELE_OPENAI (défaut : gpt-4o-mini)

  Les clés ne sont lues que côté serveur : jamais de préfixe NEXT_PUBLIC_.
  Interface unique : genererReponse({ systeme, messages }) → { texte, fournisseur }
  avec messages = [{ role: "user" | "assistant", content: "…" }].
*/
const DELAI_MS = 25000;

export function choisirFournisseur() {
  const voulu = (process.env.IA_FOURNISSEUR || "").toLowerCase();
  if (voulu === "gemini" && process.env.GEMINI_API_KEY) return "gemini";
  if (voulu === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

function erreur(code, status, detail) {
  const e = new Error(code);
  e.code = code;
  e.status = status;
  e.detail = detail;
  return e;
}

async function appelerAvecDelai(url, options) {
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), DELAI_MS);
  try {
    return await fetch(url, { ...options, signal: controleur.signal });
  } catch (e) {
    throw erreur(e.name === "AbortError" ? "IA_DELAI" : "IA_RESEAU", 504, String(e.message || e));
  } finally {
    clearTimeout(minuterie);
  }
}

async function appelGemini({ systeme, messages, maxTokens }) {
  // Google retire régulièrement d'anciens modèles aux nouveaux comptes (erreur 404
  // « no longer available »). On essaie d'abord le modèle réglé, puis l'alias « latest »
  // qui désigne toujours le Flash actuel : l'assistant ne tombe plus en panne pour ça.
  const principal = process.env.IA_MODELE_GEMINI || "gemini-3.8-flash";
  const modeles = [...new Set([principal, "gemini-flash-latest"])];

  // Gemini exige que la conversation commence par un message de l'utilisateur.
  const contenu = [...messages];
  while (contenu.length && contenu[0].role !== "user") contenu.shift();
  if (!contenu.length) throw erreur("IA_MESSAGE_INVALIDE", 400);
  // ... et une alternance stricte user/model : on fusionne les messages consécutifs du même rôle.
  const fusionnes = [];
  for (const m of contenu) {
    const dernier = fusionnes[fusionnes.length - 1];
    if (dernier && dernier.role === m.role) dernier.content += `\n${m.content}`;
    else fusionnes.push({ ...m });
  }

  let derniereErreur;
  for (const modele of modeles) {
    const ancien = /2\.5-flash/.test(modele);
    const corps = {
      systemInstruction: { parts: [{ text: systeme }] },
      contents: fusionnes.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      // Les modèles récents « réfléchissent » avant de répondre et ces tokens comptent dans
      // la limite : on laisse de la marge pour que la réponse visible ne soit pas coupée.
      generationConfig: { maxOutputTokens: ancien ? maxTokens : Math.max(maxTokens, 2048), temperature: 0.3 },
    };
    // Sur 2.5 Flash on peut désactiver la réflexion (plus rapide, moins cher).
    if (ancien) corps.generationConfig.thinkingConfig = { thinkingBudget: 0 };

    const reponse = await appelerAvecDelai(`https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify(corps),
    });
    if (reponse.status === 404) {
      derniereErreur = erreur("IA_MODELE_INDISPONIBLE", 404, `${modele} : ${(await reponse.text()).slice(0, 300)}`);
      console.error("Assistant IA : modèle indisponible, essai suivant →", derniereErreur.detail);
      continue;
    }
    if (!reponse.ok) {
      throw erreur(reponse.status === 429 ? "IA_OCCUPEE" : "IA_FOURNISSEUR", reponse.status, (await reponse.text()).slice(0, 500));
    }
    const data = await reponse.json();
    if (data.promptFeedback?.blockReason) throw erreur("IA_BLOQUEE", 422, data.promptFeedback.blockReason);
    const texte = (data.candidates?.[0]?.content?.parts || []).map((p) => (p.thought ? "" : p.text || "")).join("").trim();
    if (!texte) throw erreur("IA_REPONSE_VIDE", 502, `finishReason=${data.candidates?.[0]?.finishReason || "?"} modèle=${modele}`);
    return { texte, fournisseur: "gemini", modele };
  }
  throw derniereErreur || erreur("IA_FOURNISSEUR", 502);
}

async function appelOpenAI({ systeme, messages, maxTokens }) {
  const reponse = await appelerAvecDelai("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.IA_MODELE_OPENAI || "gpt-4o-mini",
      messages: [{ role: "system", content: systeme }, ...messages],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });
  if (!reponse.ok) {
    throw erreur(reponse.status === 429 ? "IA_OCCUPEE" : "IA_FOURNISSEUR", reponse.status, (await reponse.text()).slice(0, 500));
  }
  const data = await reponse.json();
  return { texte: (data.choices?.[0]?.message?.content || "").trim(), fournisseur: "openai" };
}

export async function genererReponse({ systeme, messages, maxTokens = 700 }) {
  const fournisseur = choisirFournisseur();
  if (!fournisseur) throw erreur("IA_NON_CONFIGUREE", 500);
  return fournisseur === "gemini" ? appelGemini({ systeme, messages, maxTokens }) : appelOpenAI({ systeme, messages, maxTokens });
}
