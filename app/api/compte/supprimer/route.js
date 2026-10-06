import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { controlerPin } from "../../../../lib/pin-serveur";

/*
  Suppression de compte (par l'utilisateur lui-même).

  GET  → méthode de confirmation ("motdepasse" ou "pin" pour les comptes
         Google/Facebook/téléphone) + éléments qui BLOQUENT la suppression.
  POST → { motDePasse | pin } : revérifie l'identité puis supprime.

  Ce n'est PAS une suppression physique : transactions, commandes et
  séquestres doivent rester en base (obligations légales, litiges en
  cours, comptabilité). Le compte est ANONYMISÉ et verrouillé :
  profil vidé, PIN effacé, vendeur suspendu (ses produits disparaissent),
  abonnements push supprimés, connexion interdite (ban Supabase Auth +
  marqueur app_metadata.compte_supprime lu par le middleware), toutes les
  sessions révoquées.

  Bloquée tant que : solde du portefeuille > 0, ou commandes en cours
  (payées / expédiées) en tant qu'acheteur ou que vendeur.
*/
const STATUTS_EN_COURS = ["paye", "expedie"];

// Confirmation par le code PIN (le propriétaire du téléphone le connaît) ;
// à défaut de PIN (inscription non terminée), mot de passe pour les comptes e-mail.
async function methodeConfirmation(user) {
  const { data: profil } = await supabaseAdmin.from("users").select("code_pin_hash").eq("id", user.id).maybeSingle();
  if (profil?.code_pin_hash) return "pin";
  return user.app_metadata?.provider === "email" ? "motdepasse" : "pin";
}

async function blocages(userId) {
  const liste = [];
  const { data: wallet } = await supabaseAdmin.from("wallets").select("solde").eq("user_id", userId).maybeSingle();
  if (Number(wallet?.solde || 0) > 0) liste.push("solde");

  const { count: commandesAcheteur } = await supabaseAdmin
    .from("commandes")
    .select("id", { count: "exact", head: true })
    .eq("client_id", userId)
    .in("statut", STATUTS_EN_COURS);
  if ((commandesAcheteur || 0) > 0) liste.push("commandes_acheteur");

  const { data: vendeurs } = await supabaseAdmin.from("vendeurs").select("id").eq("user_id", userId);
  const vendeurIds = (vendeurs || []).map((v) => v.id);
  if (vendeurIds.length > 0) {
    const { count: commandesVendeur } = await supabaseAdmin
      .from("commandes")
      .select("id", { count: "exact", head: true })
      .in("vendeur_id", vendeurIds)
      .in("statut", STATUTS_EN_COURS);
    if ((commandesVendeur || 0) > 0) liste.push("commandes_vendeur");
  }
  return { liste, vendeurIds };
}

export async function GET(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    const { liste } = await blocages(user.id);
    return NextResponse.json({ methode: await methodeConfirmation(user), blocages: liste });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur serveur." }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { motDePasse, pin } = await req.json();
    const { liste, vendeurIds } = await blocages(user.id);
    if (liste.length > 0) {
      return NextResponse.json({ error: "Suppression impossible pour le moment.", blocages: liste }, { status: 409 });
    }

    // Revérification de l'identité : mot de passe (comptes e-mail) ou PIN.
    if ((await methodeConfirmation(user)) === "motdepasse") {
      if (!motDePasse || typeof motDePasse !== "string" || !user.email) {
        return NextResponse.json({ error: "Mot de passe requis." }, { status: 400 });
      }
      // Client anonyme jetable : ne touche à aucune session existante.
      const verif = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: erreurMdp } = await verif.auth.signInWithPassword({ email: user.email, password: motDePasse });
      if (erreurMdp) return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 400 });
    } else {
      const resultat = await controlerPin(user.id, pin);
      if (!resultat.ok) return NextResponse.json({ error: resultat.error, tentativesRestantes: resultat.tentativesRestantes }, { status: resultat.status });
    }

    // 1) Anonymisation du profil (chaque étape tolérante : une colonne
    //    absente ou contrainte refusée ne doit pas empêcher le verrouillage).
    const anonymiser = async (champs) => {
      const { error } = await supabaseAdmin.from("users").update(champs).eq("id", user.id);
      if (error) console.error("Anonymisation partielle :", Object.keys(champs), error.message);
    };
    await anonymiser({ nom: "Compte supprimé", code_pin_hash: null });
    await anonymiser({ telephone: null });
    await anonymiser({ email: null });
    await anonymiser({ pseudo: `supprime_${user.id.slice(0, 8)}` });
    await anonymiser({ ville: null });

    // 2) Boutique suspendue (ses produits ne sont plus visibles), push et réglages effacés.
    if (vendeurIds.length > 0) {
      await supabaseAdmin.from("vendeurs").update({ statut: "suspendu" }).in("id", vendeurIds);
      // La lecture publique des produits ne regarde que statut_validation :
      // on les retire du catalogue explicitement.
      await supabaseAdmin.from("produits").update({ statut_validation: "refuse" }).in("vendeur_id", vendeurIds);
    }
    await supabaseAdmin.from("push_subscriptions").delete().eq("user_id", user.id);
    await supabaseAdmin.from("parametres_utilisateur").delete().eq("user_id", user.id);

    // 3) Verrouillage du compte d'authentification + libération de l'e-mail.
    const { error: erreurAuth } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      ban_duration: "876000h",
      app_metadata: { compte_supprime: true },
    });
    if (erreurAuth) throw erreurAuth;
    await supabaseAdmin.auth.admin
      .updateUserById(user.id, { email: `supprime-${user.id}@tekca.invalid`, email_confirm: true })
      .catch(() => {});

    // 4) Toutes les sessions révoquées (le jeton actuel est invalidé aussi).
    const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
    if (token) await supabaseAdmin.auth.admin.signOut(token, "global").catch(() => {});

    const reponse = NextResponse.json({ succes: true });
    reponse.cookies.set("tekca_pin_ok", "", { httpOnly: true, path: "/", maxAge: 0 });
    return reponse;
  } catch (e) {
    console.error("Suppression de compte :", e);
    return NextResponse.json({ error: "Suppression impossible. Réessaie plus tard." }, { status: 500 });
  }
}
