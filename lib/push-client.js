import { supabase } from "./supabase";

/*
  Active/désactive les vraies notifications push (arrière-plan) pour
  CET appareil précis. Utilisé par le toggle "Notifications push"
  dans ProfilParametres.jsx.

  NEXT_PUBLIC_VAPID_PUBLIC_KEY doit être définie côté Vercel avec la
  MÊME valeur que VAPID_PUBLIC_KEY (celle-ci exposée au client — une
  clé publique VAPID est justement faite pour être publique, voir
  lib/push-serveur.js pour la clé privée, jamais exposée).
*/

function urlBase64ToUint8Array(base64String) {
  const base64 = base64String.replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(base64);
  return Uint8Array.from([...brut].map((c) => c.charCodeAt(0)));
}

export function pushSupporte() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

// À appeler au chargement de la page pour savoir si CET appareil a
// déjà un abonnement actif (état réel du toggle, pas juste un état
// local qui ment).
export async function abonnementPushActif() {
  if (!pushSupporte()) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration) return false;
    const abonnement = await registration.pushManager.getSubscription();
    return !!abonnement;
  } catch {
    return false;
  }
}

export async function activerPush() {
  if (!pushSupporte()) return { ok: false, raison: "non_supporte" };
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return { ok: false, raison: "cle_manquante" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, raison: "refuse" };

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const abonnement = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
  });

  const { data: { session } } = await supabase.auth.getSession();
  const reponse = await fetch("/api/push/abonner", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ subscription: abonnement.toJSON() }),
  });
  if (!reponse.ok) return { ok: false, raison: "erreur_serveur" };

  return { ok: true };
}

export async function desactiverPush() {
  if (!pushSupporte()) return { ok: true };
  const registration = await navigator.serviceWorker.getRegistration("/");
  const abonnement = await registration?.pushManager.getSubscription();
  if (!abonnement) return { ok: true };

  const endpoint = abonnement.endpoint;
  await abonnement.unsubscribe();

  const { data: { session } } = await supabase.auth.getSession();
  await fetch("/api/push/desabonner", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ endpoint }),
  });

  return { ok: true };
}
