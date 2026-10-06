import supabaseAdmin from "./supabaseAdmin";
import { verifierPin } from "./pin";
import { cookiePinValide, NOM_COOKIE_PIN } from "./pin-cookie";

/*
  Contrôle serveur du code PIN (avec limitation anti brute-force :
  5 échecs / 15 min par compte). Utilisé par /api/securite/pin/verifier
  ET par les routes qui déplacent de l'argent (retrait, transfert) :
  le PIN y est revérifié côté serveur, on ne se fie plus au seul modal
  affiché dans le navigateur.
  Retourne { ok: true } ou { ok: false, status, error, tentativesRestantes? }.
*/
const FENETRE_MINUTES = 15;
const MAX_ECHECS = 5;

export async function controlerPin(userId, pin) {
  const debutFenetre = new Date(Date.now() - FENETRE_MINUTES * 60 * 1000).toISOString();
  const { count: echecsRecents } = await supabaseAdmin
    .from("journal_securite")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", "pin_echoue")
    .gte("date_creation", debutFenetre);
  if ((echecsRecents || 0) >= MAX_ECHECS) {
    return { ok: false, status: 429, error: `Trop de tentatives. Réessaie dans ${FENETRE_MINUTES} minutes.` };
  }
  if (!pin || typeof pin !== "string") return { ok: false, status: 400, error: "Code PIN requis." };

  const { data: profil, error } = await supabaseAdmin.from("users").select("code_pin_hash").eq("id", userId).single();
  if (error) throw error;
  if (!profil?.code_pin_hash) return { ok: false, status: 400, error: "Aucun code PIN configuré pour ce compte." };

  if (!verifierPin(pin, profil.code_pin_hash)) {
    await supabaseAdmin.from("journal_securite").insert({ user_id: userId, type: "pin_echoue", details: "code_pin_incorrect" });
    return { ok: false, status: 400, error: "Code incorrect.", tentativesRestantes: MAX_ECHECS - (echecsRecents || 0) - 1 };
  }
  return { ok: true };
}

/*
  Réglages PIN de l'utilisateur (table parametres_utilisateur). Si la table
  n'existe pas encore ou en cas d'erreur : valeurs les plus strictes.
*/
export async function parametresPin(userId) {
  try {
    const { data } = await supabaseAdmin
      .from("parametres_utilisateur")
      .select("pin_delai_minutes, pin_pour_actions")
      .eq("user_id", userId)
      .maybeSingle();
    return { delaiReglage: data?.pin_delai_minutes ?? 5, pourActions: data?.pin_pour_actions ?? true };
  } catch {
    return { delaiReglage: 5, pourActions: true };
  }
}

/*
  Contrôle PIN d'une action NON critique (paiement du panier, abonnement,
  forfait IA, achats numériques). Si l'utilisateur a choisi dans ses
  Paramètres de ne pas ressaisir son PIN à chaque action, on exige à la
  place le cookie "PIN vérifié" signé (donc l'app a bien été déverrouillée
  avec le PIN récemment). Les retraits et transferts n'utilisent PAS cette
  fonction : ils exigent toujours le PIN (controlerPin).
*/
export async function controlerActionPin(req, userId, pin) {
  const { pourActions } = await parametresPin(userId);
  if (pourActions) return controlerPin(userId, pin);
  const ok = await cookiePinValide(req.cookies.get(NOM_COOKIE_PIN)?.value, userId);
  return ok ? { ok: true } : { ok: false, status: 403, error: "Déverrouille l'application avec ton code PIN." };
}
