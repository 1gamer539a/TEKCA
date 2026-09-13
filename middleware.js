import { NextResponse } from "next/server";
import { creerClientMiddleware } from "./lib/supabase-middleware";

/*
  Corrige le point "vérification d'authentification uniquement côté
  client" : jusqu'ici, les pages comme /admin/signalements ou
  /dashboard n'étaient protégées que par un état React (`autorise`)
  vérifié APRÈS le premier rendu — contournable en désactivant JS ou
  en inspectant le bundle. Ici, la vérification tourne côté serveur,
  avant même que la page ne soit générée, et redirige si besoin.

  Ça vient en complément de la RLS et des routes /api/admin/* (déjà
  en place) qui protègent les DONNÉES elles-mêmes quoi qu'il arrive ;
  ce middleware protège en plus l'ACCÈS À LA PAGE.
*/

const PREFIXES_CONNEXION_REQUISE = [
  "/dashboard",
  "/compte",
  "/portefeuille",
  "/messages",
  "/commandes",
  "/favoris",
  "/notifications",
  "/vendre",
  "/produit/nouveau",
  "/securite",
  "/admin",
  "/reclamations",
];

const PREFIXES_ADMIN_UNIQUEMENT = ["/admin"];

// Pages accessibles à un utilisateur connecté qui n'a pas encore de
// pseudo TEKÇA — sans ça, impossible de terminer le parcours
// obligatoire (PIN puis pseudo) sans boucle de redirection infinie.
const PREFIXES_EXEMPTES_PSEUDO = ["/securite", "/auth"];

export async function middleware(request) {
  const { supabase, reponse } = creerClientMiddleware(request);

  // getUser() (pas getSession()) : revalide le token auprès de
  // Supabase Auth plutôt que de faire confiance à ce que contient le
  // cookie tel quel — c'est la vérification "côté serveur" recherchée.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const chemin = request.nextUrl.pathname;
  const connexionRequise = PREFIXES_CONNEXION_REQUISE.some((p) => chemin.startsWith(p));
  const adminRequis = PREFIXES_ADMIN_UNIQUEMENT.some((p) => chemin.startsWith(p));
  const exemptePseudo = PREFIXES_EXEMPTES_PSEUDO.some((p) => chemin.startsWith(p));

  if (connexionRequise && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("suite", chemin);
    return NextResponse.redirect(url);
  }

  if (connexionRequise && user && (adminRequis || !exemptePseudo)) {
    const { data: profil } = await supabase.from("users").select("role, pseudo, date_naissance, code_pin_hash").eq("id", user.id).single();

    // IMPORTANT — si ce redirect se déclenche alors que tu penses
    // avoir un compte admin : ce n'est pas un bug de redirection,
    // c'est que profil.role n'est PAS 'admin' ou 'equipe' en base.
    // Vérifie dans Supabase SQL Editor :
    //   select email, role from users where email = 'ton_email';
    // Si role n'est pas "admin", relance passer-mon-compte-admin.sql
    // avec l'email EXACT du compte, puis déconnecte-toi/reconnecte-toi
    // (le rôle est relu à chaque requête, pas besoin de resigner —
    // mais une session déjà ouverte AVANT le changement peut avoir mis
    // en cache une redirection ; se déconnecter/reconnecter la purge).
    if (adminRequis && (!profil || !["admin", "equipe"].includes(profil.role))) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    // Parcours obligatoire pas terminé (PIN créé mais pseudo et/ou
    // date de naissance jamais renseignés) — bloque l'accès au reste
    // de l'app tant que ce n'est pas fait, plutôt que de compter sur
    // le seul flux normal d'inscription (contournable en tapant
    // directement une URL).
    if (!exemptePseudo && profil && (!profil.pseudo || !profil.date_naissance)) {
      const url = request.nextUrl.clone();
      url.pathname = "/securite/identite";
      return NextResponse.redirect(url);
    }

    // CORRECTIF — le code PIN, une fois créé, n'était jamais
    // redemandé après coup : une session valide (cookie Supabase)
    // suffisait pour tout faire, y compris après une déconnexion
    // suivie d'une reconnexion sur le même appareil. On exige donc
    // ici, en plus de la session Supabase elle-même, un cookie
    // "tekca_pin_ok" posé uniquement par /api/securite/pin/verifier
    // (voir ce fichier) — retiré à la déconnexion et absent par
    // défaut à chaque nouvelle session (pas de maxAge). Ne s'applique
    // que si l'onboarding est terminé (pseudo + date de naissance +
    // donc PIN déjà créé) : sans ça, un compte tout juste créé,
    // encore en train de définir son PIN pour la première fois,
    // serait renvoyé se "reconnecter" à un PIN qui n'existe pas
    // encore.
    if (!exemptePseudo && profil?.code_pin_hash) {
      const pinVerifie = request.cookies.get("tekca_pin_ok")?.value === "1";
      if (!pinVerifie) {
        const url = request.nextUrl.clone();
        url.pathname = "/securite/pin";
        url.searchParams.set("mode", "verification");
        url.searchParams.set("suite", chemin);
        return NextResponse.redirect(url);
      }
    }
  }

  return reponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
