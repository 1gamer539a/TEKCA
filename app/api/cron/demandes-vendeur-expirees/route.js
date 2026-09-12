import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";

/*
  À appeler une fois par jour par Vercel Cron (voir vercel.json) —
  même protection par CRON_SECRET que /api/cron/rappels-abonnement.

  Délai avant alerte : 72h pour un revendeur officiel (dossier plus
  lourd à vérifier — identité, justificatif d'activité), 24h pour un
  vendeur simple (le schéma le décrit comme "quasi instantané" à
  valider, donc 24h sans traitement est déjà anormal). Chaque
  vendeur en attente n'est signalé qu'UNE fois
  (alerte_expiration_envoyee), pour ne pas spammer l'équipe à chaque
  exécution tant que personne n'a traité la demande.
*/
const DELAI_HEURES = { revendeur_officiel: 72, vendeur_simple: 24 };

export async function GET(req) {
  try {
    if (!process.env.CRON_SECRET) {
      return NextResponse.json({ error: "CRON_SECRET non configuré." }, { status: 503 });
    }
    const autorisation = req.headers.get("authorization");
    if (autorisation !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }

    const { data: enAttente } = await supabaseAdmin
      .from("vendeurs")
      .select("id, nom_boutique, niveau, date_demande")
      .eq("statut", "en_attente")
      .eq("alerte_expiration_envoyee", false);

    const maintenant = Date.now();
    const expirees = (enAttente || []).filter((v) => {
      const seuilHeures = DELAI_HEURES[v.niveau] || 72;
      const ageHeures = (maintenant - new Date(v.date_demande).getTime()) / 3600000;
      return ageHeures >= seuilHeures;
    });

    if (expirees.length === 0) {
      return NextResponse.json({ succes: true, alertesEnvoyees: 0 });
    }

    const { data: equipe } = await supabaseAdmin.from("users").select("id").in("role", ["admin", "equipe"]);

    let alertesEnvoyees = 0;
    for (const v of expirees) {
      const ageHeures = Math.floor((maintenant - new Date(v.date_demande).getTime()) / 3600000);
      const texte = `Demande vendeur "${v.nom_boutique}" (${v.niveau === "revendeur_officiel" ? "revendeur officiel" : "vendeur simple"}) en attente depuis ${ageHeures}h — à traiter.`;

      if (equipe?.length) {
        await supabaseAdmin.from("notifications").insert(
          equipe.map((membre) => ({ user_id: membre.id, type: "demande_expiree", texte }))
        );
      }
      await supabaseAdmin.from("vendeurs").update({ alerte_expiration_envoyee: true }).eq("id", v.id);
      alertesEnvoyees++;
    }

    return NextResponse.json({ succes: true, alertesEnvoyees });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur inconnue" }, { status: 500 });
  }
}
