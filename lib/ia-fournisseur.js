/*
  FOURNISSEUR D'IA INTERCHANGEABLE — un seul fichier à toucher pour changer de modèle.

  Réglages (variables d'environnement Vercel) :
    IA_FOURNISSEUR   "gemini" | "openai"   (défaut : gemini si GEMINI_API_KEY existe, sinon openai)
    GEMINI_API_KEY   clé Google AI Studio
    OPENAI_API_KEY   clé OpenAI
    IA_MODELE_GEMINI (défaut : gemini-2.5-flash)
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
  const modele = process.env.IA_MODELE_GEMINI || "gemini-2.5-flash";
  // Gemini exige que la conversation commence par un message de l'utilisateur.
  const contenu = [...messages];
  while (contenu.length && contenu[0].role !== "user") contenu.shift();
  if (!contenu.length) throw erreur("IA_MESSAGE_INVALIDE", 400);
  // Gemini veut une alternance stricte user/model : on fusionne les messages consécutifs du même rôle.
  const fusionnes = [];
  for (const m of contenu) {
    const dernier = fusionnes[fusionnes.length - 1];
    if (dernier && dernier.role === m.role) dernier.content += `\n${m.content}`;
    else fusionnes.push({ ...m });
  }

  const corps = {
    systemInstruction: { parts: [{ text: systeme }] },
    contents: fusionnes.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
  };
  // Les modèles 2.5 Flash « réfléchissent » avant de répondre (tokens facturés en plus) :
  // inutile pour du support, on le désactive pour répondre plus vite et moins cher.
  if (/2\.5-flash/.test(modele)) corps.generationConfig.thinkingConfig = { thinkingBudget: 0 };

  const reponse = await appelerAvecDelai(`https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify(corps),
  });
  if (!reponse.ok) {
    throw erreur(reponse.status === 429 ? "IA_OCCUPEE" : "IA_FOURNISSEUR", reponse.status, (await reponse.text()).slice(0, 500));
  }
  const data = await reponse.json();
  if (data.promptFeedback?.blockReason) throw erreur("IA_BLOQUEE", 422, data.promptFeedback.blockReason);
  const texte = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
  return { texte, fournisseur: "gemini" };
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
