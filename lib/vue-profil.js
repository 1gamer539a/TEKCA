import { supabase } from "./supabase";

/*
  Signale au serveur qu'un utilisateur connecté vient de consulter la boutique / le profil d'un vendeur
  (alimente l'onglet « Vue du profil » du vendeur). Silencieux : ne doit jamais gêner l'affichage.
  Le serveur décide s'il enregistre (pas le vendeur lui-même, pas les mineurs, pas la « navigation
  discrète », pas plus d'une fois toutes les 30 minutes).
*/
export async function signalerVueProfil(vendeurId) {
  try {
    if (!vendeurId) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await fetch("/api/profil/vue", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ vendeurId }),
    });
  } catch {
    /* sans importance */
  }
}
