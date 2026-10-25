import { supabase } from "./supabase";

/*
  Le bucket "preuves" (pièces d'identité, justificatifs, preuves d'achat)
  est PRIVÉ : une URL publique ne s'ouvre plus. Les URLs déjà enregistrées
  en base (ancien format .../object/public/preuves/<chemin>) restent
  valables comme "référence" : on en extrait le chemin et on demande une
  URL signée, courte (5 min) — possible uniquement pour le propriétaire du
  fichier ou un membre d'équipe autorisé (voir migration_securite_preuves_privees.sql).
*/
export function cheminPreuve(urlOuChemin) {
  if (!urlOuChemin || typeof urlOuChemin !== "string") return null;
  const m = urlOuChemin.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/preuves\/([^?#]+)/);
  if (m) return decodeURIComponent(m[1]);
  if (/^https?:\/\//i.test(urlOuChemin)) return null; // autre bucket / URL externe
  return urlOuChemin; // déjà un chemin
}

export async function urlSigneePreuve(urlOuChemin, secondes = 300) {
  const chemin = cheminPreuve(urlOuChemin);
  if (!chemin) return urlOuChemin || null;
  const { data, error } = await supabase.storage.from("preuves").createSignedUrl(chemin, secondes);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
