import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { trouverVendeurUtilisateur } from "../../../../lib/vendeur-serveur";
import { reponseErreurServeur } from "../../../../lib/erreurs";
import { limiterDebit } from "../../../../lib/anti-doublon";

/*
  Liste « Vue du profil » du vendeur connecté : qui a consulté sa boutique (100 plus récents).
  Passe par le serveur car un vendeur n'a pas le droit de lire la table `users`. On ne renvoie QUE
  le prénom/nom affiché — jamais email ni téléphone — et on retire les visiteurs devenus « navigation
  discrète » ainsi que les mineurs, même si une vue plus ancienne existe.
*/
export async function GET(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    const tropDeRequetes = await limiterDebit(user, "vendeur/vues-profil", 60, 600);
    if (tropDeRequetes) return tropDeRequetes;

    const vendeur = await trouverVendeurUtilisateur(user.id);
    if (!vendeur) return NextResponse.json({ error: "Tu n'es pas vendeur." }, { status: 403 });

    const { data: vues, error } = await supabaseAdmin
      .from("vues_profil_vendeur")
      .select("visiteur_id, nb_vues, premiere_vue, derniere_vue")
      .eq("vendeur_id", vendeur.id)
      .order("derniere_vue", { ascending: false })
      .limit(100);
    if (error) throw error;
    if (!vues || vues.length === 0) return NextResponse.json({ vues: [] });

    const ids = vues.map((v) => v.visiteur_id);
    const [{ data: visiteurs }, { data: commandes }] = await Promise.all([
      supabaseAdmin.from("users").select("id, nom, date_naissance, navigation_discrete").in("id", ids),
      supabaseAdmin.from("commandes").select("client_id").eq("vendeur_id", vendeur.id).in("client_id", ids).in("statut", ["paye", "expedie", "livre"]),
    ]);
    const parId = Object.fromEntries((visiteurs || []).map((u) => [u.id, u]));
    const acheteurs = new Set((commandes || []).map((c) => c.client_id));
    const limiteMajeur = new Date();
    limiteMajeur.setFullYear(limiteMajeur.getFullYear() - 18);

    const liste = vues
      .filter((v) => {
        const u = parId[v.visiteur_id];
        return u && !u.navigation_discrete && u.date_naissance && new Date(u.date_naissance) <= limiteMajeur;
      })
      .map((v) => ({
        visiteurId: v.visiteur_id,
        nom: parId[v.visiteur_id].nom || null,
        nbVues: v.nb_vues,
        premiereVue: v.premiere_vue,
        derniereVue: v.derniere_vue,
        aCommande: acheteurs.has(v.visiteur_id),
      }));

    return NextResponse.json({ vues: liste });
  } catch (e) {
    return reponseErreurServeur(e, "app/api/vendeur/vues-profil");
  }
}
