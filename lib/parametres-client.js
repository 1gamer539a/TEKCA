import { supabase } from "./supabase";

/*
  Accès côté navigateur aux réglages de l'utilisateur
  (/api/compte/parametres), avec un cache en mémoire pour ne pas
  refaire la requête à chaque ouverture d'un modal PIN.
*/
let cache = null;

async function entetes() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  return { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
}

export function chargerParametres(forcer = false) {
  if (cache && !forcer) return cache;
  cache = (async () => {
    const h = await entetes();
    if (!h) return null;
    const r = await fetch("/api/compte/parametres", { headers: h });
    if (!r.ok) return null;
    return (await r.json()).parametres;
  })().catch(() => null);
  cache.then((p) => { if (p === null) cache = null; });
  return cache;
}

export async function sauverParametres(patch) {
  const h = await entetes();
  if (!h) throw new Error("Non connecté.");
  const r = await fetch("/api/compte/parametres", { method: "PUT", headers: h, body: JSON.stringify(patch) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Erreur");
  cache = Promise.resolve(data.parametres);
  return data.parametres;
}
