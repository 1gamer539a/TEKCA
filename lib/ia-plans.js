import { NextResponse } from "next/server";
import supabaseAdmin from "./supabaseAdmin";

/*
  Niveau d'abonnement TEKÇA d'un utilisateur, pour réserver certaines fonctions de l'assistant
  IA (génération d'images, fiche produit depuis une photo) aux abonnés payants.

    niveau 0 = gratuit   1 = Basic (2 500 FCFA/mois)   2 = Pro   3 = Premium

  Les anciens forfaits IA (table ia_abonnements, encore valides) comptent comme Basic :
  personne ne perd ce qu'il a déjà payé.
  Le niveau est TOUJOURS relu en base côté serveur — jamais envoyé par le navigateur.
*/
export const NIVEAU_PAR_PALIER = { basic: 1, pro: 2, premium: 3 };
export const NOM_PALIER = { 0: "gratuit", 1: "basic", 2: "pro", 3: "premium" };

// Images par mois et par niveau. Chaque image coûte réellement de l'argent (modèle d'image
// payant) : ces plafonds protègent votre marge. À ajuster selon la facture constatée.
export const QUOTA_IMAGES_MOIS = { 0: 0, 1: 15, 2: 40, 3: 100 };

// Mises en ligne de produits par l'IA (photo → annonce) : le palier Gratuit y a droit 2 fois par
// mois ; les abonnés payants n'ont pas de plafond mensuel (seule la limite de débit anti-abus).
export const QUOTA_FICHES_MOIS_GRATUIT = 2;

export async function planUtilisateur(userId) {
  const maintenant = new Date().toISOString();
  const [abo, ia] = await Promise.all([
    supabaseAdmin
      .from("abonnements_utilisateur")
      .select("palier, date_fin")
      .eq("user_id", userId)
      .eq("statut", "actif")
      .gt("date_fin", maintenant)
      .order("date_fin", { ascending: false })
      .limit(1),
    supabaseAdmin
      .from("ia_abonnements")
      .select("forfait, date_fin")
      .eq("user_id", userId)
      .order("date_debut", { ascending: false })
      .limit(1),
  ]);

  let niveau = NIVEAU_PAR_PALIER[abo.data?.[0]?.palier] || 0;
  let dateFin = abo.data?.[0]?.date_fin || null;
  const forfaitIA = ia.data?.[0];
  if (forfaitIA && forfaitIA.forfait === "premium" && (!forfaitIA.date_fin || new Date(forfaitIA.date_fin) > new Date())) {
    if (niveau < 1) { niveau = 1; dateFin = forfaitIA.date_fin; }
  }
  return { niveau, palier: NOM_PALIER[niveau], dateFin, quotaImages: QUOTA_IMAGES_MOIS[niveau] || 0 };
}

export async function imagesUtiliseesCeMois(userId) {
  const debut = new Date();
  debut.setDate(1);
  debut.setHours(0, 0, 0, 0);
  const { count } = await supabaseAdmin
    .from("ia_generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .like("type_generation", "image:%")
    .gte("date_creation", debut.toISOString());
  return count || 0;
}

// Réponse standard « fonction réservée aux abonnés » (HTTP 403, code lisible par l'interface).
export function reponsePlanRequis(niveauRequis = 1) {
  return NextResponse.json(
    { error: "Cette fonction est réservée aux abonnés à partir de 2 500 FCFA par mois.", code: "plan_requis", niveauRequis },
    { status: 403 }
  );
}

// Nombre de mises en ligne IA réussies ce mois-ci (une ligne « fiche_produit » par brouillon livré).
export async function fichesUtiliseesCeMois(userId) {
  const debut = new Date();
  debut.setDate(1);
  debut.setHours(0, 0, 0, 0);
  const { count } = await supabaseAdmin
    .from("ia_generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type_generation", "fiche_produit")
    .gte("date_creation", debut.toISOString());
  return count || 0;
}
