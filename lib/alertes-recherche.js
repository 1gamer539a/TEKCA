import { notifierPlusieurs } from "./notifications";
import { motsSignificatifs, normaliserTexte as normaliser } from "./recherche-texte";

/*
  Alertes de recherche du Marché : quand un produit vient d'être VALIDÉ, on prévient les acheteurs
  dont une recherche enregistrée (table recherches_marche) correspond.

  Garde-fous : jamais le vendeur lui-même ; une seule notification par produit et par personne ;
  5 alertes par jour et par personne au maximum ; recherches expirées ignorées ; réglage
  « Alertes de recherche » respecté (voir lib/notifications.js). Ne lève jamais d'erreur : une
  alerte qui échoue ne doit jamais empêcher la validation du produit.
*/
const MAX_ALERTES_PAR_JOUR = 5;
// Au moins la moitié des mots importants de la recherche se retrouvent dans le produit.
export function texteCorrespond(texteRecherche, produit) {
  const mots = motsSignificatifs(texteRecherche);
  if (mots.length === 0) return true;
  const corpus = normaliser(`${produit.nom} ${produit.description || ""} ${produit.marque_autre || ""} ${produit.marque || ""}`);
  const trouves = mots.filter((m) => corpus.includes(m)).length;
  return trouves >= Math.ceil(mots.length / 2);
}

export async function notifierRecherchesCorrespondantes(supabaseAdmin, produitId) {
  try {
    const { data: produit } = await supabaseAdmin
      .from("produits")
      .select("id, nom, description, type, prix_base, marque, marque_autre, pays, vendeurs ( user_id, pays )")
      .eq("id", produitId)
      .maybeSingle();
    if (!produit) return { notifies: 0 };
    const vendeurUserId = produit.vendeurs?.user_id || null;
    const paysProduit = produit.pays || produit.vendeurs?.pays || null;

    let requete = supabaseAdmin
      .from("recherches_marche")
      .select("id, user_id, texte, categorie, marque, prix_min, prix_max, pays")
      .gt("date_expiration", new Date().toISOString())
      .or(`categorie.is.null,categorie.eq.${produit.type}`)
      .limit(2000);
    if (vendeurUserId) requete = requete.neq("user_id", vendeurUserId);
    const { data: recherches, error } = await requete;
    if (error || !recherches?.length) return { notifies: 0 };

    const prix = Number(produit.prix_base);
    const correspondantes = recherches.filter((r) => {
      if (r.marque) {
        const okMarque = r.marque === "autre" ? (!produit.marque || produit.marque === "autre") : r.marque === produit.marque;
        if (!okMarque) return false;
      }
      if (r.prix_min !== null && prix < Number(r.prix_min)) return false;
      if (r.prix_max !== null && prix > Number(r.prix_max)) return false;
      if (r.pays && paysProduit && r.pays !== paysProduit) return false;
      if (r.texte && !texteCorrespond(r.texte, produit)) return false;
      return true;
    });
    if (correspondantes.length === 0) return { notifies: 0 };

    // Une seule alerte par personne pour ce produit.
    const parUtilisateur = new Map();
    for (const r of correspondantes) if (!parUtilisateur.has(r.user_id)) parUtilisateur.set(r.user_id, r);

    // Plafond quotidien.
    const debutJour = new Date();
    debutJour.setHours(0, 0, 0, 0);
    const ids = [...parUtilisateur.keys()];
    const { data: deja } = await supabaseAdmin
      .from("alertes_recherche_envoyees")
      .select("user_id")
      .in("user_id", ids)
      .gte("date_envoi", debutJour.toISOString());
    const compteur = {};
    (deja || []).forEach((x) => { compteur[x.user_id] = (compteur[x.user_id] || 0) + 1; });
    const retenues = [...parUtilisateur.values()].filter((r) => (compteur[r.user_id] || 0) < MAX_ALERTES_PAR_JOUR);
    if (retenues.length === 0) return { notifies: 0 };

    // Enregistre l'envoi (ignore ce qui a déjà été envoyé pour cette recherche et ce produit).
    const { data: nouvelles, error: erreurEnvoi } = await supabaseAdmin
      .from("alertes_recherche_envoyees")
      .upsert(retenues.map((r) => ({ recherche_id: r.id, produit_id: produit.id, user_id: r.user_id })), { onConflict: "recherche_id,produit_id", ignoreDuplicates: true })
      .select("user_id");
    if (erreurEnvoi || !nouvelles?.length) return { notifies: 0 };

    const nomCourt = String(produit.nom).length > 60 ? `${String(produit.nom).slice(0, 57)}...` : produit.nom;
    const texte = `Nouveau : « ${nomCourt} » (${prix.toLocaleString("fr-FR")} FCFA) correspond à ta recherche.`;
    await notifierPlusieurs(supabaseAdmin, nouvelles.map((n) => ({ user_id: n.user_id, type: "alerte_recherche", texte, url: `/produit/${produit.id}` })));
    return { notifies: nouvelles.length };
  } catch (e) {
    console.error("alertes de recherche :", e);
    return { notifies: 0 };
  }
}
