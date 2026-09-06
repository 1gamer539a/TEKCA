import supabaseAdmin from "./supabaseAdmin";

/*
  Identifiant à 9 chiffres, tiré au hasard (jamais séquentiel — un ID
  qui s'incrémente révélerait indirectement le nombre d'utilisateurs
  inscrits à n'importe qui regarde deux comptes créés à des dates
  différentes). Le comptage du nombre d'utilisateurs pour l'équipe
  reste possible séparément (simple count() sur `users`), il ne
  dépend jamais du format de l'identifiant.

  Collision extrêmement improbable sur 900 millions de combinaisons,
  mais on vérifie quand même et on retire en cas de doublon plutôt
  que de faire confiance à la seule contrainte unique en base.
*/
export async function genererIdentifiantUnique() {
  for (let tentative = 0; tentative < 10; tentative++) {
    const candidat = String(Math.floor(100000000 + Math.random() * 900000000)); // 9 chiffres

    const { data } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("identifiant_tekca", candidat)
      .maybeSingle();

    if (!data) return candidat;
  }
  throw new Error("Impossible de générer un identifiant unique, réessaie.");
}
