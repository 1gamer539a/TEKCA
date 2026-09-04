import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";

/*
  À appeler une fois par jour, à heure fixe, par Vercel Cron (ou
  équivalent) — voir vercel.json. Protégé par CRON_SECRET, comme le
  webhook Sebpay : sans lui, personne ne peut déclencher ce job de
  l'extérieur.

  Deux choses chaque jour :
  1. Traite les abonnements arrivés à échéance : si
     renouvellement_auto est vrai ET que le wallet a le solde
     suffisant, débite et crée une nouvelle période (même palier,
     même durée) sans que l'utilisateur n'ait rien à faire. Sinon,
     l'abonnement expire simplement — pas de nouvelle tentative les
     jours suivants, il devra recliquer sur "S'abonner" lui-même.
  2. Rappel quotidien (une fois par jour max, via
     dernier_rappel_envoye_le) pour ceux qui expirent dans les 7
     prochains jours, avec un message différent selon que le
     renouvellement automatique est actif ou non.
*/
export async function GET(req) {
  try {
    if (!process.env.CRON_SECRET) {
      return NextResponse.json({ error: "CRON_SECRET non configuré." }, { status: 503 });
    }
    // Vercel Cron ajoute automatiquement ce header quand la variable
    // d'environnement CRON_SECRET est définie sur le projet — c'est
    // le mécanisme officiel, pas un paramètre d'URL (qui se
    // retrouverait en clair dans vercel.json, un fichier versionné).
    const autorisation = req.headers.get("authorization");
    if (autorisation !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }

    const maintenant = new Date();
    const aujourdHui = maintenant.toISOString().slice(0, 10); // YYYY-MM-DD
    const dansSeptJours = new Date(maintenant.getTime() + 7 * 24 * 3600 * 1000);

    // 1. Abonnements arrivés à échéance — renouvellement ou expiration
    const { data: abonnementsEchus } = await supabaseAdmin
      .from("abonnements_utilisateur")
      .select("id, user_id, palier, duree_mois, renouvellement_auto")
      .eq("statut", "actif")
      .lt("date_fin", maintenant.toISOString());

    let renouvellementsReussis = 0;
    let expirations = 0;

    for (const abonnement of abonnementsEchus || []) {
      let renouvele = false;

      if (abonnement.renouvellement_auto) {
        const { data: tarif } = await supabaseAdmin
          .from("grille_tarifs_abonnement")
          .select("prix_fcfa")
          .eq("palier", abonnement.palier)
          .eq("duree_mois", abonnement.duree_mois)
          .single();
        const prix = Number(tarif?.prix_fcfa || 0);

        const { data: wallet } = await supabaseAdmin.from("wallets").select("solde").eq("user_id", abonnement.user_id).single();
        const solde = Number(wallet?.solde || 0);

        if (tarif && solde >= prix) {
          await supabaseAdmin.from("abonnements_utilisateur").update({ statut: "expire" }).eq("id", abonnement.id);

          await supabaseAdmin
            .from("wallets")
            .update({ solde: solde - prix, date_maj: new Date().toISOString() })
            .eq("user_id", abonnement.user_id);

          await supabaseAdmin.from("transactions_wallet").insert({
            user_id: abonnement.user_id,
            type: "paiement_abonnement",
            montant: prix,
            statut: "reussi",
          });

          const dateDebut = new Date();
          const dateFin = new Date(dateDebut);
          dateFin.setMonth(dateFin.getMonth() + abonnement.duree_mois);

          await supabaseAdmin.from("abonnements_utilisateur").insert({
            user_id: abonnement.user_id,
            palier: abonnement.palier,
            duree_mois: abonnement.duree_mois,
            prix_paye: prix,
            date_debut: dateDebut.toISOString(),
            date_fin: dateFin.toISOString(),
            statut: "actif",
            renouvellement_auto: true,
          });

          await supabaseAdmin.from("notifications").insert({
            user_id: abonnement.user_id,
            type: "message",
            texte: `Ton abonnement ${abonnement.palier} a été renouvelé automatiquement pour ${abonnement.duree_mois} mois.`,
          });

          renouvele = true;
          renouvellementsReussis++;
        }
      }

      if (!renouvele) {
        await supabaseAdmin.from("abonnements_utilisateur").update({ statut: "expire" }).eq("id", abonnement.id);
        await supabaseAdmin.from("notifications").insert({
          user_id: abonnement.user_id,
          type: "message",
          texte: `Ton abonnement ${abonnement.palier} a expiré. Réabonne-toi pour retrouver tes avantages.`,
        });
        expirations++;
      }
    }

    // 2. Rappels quotidiens pour ceux qui expirent dans les 7 jours
    const { data: abonnementsAExpirer } = await supabaseAdmin
      .from("abonnements_utilisateur")
      .select("id, user_id, palier, date_fin, renouvellement_auto, dernier_rappel_envoye_le")
      .eq("statut", "actif")
      .lte("date_fin", dansSeptJours.toISOString())
      .neq("dernier_rappel_envoye_le", aujourdHui);

    let rappelsEnvoyes = 0;
    for (const abonnement of abonnementsAExpirer || []) {
      const dateFin = new Date(abonnement.date_fin);
      const joursRestants = Math.max(0, Math.ceil((dateFin - maintenant) / (24 * 3600 * 1000)));
      const echeance = joursRestants > 0 ? `dans ${joursRestants} jour(s)` : "aujourd'hui";

      const texte = abonnement.renouvellement_auto
        ? `Ton abonnement ${abonnement.palier} se renouvelle automatiquement ${echeance} — assure-toi que ton portefeuille a le solde nécessaire.`
        : `Ton abonnement ${abonnement.palier} expire ${echeance} (renouvellement automatique désactivé). Réabonne-toi pour garder tes avantages.`;

      await supabaseAdmin.from("notifications").insert({ user_id: abonnement.user_id, type: "message", texte });

      await supabaseAdmin
        .from("abonnements_utilisateur")
        .update({ dernier_rappel_envoye_le: aujourdHui })
        .eq("id", abonnement.id);

      rappelsEnvoyes++;
    }

    return NextResponse.json({ succes: true, renouvellementsReussis, expirations, rappelsEnvoyes });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur inconnue" }, { status: 500 });
  }
}
