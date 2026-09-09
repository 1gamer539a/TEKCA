import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // En dev, ça évite un crash silencieux si le .env.local n'est pas rempli
  console.warn(
    "Supabase non configuré : renseigne NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local"
  );
}

/*
  createBrowserClient (au lieu de createClient) stocke la session dans
  des cookies plutôt que dans le seul localStorage. C'est ce qui rend
  la session visible par middleware.js côté serveur, pour une
  vérification d'accès qui ne dépend plus uniquement du navigateur.
  L'API reste identique (signInWithPassword, signUp, signOut,
  getSession, from()...), donc aucun autre fichier n'a besoin de changer.
*/
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

