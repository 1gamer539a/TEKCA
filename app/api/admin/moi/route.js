import { NextResponse } from "next/server";
import { utilisateurEquipe } from "../../../../lib/auth-serveur";
import { reponseErreurServeur } from "../../../../lib/erreurs";

/*
  Dit à l'interface (Salle de surveillance) ce que le compte connecté a
  le droit de voir : admin principal ou non, et la liste de ses domaines.
  Calculé côté serveur depuis la base — l'interface s'en sert pour
  masquer les onglets, mais la vraie protection reste côté serveur (routes
  /api/admin/*) et côté base (RLS, voir migration_roles_equipe.sql).
*/
export async function GET(req) {
  try {
    const membre = await utilisateurEquipe(req);
    if (!membre) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    return NextResponse.json(
      { role: membre.role, estSuperAdmin: membre.estSuperAdmin, permissions: membre.permissions },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return reponseErreurServeur(e, "app/api/admin/moi");
  }
}
