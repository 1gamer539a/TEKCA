import supabaseAdmin from "./supabaseAdmin";
import { planUtilisateur } from "./ia-plans";
import fr from "./i18n/locales/fr.json";
import en from "./i18n/locales/en.json";
import pt from "./i18n/locales/pt.json";
import sw from "./i18n/locales/sw.json";
import ln from "./i18n/locales/ln.json";
import ar from "./i18n/locales/ar.json";

/*
  ACTIONS « COMPTE » DE L'ASSISTANT — gratuites pour tout le monde : solde, commandes,
  ventes (vendeurs), abonnement, réclamations.

  CONFIDENTIALITÉ : l'IA ne voit JAMAIS ces chiffres. Elle écrit seulement un marqueur
  (ex. [[ACTION:solde]]) + une phrase d'introduction ; c'est CE code, sur le serveur, qui lit
  la base avec l'identité de la personne connectée et ajoute les chiffres à la réponse, dans sa
  langue. Les montants et les commandes ne partent donc jamais chez Google/OpenAI.
*/
const LANGUES = { fr, en, pt, sw, ln, ar };
const LOCALES = { fr: "fr-FR", en: "en-GB", pt: "pt-PT", sw: "sw-KE", ln: "fr-CD", ar: "ar" };
export const ACTIONS = ["solde", "commandes", "ventes", "abonnement", "reclamations"];

function texte(langue, cle, variables = {}) {
  const brut = LANGUES[langue]?.ia?.[cle] ?? fr.ia?.[cle] ?? cle;
  return brut.replace(/\{\{(\w+)\}\}/g, (_, nom) => (variables[nom] ?? ""));
}

function date(langue, valeur) {
  try {
    return new Date(valeur).toLocaleDateString(LOCALES[langue] || "fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return new Date(valeur).toLocaleDateString("fr-FR");
  }
}

const montant = (n) => Number(n || 0).toLocaleString("fr-FR");

export async function executerAction(nom, userId, langue = "fr") {
  const l = LANGUES[langue] ? langue : "fr";

  if (nom === "solde") {
    const { data } = await supabaseAdmin.from("wallets").select("solde").eq("user_id", userId).maybeSingle();
    return texte(l, "actSolde", { montant: montant(data?.solde) });
  }

  if (nom === "commandes") {
    const { data } = await supabaseAdmin
      .from("commandes")
      .select("statut, date_creation, produits ( nom )")
      .eq("client_id", userId)
      .order("date_creation", { ascending: false })
      .limit(5);
    if (!data?.length) return texte(l, "actCommandesVide");
    const lignes = data.map((c) =>
      texte(l, "actLigneCommande", { produit: c.produits?.nom || "—", statut: texte(l, `actStatut_${c.statut}`), date: date(l, c.date_creation) })
    );
    return `${texte(l, "actCommandesTitre")}\n${lignes.join("\n")}`;
  }

  if (nom === "ventes") {
    const { data: boutiques } = await supabaseAdmin.from("vendeurs").select("id").eq("user_id", userId);
    const ids = (boutiques || []).map((b) => b.id);
    if (!ids.length) return texte(l, "actVentesVide");
    const { data } = await supabaseAdmin.from("commandes").select("statut").in("vendeur_id", ids).limit(2000);
    const compte = (s) => (data || []).filter((c) => c.statut === s).length;
    if (!(data || []).length) return texte(l, "actVentesVide");
    return texte(l, "actVentes", { aTraiter: compte("paye"), enTransit: compte("expedie"), livrees: compte("livre") });
  }

  if (nom === "abonnement") {
    const plan = await planUtilisateur(userId);
    if (plan.niveau === 0) return texte(l, "actAbonnementAucun");
    return texte(l, "actAbonnementActif", { palier: texte(l, `actPalier_${plan.palier}`), date: plan.dateFin ? date(l, plan.dateFin) : "—" });
  }

  if (nom === "reclamations") {
    const { data } = await supabaseAdmin
      .from("contacts_support")
      .select("statut, date_creation")
      .eq("client_id", userId)
      .order("date_creation", { ascending: false })
      .limit(3);
    if (!data?.length) return texte(l, "actReclamationsVide");
    const lignes = data.map((r) => texte(l, "actLigneReclamation", { date: date(l, r.date_creation), statut: texte(l, `actContact_${r.statut}`) }));
    return `${texte(l, "actReclamationsTitre")}\n${lignes.join("\n")}`;
  }

  return "";
}
