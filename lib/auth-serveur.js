import supabaseAdmin from "./supabaseAdmin";

/*
  Le composant client doit envoyer le token de session dans le header
  Authorization: Bearer <access_token> (récupéré via
  supabase.auth.getSession() côté client). Cette fonction le vérifie
  côté serveur avec la clé admin, pour ne jamais faire confiance à un
  user_id envoyé tel quel dans le body de la requête.
*/
export async function utilisateurConnecte(req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

/*
  Comme utilisateurConnecte, mais vérifie en plus que le rôle stocké
  dans la table `users` (colonne protégée par trigger — non modifiable
  par le client) est 'admin' ou 'equipe'. À utiliser dans TOUTES les
  routes app/api/admin/* avant toute lecture/écriture sensible : ne
  jamais faire confiance à un rôle envoyé par le client, toujours le
  relire en base ici.
*/
export async function utilisateurAdmin(req) {
  const user = await utilisateurConnecte(req);
  if (!user) return null;

  const { data: profil, error } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || !profil || !["admin", "equipe"].includes(profil.role)) return null;
  return user;
}
