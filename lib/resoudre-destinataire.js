import supabaseAdmin from "./supabaseAdmin";

/*
  Résout un identifiant TEKÇA (9 chiffres, voir lib/identite.js) vers
  un compte utilisateur. Remplace complètement l'ancienne résolution
  par numéro de téléphone : le numéro reste désormais strictement
  privé (recharge/retrait uniquement), plus jamais utilisable pour
  identifier quelqu'un d'autre — ça évitait que deux personnes
  échangent leur numéro "pour un transfert" et s'en servent ensuite
  pour négocier hors plateforme.

  Retourne { id, pseudo } ou null si aucun compte ne correspond.
*/
export async function resoudreDestinataire(identifiantTekca) {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, pseudo")
    .eq("identifiant_tekca", identifiantTekca)
    .single();
  return data || null;
}
