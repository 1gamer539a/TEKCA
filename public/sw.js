/*
  Service Worker TEKÇA — gère uniquement les notifications push en
  arrière-plan (pas de mise en cache/offline pour l'instant, ce
  n'était pas demandé). Fichier statique servi tel quel depuis
  /public, donc accessible à la racine (/sw.js) — condition requise
  pour qu'il puisse contrôler toute l'app (scope "/").
*/

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let donnees = { titre: "TEKÇA", corps: "Tu as une nouvelle notification.", url: "/notifications" };
  try {
    if (event.data) donnees = { ...donnees, ...event.data.json() };
  } catch {
    // payload non-JSON — on garde les valeurs par défaut plutôt que de planter
  }

  event.waitUntil(
    (async () => {
      // Si l'app est déjà ouverte et visible, NotificationsTempsReel.jsx
      // (Supabase Realtime) a déjà joué le son et averti l'utilisateur
      // en direct — évite de doubler avec une notification système.
      const clientsOuverts = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const appVisible = clientsOuverts.some((c) => c.visibilityState === "visible");
      if (appVisible) return;

      await self.registration.showNotification(donnees.titre, {
        body: donnees.corps,
        icon: "/icon-192.png",
        badge: "/badge-96.png",
        data: { url: donnees.url || "/notifications" },
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/notifications";
  event.waitUntil(
    (async () => {
      const clientsOuverts = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existant = clientsOuverts.find((c) => c.url.includes(url));
      if (existant) return existant.focus();
      const dejaOuvert = clientsOuverts[0];
      if (dejaOuvert) {
        await dejaOuvert.focus();
        return dejaOuvert.navigate(url);
      }
      return self.clients.openWindow(url);
    })()
  );
});
