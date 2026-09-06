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
    const { data: profil } = await supabase.from("users").select("role, pseudo").eq("id", user.id).single();

    if (adminRequis && (!profil || !["admin", "equipe"].includes(profil.role))) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    // Parcours obligatoire pas terminé (PIN créé mais pseudo jamais
    // choisi) — bloque l'accès au reste de l'app tant que ce n'est
    // pas fait, plutôt que de compter sur le seul flux normal
    // d'inscription (contournable en tapant directement une URL).
    if (!exemptePseudo && profil && !profil.pseudo) {
      const url = request.nextUrl.clone();
      url.pathname = "/securite/identite";
      return NextResponse.redirect(url);
    }
  }

  return reponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
