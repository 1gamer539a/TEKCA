import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { lirePinCookie, creerValeurCookiePin, delaiEffectifMinutes, optionsCookiePin, NOM_COOKIE_PIN } from "../../../../lib/pin-cookie";
import { reponseErreurServeur } from "../../../../lib/erreurs";

/*
  Réglages personnels de l'utilisateur connecté (Mon compte > Paramètres).
  Valeurs par défaut quand aucune ligne n'existe (ou si la table n'est pas
  encore créée : voir migration_parametres_utilisateur.sql).
*/
const DEFAUTS = {
  pin_delai_minutes: 5,
  pin_pour_actions: true,
  notif_commandes: true,
  notif_messages: true,
  notif_promotions: true,
};
const CHAMPS = Object.keys(DEFAUTS);
const DELAIS = [0, 1, 5, 15, 30, 60];

async function lire(userId) {
  const { data } = await supabaseAdmin.from("parametres_utilisateur").select(CHAMPS.join(", ")).eq("user_id", userId).maybeSingle();
  return { ...DEFAUTS, ...(data || {}) };
}

export async function GET(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    return NextResponse.json({ parametres: await lire(user.id) });
  } catch (e) {
    return reponseErreurServeur(e, "app/api/compte/parametres");
  }
}

export async function PUT(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const corps = await req.json();
    const patch = {};
    for (const champ of CHAMPS) {
      if (corps[champ] === undefined) continue;
      if (champ === "pin_delai_minutes") {
        if (!DELAIS.includes(Number(corps[champ]))) return NextResponse.json({ error: "Délai invalide." }, { status: 400 });
        patch[champ] = Number(corps[champ]);
      } else {
        if (typeof corps[champ] !== "boolean") return NextResponse.json({ error: `${champ} invalide.` }, { status: 400 });
        patch[champ] = corps[champ];
      }
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Aucun réglage fourni." }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("parametres_utilisateur")
      .upsert({ user_id: user.id, ...patch, date_maj: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) {
      console.error("parametres_utilisateur :", error);
      return NextResponse.json({ error: "Enregistrement impossible (migration_parametres_utilisateur.sql exécutée ?)." }, { status: 500 });
    }

    const reponse = NextResponse.json({ parametres: await lire(user.id) });
    // Nouveau délai de verrouillage : appliqué tout de suite au cookie en cours.
    if (patch.pin_delai_minutes !== undefined) {
      const lecture = await lirePinCookie(req.cookies.get(NOM_COOKIE_PIN)?.value, user.id);
      if (lecture.valide) {
        reponse.cookies.set(NOM_COOKIE_PIN, await creerValeurCookiePin(user.id, delaiEffectifMinutes(patch.pin_delai_minutes)), optionsCookiePin());
      }
    }
    return reponse;
  } catch (e) {
    return reponseErreurServeur(e, "app/api/compte/parametres");
  }
}
