import { createClient } from "@supabase/supabase-js";

/*
  Utilise la clé "service role" — elle contourne les règles RLS et ne
  doit JAMAIS être utilisée côté client. Réservé aux routes serveur
  (app/api/.../route.js) qui doivent vérifier/modifier un solde de
  wallet de façon fiable, indépendamment de qui est connecté.
*/
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default supabaseAdmin;
