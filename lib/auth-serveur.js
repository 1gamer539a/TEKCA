import supabaseAdmin from "./supabaseAdmin";
import { deuxFacteursManquants, aUnFacteurVerifie } from "./mfa";

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
  if (data.user.app_metadata?.compte_supprime) return null; // compte supprimé : plus aucune action possible
  // 2FA activée : un jeton qui n'a pas passé le code à 6 chiffres (aal1) est refusé.
  if (deuxFacteursManquants(data.user, token)) return null;
  return data.user;
}

/*
  Lecture du rôle ET des permissions d'équipe, toujours depuis la base
  (jamais depuis ce que le client envoie). Les permissions d'équipe sont
  dans `equipe_permissions`, table que seul le serveur peut écrire.
*/
async function lireProfilEquipe(user) {
  // Option : EQUIPE_2FA_OBLIGATOIRE=1 (variable d'environnement) exige que
  // tout compte admin/équipe ait activé la double authentification.
  if (process.env.EQUIPE_2FA_OBLIGATOIRE === "1" && !aUnFacteurVerifie(user)) return null;
  const { data: profil, error } = await supabaseAdmin
    .from("users")
    .select("role, email")
    .eq("id", user.id)
    .single();
  if (error || !profil) return null;
  if (!["admin", "equipe"].includes(profil.role)) return null;

  let permissions = [];
  if (profil.role === "equipe") {
    const { data: ligne } = await supabaseAdmin
      .from("equipe_permissions")
      .select("permissions")
      .eq("user_id", user.id)
      .maybeSingle();
    permissions = ligne?.permissions || [];
  }

  // ADMIN_PRINCIPAL_EMAIL (variable d'environnement) : verrou
  // supplémentaire — même un compte role='admin' n'est "principal" que
  // si son email correspond. Non défini : seul role='admin' compte.
  const emailPrincipal = (process.env.ADMIN_PRINCIPAL_EMAIL || "").trim().toLowerCase();
  const estSuperAdmin =
    profil.role === "admin" &&
    (!emailPrincipal || (user.email || profil.email || "").toLowerCase() === emailPrincipal);

  return { role: profil.role, permissions, estSuperAdmin };
}

/*
  N'importe quel membre de l'équipe (admin ou equipe), sans notion de
  domaine. À réserver aux usages qui ne donnent aucun accès aux données
  (ex. ne pas rediriger vers la page de maintenance).
*/
export async function utilisateurEquipe(req) {
  const user = await utilisateurConnecte(req);
  if (!user) return null;
  const profil = await lireProfilEquipe(user);
  if (!profil) return null;
  return { ...user, ...profil };
}

/*
  À utiliser dans TOUTES les routes app/api/admin/* : `permission` est le
  domaine requis (voir lib/permissions.js). L'admin principal passe
  toujours ; un membre de l'équipe doit avoir ce domaine. Sans
  `permission`, seul l'admin principal passe (refus par défaut : un
  oubli rend la route plus stricte, jamais plus ouverte).
*/
export async function utilisateurAdmin(req, permission) {
  const membre = await utilisateurEquipe(req);
  if (!membre) return null;
  if (membre.estSuperAdmin) return membre;
  if (!permission) return null;
  if (membre.role === "equipe" && membre.permissions.includes(permission)) return membre;
  return null;
}

// Réservé à l'admin principal (vue d'ensemble, gestion de l'équipe).
export async function utilisateurSuperAdmin(req) {
  const membre = await utilisateurEquipe(req);
  return membre?.estSuperAdmin ? membre : null;
}
