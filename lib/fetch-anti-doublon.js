/*
  PROTECTION CONTRE LE DOUBLE CLIC — côté navigateur.

  Quand l'utilisateur clique deux fois vite sur « Payer », « Envoyer »,
  « Valider »…, le navigateur enverrait deux requêtes identiques. Ce
  wrapper de fetch ne laisse partir QU'UNE requête : tant qu'une requête
  d'écriture identique (même méthode, même adresse, même contenu) est en
  cours — et pendant 1 seconde après sa réponse — toute copie reçoit la
  même réponse au lieu de repartir.

  S'applique aux écritures (POST/PUT/PATCH/DELETE) vers nos routes /api et
  vers Supabase (insert/update/rpc). Jamais aux lectures (GET), à
  l'authentification, au stockage de fichiers ni au temps réel.
  Le serveur a sa propre protection (lib/anti-doublon.js) : celle-ci
  épargne surtout un message d'erreur « déjà en cours » à l'utilisateur.
*/
const DELAI_APRES_REPONSE_MS = 1000;
const ENTREES = new Map();

function methodeDe(input, init) {
  const m = init?.method || (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET");
  return String(m).toUpperCase();
}

function urlDe(input) {
  if (typeof input === "string") return input;
  if (typeof URL !== "undefined" && input instanceof URL) return input.href;
  return input?.url || String(input);
}

export function fetchAntiDoublon(input, init) {
  const methode = methodeDe(input, init);
  const url = urlDe(input);
  const ecriture = ["POST", "PUT", "PATCH", "DELETE"].includes(methode);
  const exclu = /\/(auth|storage|realtime)\/v1\//.test(url);
  const corps = init?.body;
  // Sans corps texte lisible (fichier, FormData, objet Request) : on ne peut pas
  // comparer deux requêtes, on laisse passer.
  const comparable = corps === undefined || corps === null || typeof corps === "string";
  if (!ecriture || exclu || !comparable || (typeof Request !== "undefined" && input instanceof Request)) {
    return fetch(input, init);
  }

  const cle = `${methode} ${url} ${corps || ""}`;
  const existante = ENTREES.get(cle);
  if (existante) return existante.promesse.then((r) => r.clone());

  const promesse = fetch(input, init);
  const entree = { promesse, minuterie: null };
  ENTREES.set(cle, entree);
  const liberer = () => {
    clearTimeout(entree.minuterie);
    if (ENTREES.get(cle) === entree) ENTREES.delete(cle);
  };
  promesse.then(
    () => {
      entree.minuterie = setTimeout(liberer, DELAI_APRES_REPONSE_MS);
    },
    liberer // erreur réseau : on libère tout de suite pour permettre de réessayer
  );
  return promesse.then((r) => r.clone());
}

let installe = false;
export function installerAntiDoublonGlobal() {
  if (installe || typeof window === "undefined") return;
  installe = true;
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = urlDe(input);
    // Uniquement nos propres routes API (les écritures Supabase passent par
    // le client configuré dans lib/supabase.js).
    if (url.startsWith("/api/") || url.startsWith(`${window.location.origin}/api/`)) {
      const methode = methodeDe(input, init);
      const corps = init?.body;
      if (["POST", "PUT", "PATCH", "DELETE"].includes(methode) && (corps === undefined || corps === null || typeof corps === "string")) {
        return fetchAntiDoublonAvec(original, input, init, methode, url, corps);
      }
    }
    return original(input, init);
  };
}

function fetchAntiDoublonAvec(original, input, init, methode, url, corps) {
  const cle = `${methode} ${url} ${corps || ""}`;
  const existante = ENTREES.get(cle);
  if (existante) return existante.promesse.then((r) => r.clone());
  const promesse = original(input, init);
  const entree = { promesse, minuterie: null };
  ENTREES.set(cle, entree);
  const liberer = () => {
    clearTimeout(entree.minuterie);
    if (ENTREES.get(cle) === entree) ENTREES.delete(cle);
  };
  promesse.then(
    () => {
      entree.minuterie = setTimeout(liberer, DELAI_APRES_REPONSE_MS);
    },
    liberer
  );
  return promesse.then((r) => r.clone());
}
