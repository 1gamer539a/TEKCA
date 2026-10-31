/*
  FOURNISSEUR D'IA INTERCHANGEABLE — un seul fichier à toucher pour changer de modèle.

  Réglages (variables d'environnement Vercel) :
    IA_FOURNISSEUR   "gemini" | "openai"   (défaut : gemini si GEMINI_API_KEY existe, sinon openai)
    GEMINI_API_KEY   clé Google AI Studio
    OPENAI_API_KEY   clé OpenAI
    IA_MODELE_GEMINI (défaut : gemini-3.8-flash, avec repli automatique sur gemini-flash-latest)
    IA_MODELE_OPENAI (défaut : gpt-4o-mini)
    IA_DELAI_MS      attente maximale par essai en millisecondes (défaut : 9000)

  Les clés ne sont lues que côté serveur : jamais de préfixe NEXT_PUBLIC_.
  Interface unique : genererReponse({ systeme, messages }) → { texte, fournisseur }
  avec messages = [{ role: "user" | "assistant", content: "…" }].
*/
// Budget total de 26 s pour toute la réponse (dont plusieurs essais), 9 s au plus par essai :
// une réponse de support prend 2 à 6 s ; au-delà, mieux vaut changer de modèle (3 essais
// possibles) que de faire attendre l'utilisateur pour rien. Réglable : IA_DELAI_MS.
const BUDGET_MS = 26000;
const DELAI_PAR_ESSAI_MS = Number(process.env.IA_DELAI_MS) > 0 ? Number(process.env.IA_DELAI_MS) : 9000;

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

async function appelerAvecDelai(url, options, delaiMs = DELAI_PAR_ESSAI_MS) {
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), delaiMs);
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
  // « no longer available »). On essaie d'abord le modèle réglé, puis les alias « latest » (Flash actuel, puis Flash-Lite plus léger
  // et moins sollicité) : l'assistant ne tombe plus en panne pour un nom de modèle ou une surcharge.
  const principal = process.env.IA_MODELE_GEMINI || "gemini-3.8-flash";
  const modeles = [...new Set([principal, "gemini-flash-latest", "gemini-flash-lite-latest"])];

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
  let surcharge = false; // Google a répondu « trop de demandes / indisponible » au moins une fois
  const fin = Date.now() + BUDGET_MS;
  for (const modele of modeles) {
    const reste = fin - Date.now();
    if (reste < 2000) break; // plus assez de temps pour un essai utile
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

    let reponse;
    try {
      reponse = await appelerAvecDelai(
        `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`,
        { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY }, body: JSON.stringify(corps) },
        Math.min(DELAI_PAR_ESSAI_MS, reste)
      );
    } catch (e) {
      // Délai dépassé ou coupure réseau : on tente le modèle suivant.
      derniereErreur = e;
      console.error("Assistant IA : essai raté →", modele, e.code);
      continue;
    }

    if (reponse.status === 404) {
      derniereErreur = erreur("IA_MODELE_INDISPONIBLE", 404, `${modele} : ${(await reponse.text()).slice(0, 300)}`);
      console.error("Assistant IA : modèle indisponible, essai suivant →", derniereErreur.detail);
      continue;
    }
    if ([429, 500, 502, 503, 504].includes(reponse.status)) {
      // Modèle surchargé (503 « high demand ») ou limite atteinte : souvent temporaire et propre
      // à CE modèle — un autre modèle de la liste répond généralement.
      surcharge = true;
      derniereErreur = erreur("IA_OCCUPEE", reponse.status, `${modele} : ${(await reponse.text()).slice(0, 300)}`);
      console.error("Assistant IA : modèle surchargé, essai suivant →", modele, reponse.status);
      continue;
    }
    if (!reponse.ok) {
      throw erreur("IA_FOURNISSEUR", reponse.status, (await reponse.text()).slice(0, 500));
    }
    const data = await reponse.json();
    if (data.promptFeedback?.blockReason) throw erreur("IA_BLOQUEE", 422, data.promptFeedback.blockReason);
    const texte = (data.candidates?.[0]?.content?.parts || []).map((p) => (p.thought ? "" : p.text || "")).join("").trim();
    if (!texte) throw erreur("IA_REPONSE_VIDE", 502, `finishReason=${data.candidates?.[0]?.finishReason || "?"} modèle=${modele}`);
    return { texte, fournisseur: "gemini", modele };
  }
  if (surcharge) throw erreur("IA_OCCUPEE", 503, derniereErreur?.detail);
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
