import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { reponseErreurServeur } from "../../../../lib/erreurs";
import { limiterDebit } from "../../../../lib/anti-doublon";

/*
  Alertes de recherche du Marché (voir lib/alertes-recherche.js).
  POST   → enregistre (ou met à jour) ce que l'acheteur cherche : texte libre, catégorie, marque, budget, pays.
           Une recherche n'est gardée que s'il y a une vraie intention (texte, marque ou budget) : choisir
           seulement une catégorie ne déclenche aucune alerte. Valable 60 jours, 10 recherches maximum.
  DELETE → efface toutes les recherches enregistrées de l'utilisateur.
  Respecte le réglage « Alertes de recherche » (Paramètres) : désactivé → rien n'est enregistré.
*/
const CATEGORIES = ["recharge_jeu", "vetement", "accessoire", "abonnement_service", "ebook", "template", "immobilier", "vehicule", "meuble_deco", "jouet_enfant", "console_gaming", "high_tech", "telephone", "mode_beaute"];
const MAX_RECHERCHES = 10;
const DUREE_JOURS = 60;

const nettoyer = (v, max) => String(v ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const nombrePositif = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1e12 ? n : null;
};

export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ ok: true, enregistre: false });
    const tropDeRequetes = await limiterDebit(user, "marche/recherche", 40, 600);
    if (tropDeRequetes) return tropDeRequetes;

    const { data: reglage } = await supabaseAdmin.from("parametres_utilisateur").select("notif_alertes_recherche").eq("user_id", user.id).maybeSingle();
    if (reglage && reglage.notif_alertes_recherche === false) return NextResponse.json({ ok: true, enregistre: false });

    const corps = await req.json();
    const texte = nettoyer(corps.texte, 120);
    const categorie = CATEGORIES.includes(corps.categorie) ? corps.categorie : null;
    const marque = corps.marque ? nettoyer(corps.marque, 40).toLowerCase() : null;
    const prixMin = nombrePositif(corps.prixMin);
    const prixMax = nombrePositif(corps.prixMax);
    const pays = corps.pays ? nettoyer(corps.pays, 2).toUpperCase() : null;
    const ville = corps.ville ? nettoyer(corps.ville, 60) : null;

    const aUneIntention = texte.length >= 2 || !!marque || prixMin !== null || prixMax !== null;
    if (!aUneIntention) return NextResponse.json({ ok: true, enregistre: false });

    const maintenant = new Date();
    const champs = {
      texte: texte.length >= 2 ? texte : null,
      categorie, marque, prix_min: prixMin, prix_max: prixMax, pays, ville,
      date_maj: maintenant.toISOString(),
      date_expiration: new Date(maintenant.getTime() + DUREE_JOURS * 86400000).toISOString(),
    };

    // Mise à jour de la recherche en cours (si elle appartient bien à cet utilisateur)…
    if (corps.id) {
      const { data: maj, error } = await supabaseAdmin.from("recherches_marche").update(champs).eq("id", corps.id).eq("user_id", user.id).select("id");
      if (error) throw error;
      if (maj && maj.length > 0) return NextResponse.json({ ok: true, enregistre: true, id: maj[0].id });
    }

    // …sinon nouvelle recherche.
    const { data: cree, error: erreurCreation } = await supabaseAdmin.from("recherches_marche").insert({ user_id: user.id, ...champs }).select("id").single();
    if (erreurCreation) throw erreurCreation;

    // On ne garde que les plus récentes.
    const { data: anciennes } = await supabaseAdmin.from("recherches_marche").select("id").eq("user_id", user.id).order("date_maj", { ascending: false }).range(MAX_RECHERCHES, MAX_RECHERCHES + 50);
    if (anciennes?.length) await supabaseAdmin.from("recherches_marche").delete().in("id", anciennes.map((r) => r.id));

    return NextResponse.json({ ok: true, enregistre: true, id: cree.id });
  } catch (e) {
    return reponseErreurServeur(e, "app/api/marche/recherche");
  }
}

export async function DELETE(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    const tropDeRequetes = await limiterDebit(user, "marche/recherche-effacer", 10, 600);
    if (tropDeRequetes) return tropDeRequetes;
    const { error } = await supabaseAdmin.from("recherches_marche").delete().eq("user_id", user.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return reponseErreurServeur(e, "app/api/marche/recherche");
  }
}
