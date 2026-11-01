/*
  Service Worker TEKÇA — v2

  1) Notifications push en arrière-plan (inchangé).
  2) MODE HORS CONNEXION (nouveau) : l'application s'ouvre même sans réseau, comme une
     vraie application.
     - Pages visitées : réseau d'abord, copie gardée pour la lecture hors connexion ;
       sinon page « hors connexion » (/hors-ligne.html).
     - Fichiers de l'application (/_next/static) : copie locale, ouverture instantanée.
     - Images (site + photos publiques Supabase) : affichées depuis la copie locale.
     - Lectures de catalogue (produits, catégories, FAQ, bannières, boutiques) et listes
       personnelles (favoris, commandes) : copie gardée PAR UTILISATEUR, relue hors connexion.
     - Jamais en copie : /api/* (paiements, commandes, messages…), /auth/*, et tout ce
       qui n'est pas une simple lecture (POST/PUT/PATCH/DELETE). Les actions d'argent
       exigent le réseau : le site l'indique clairement au lieu d'échouer en silence.
     - À la déconnexion, le site demande de vider les copies (message « VIDER_DONNEES »).
*/
const VERSION = "v2";
const CACHE_STATIQUE = `tekca-statique-${VERSION}`;
const CACHE_PAGES = `tekca-pages-${VERSION}`;
const CACHE_IMAGES = `tekca-images-${VERSION}`;
const CACHE_DONNEES = `tekca-donnees-${VERSION}`;
const CACHES_COURANTS = [CACHE_STATIQUE, CACHE_PAGES, CACHE_IMAGES, CACHE_DONNEES];

const PRECACHE = ["/hors-ligne.html", "/icon-192.png", "/icon-512.png", "/logo-tekca.png", "/badge-96.png", "/manifest.webmanifest"];
const TABLES_LISIBLES = ["produits", "categories_taxes", "faq", "bannieres_accueil", "vendeurs", "favoris", "commandes"];
const DELAI_PAGE_MS = 6000;
const DELAI_DONNEES_MS = 7000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_STATIQUE);
      await Promise.all(PRECACHE.map((u) => cache.add(u).catch(() => {})));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const noms = await caches.keys();
      await Promise.all(noms.filter((n) => n.startsWith("tekca-") && !CACHES_COURANTS.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "VIDER_DONNEES") {
    event.waitUntil(Promise.all([caches.delete(CACHE_DONNEES), caches.delete(CACHE_PAGES)]));
  }
});

function fetchAvecDelai(requete, ms) {
  return new Promise((resolve, reject) => {
    const minuterie = setTimeout(() => reject(new Error("delai")), ms);
    fetch(requete).then(
      (r) => { clearTimeout(minuterie); resolve(r); },
      (e) => { clearTimeout(minuterie); reject(e); }
    );
  });
}

async function limiter(nomCache, max) {
  const cache = await caches.open(nomCache);
  const cles = await cache.keys();
  for (let i = 0; i < cles.length - max; i++) await cache.delete(cles[i]);
}

// Identifiant de l'utilisateur lu dans son jeton (sans vérification : sert seulement à
// ranger les copies par personne, jamais à autoriser quoi que ce soit).
function identifiantUtilisateur(requete) {
  try {
    const jeton = (requete.headers.get("authorization") || "").replace("Bearer ", "");
    const charge = JSON.parse(atob(jeton.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return charge.sub || "anon";
  } catch {
    return "anon";
  }
}

function cleDonnees(requete) {
  return new Request(`${self.location.origin}/__donnees/${encodeURIComponent(identifiantUtilisateur(requete))}/${encodeURIComponent(requete.url)}`);
}

async function pageReseauPuisCache(event, requete) {
  const url = new URL(requete.url);
  const copiable = !url.pathname.startsWith("/auth/") && !url.pathname.startsWith("/api/");
  try {
    const reponse = await fetchAvecDelai(requete, DELAI_PAGE_MS);
    // Pas de copie d'une redirection (ex. page protégée renvoyée vers la connexion).
    if (copiable && reponse.ok && !reponse.redirected && reponse.type === "basic") {
      const copie = reponse.clone();
      event.waitUntil(caches.open(CACHE_PAGES).then((c) => c.put(requete, copie)).then(() => limiter(CACHE_PAGES, 40)));
    }
    return reponse;
  } catch {
    const copie = await caches.match(requete);
    if (copie) return copie;
    return (await caches.match("/hors-ligne.html")) || new Response("Hors connexion", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function copieLocalePuisReseau(requete, nomCache) {
  const cache = await caches.open(nomCache);
  const copie = await cache.match(requete);
  if (copie) return copie;
  const reponse = await fetch(requete);
  if (reponse.ok) cache.put(requete, reponse.clone());
  return reponse;
}

async function imageCopieEtMiseAJour(event, requete) {
  const cache = await caches.open(CACHE_IMAGES);
  const copie = await cache.match(requete);
  const miseAJour = fetch(requete)
    .then((reponse) => {
      if (reponse.ok) {
        cache.put(requete, reponse.clone());
        limiter(CACHE_IMAGES, 120);
      }
      return reponse;
    })
    .catch(() => null);
  if (copie) {
    event.waitUntil(miseAJour);
    return copie;
  }
  return (await miseAJour) || Response.error();
}

async function donneesReseauPuisCopie(event, requete) {
  const cle = cleDonnees(requete);
  try {
    const reponse = await fetchAvecDelai(requete, DELAI_DONNEES_MS);
    if (reponse.ok) {
      const copie = reponse.clone();
      event.waitUntil(caches.open(CACHE_DONNEES).then((c) => c.put(cle, copie)).then(() => limiter(CACHE_DONNEES, 150)));
    }
    return reponse;
  } catch (e) {
    const cache = await caches.open(CACHE_DONNEES);
    const copie = await cache.match(cle);
    if (copie) {
      const entetes = new Headers(copie.headers);
      entetes.set("X-Tekca-Hors-Ligne", "1");
      return new Response(copie.body, { status: copie.status, statusText: copie.statusText, headers: entetes });
    }
    throw e;
  }
}

self.addEventListener("fetch", (event) => {
  const requete = event.request;
  if (requete.method !== "GET") return; // les écritures ne passent jamais par une copie
  const url = new URL(requete.url);

  if (requete.mode === "navigate") {
    event.respondWith(pageReseauPuisCache(event, requete));
    return;
  }

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
    if (url.pathname.startsWith("/_next/static/")) {
      event.respondWith(copieLocalePuisReseau(requete, CACHE_STATIQUE));
      return;
    }
    if (/\.(?:png|jpe?g|webp|svg|gif|avif|ico|woff2?)$/i.test(url.pathname)) {
      event.respondWith(imageCopieEtMiseAJour(event, requete));
    }
    return;
  }

  if (url.hostname.endsWith(".supabase.co")) {
    if (url.pathname.startsWith("/storage/v1/object/public/")) {
      // Les <img> envoient une requête « opaque » impossible à garder proprement :
      // on redemande l'image en mode CORS (Supabase l'autorise) pour pouvoir la copier.
      const requeteCors = new Request(requete.url, { mode: "cors", credentials: "omit" });
      event.respondWith(imageCopieEtMiseAJour(event, requeteCors));
      return;
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      const table = url.pathname.split("/")[3];
      if (TABLES_LISIBLES.includes(table)) event.respondWith(donneesReseauPuisCopie(event, requete));
    }
  }
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
