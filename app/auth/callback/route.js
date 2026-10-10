import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/*
  CORRECTIF — "Continuer avec Google/Facebook/Apple" ne fonctionnait
  pas : AuthCompte.jsx appelle supabase.auth.signInWithOAuth() avec
  redirectTo = "/", donc après connexion chez Google/Facebook,
  l'utilisateur revenait directement sur la page d'accueil avec un
  paramètre ?code=... dans l'URL — mais rien ne consommait jamais ce
  code pour créer la session. Résultat : l'utilisateur atterrit sur
  "/" non connecté, comme si rien ne s'était passé.

  Avec @supabase/ssr, ce code doit être échangé côté SERVEUR (le
  "code_verifier" PKCE vit dans un cookie que seule une route serveur
  peut lire et écrire correctement). Cette route fait exactement ça,
  puis redirige vers la destination finale.

  AuthCompte.jsx doit maintenant utiliser :
    redirectTo: `${window.location.origin}/auth/callback?suite=/`
  (déjà corrigé dans ce même correctif).
*/
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const suite = searchParams.get("suite") || "/";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesAEcrire) {
            cookiesAEcrire.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/auth?erreur=connexion_sociale_impossible`);
    }

    // CORRECTIF — un compte Google/Facebook/Apple créé pour la
    // première fois sautait entièrement la création du pseudo (donc
    // de l'identifiant TEKÇA) et du code PIN : contrairement à
    // l'inscription par email (AuthCompte.jsx), qui redirige "en dur"
    // vers /securite/pin après signUp(), le callback OAuth renvoyait
    // toujours vers `suite` (l'accueil par défaut). On vérifie donc
    // ici si ce compte a déjà un pseudo ; sinon on le fait passer par
    // le même parcours obligatoire que l'inscription email (PIN
    // d'abord, qui enchaîne lui-même vers la création du pseudo).
    const utilisateur = data?.user;
    if (utilisateur) {
      const { data: profil } = await supabase.from("users").select("pseudo").eq("id", utilisateur.id).single();
      if (!profil?.pseudo) {
        return NextResponse.redirect(`${origin}/securite/pin`);
      }
    }
  }

  return NextResponse.redirect(`${origin}${suite}`);
}
