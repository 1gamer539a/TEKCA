import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

/*
  Pattern standard @supabase/ssr pour Next.js middleware : le client
  lit les cookies de la requête entrante, et toute réécriture de
  cookie (rafraîchissement de session) est propagée à la fois sur la
  requête (pour le reste du pipeline Next) et sur la réponse (pour
  que le navigateur reçoive le cookie à jour).
*/
export function creerClientMiddleware(request) {
  let reponse = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesAEcrire) {
          cookiesAEcrire.forEach(({ name, value }) => request.cookies.set(name, value));
          reponse = NextResponse.next({ request: { headers: request.headers } });
          cookiesAEcrire.forEach(({ name, value, options }) => reponse.cookies.set(name, value, options));
        },
      },
    }
  );

  return { supabase, reponse };
}
