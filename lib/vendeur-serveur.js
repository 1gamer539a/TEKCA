import supabaseAdmin from "./supabaseAdmin";

/*
  Un compte peut avoir PLUSIEURS lignes dans `vendeurs` (une par niveau :
  vendeur simple / revendeur officiel, ou une candidature refusée puis
  refaite). `.single()` / `.maybeSingle()` échouent dès qu'il y en a deux —
  c'était la cause du « Aucun profil vendeur trouvé » alors que le profil
  existe. Cette fonction renvoie LA ligne à utiliser : une boutique
  validée en priorité, sinon la plus récente.
*/
export async function trouverVendeurUtilisateur(userId, colonnes = "id") {
  const colonnesAvecStatut = colonnes.includes("statut") ? colonnes : `${colonnes}, statut`;
  const { data, error } = await supabaseAdmin
    .from("vendeurs")
    .select(colonnesAvecStatut)
    .eq("user_id", userId)
    .order("date_demande", { ascending: false });
  if (error) throw error;
  return data?.find((v) => v.statut === "valide") || data?.[0] || null;
}
