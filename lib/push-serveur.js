import webpush from "web-push";
import supabaseAdmin from "./supabaseAdmin";

/*
  Envoi de vraies notifications système (arrière-plan/app fermée),
  via le protocole Web Push standard (RFC 8030), authentifié par
  VAPID — aucun service tiers payant, tout tourne sur ce projet.

  Nécessite VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_CONTACT_EMAIL
  en variables d'environnement Vercel (voir migration_push_subscriptions.sql
  pour la table, et public/sw.js pour la réception côté navigateur).
*/
let configure = false;
function assurerConfiguration() {
  if (configure) return;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_CONTACT_EMAIL || "contact@tekca.app"}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configure = true;
}

// Envoie un push à TOUS les appareils abonnés d'un utilisateur.
// Nettoie automatiquement les abonnements expirés/révoqués (410/404).
export async function envoyerPush(userId, { titre, corps, url }) {
  assurerConfiguration();
  if (!configure || !userId) return;

  const { data: abonnements } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!abonnements || abonnements.length === 0) return;

  const payload = JSON.stringify({ titre, corps, url });

  await Promise.all(
    abonnements.map(async (abo) => {
      try {
        await webpush.sendNotification(
          { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } },
          payload
        );
      } catch (e) {
        if (e.statusCode === 410 || e.statusCode === 404) {
          // Abonnement mort (désinstallé, permission révoquée...) — on le supprime.
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", abo.id);
        }
        // Les autres erreurs sont volontairement avalées : un push raté
        // ne doit jamais faire échouer l'action métier qui l'a déclenché
        // (créer une commande, répondre à un message, etc.).
      }
    })
  );
}
