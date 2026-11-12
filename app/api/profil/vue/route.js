import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { reponseErreurServeur } from "../../../../lib/erreurs";
import { limiterDebit } from "../../../../lib/anti-doublon";

/*
  Enregistre qu'un utilisateur connecté a consulté le profil / la boutique d'un vendeur
  (onglet « Vue du profil » du dashboard vendeur).

  Garde-fous de vie privée — rien n'est enregistré si :
  - le visiteur est le vendeur lui-même, ou le vendeur n'est pas validé ;
  - le visiteur a activé la « navigation discrète » dans ses paramètres ;
  - le visiteur est mineur ou sans date de naissance connue (on ne suit pas les mineurs).
  Une même visite rapprochée (moins de 30 min) n'est pas recomptée (voir enregistrer_vue_profil).
  La réponse est toujours « ok » : cet enregistrement ne doit jamais gêner l'affichage de la page.
*/
export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ ok: true, enregistre: false });
    const tropDeRequetes = await limiterDebit(user, "profil/vue", 60, 600);
    if (tropDeRequetes) return tropDeRequetes;

    const { vendeurId } = await req.json();
    if (!vendeurId) return NextResponse.json({ ok: true, enregistre: false });

    const { data: vendeur } = await supabaseAdmin.from("vendeurs").select("id, user_id, statut").eq("id", vendeurId).maybeSingle();
    if (!vendeur || vendeur.statut !== "valide" || vendeur.user_id === user.id) {
      return NextResponse.json({ ok: true, enregistre: false });
    }

    const { data: visiteur } = await supabaseAdmin.from("users").select("date_naissance, navigation_discrete").eq("id", user.id).maybeSingle();
    if (!visiteur || visiteur.navigation_discrete || !visiteur.date_naissance) {
      return NextResponse.json({ ok: true, enregistre: false });
    }
    const limiteMajeur = new Date();
    limiteMajeur.setFullYear(limiteMajeur.getFullYear() - 18);
    if (new Date(visiteur.date_naissance) > limiteMajeur) return NextResponse.json({ ok: true, enregistre: false });

    const { error } = await supabaseAdmin.rpc("enregistrer_vue_profil", { p_vendeur: vendeur.id, p_visiteur: user.id });
    if (error) {
      console.error("enregistrer_vue_profil :", error);
      return NextResponse.json({ ok: true, enregistre: false });
    }
    return NextResponse.json({ ok: true, enregistre: true });
  } catch (e) {
    return reponseErreurServeur(e, "app/api/profil/vue");
  }
}
