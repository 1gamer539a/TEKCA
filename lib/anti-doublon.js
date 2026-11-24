import crypto from "crypto";
import { NextResponse } from "next/server";
import supabaseAdmin from "./supabaseAdmin";
import { ipClient } from "./limites-connexion";

/*
  PROTECTION CONTRE LE DOUBLE CLIC / LA REQUÊTE REJOUÉE — côté serveur.

  Le navigateur bloque déjà les doubles envois (lib/fetch-anti-doublon.js),
  mais la vraie protection doit être ici : un second onglet, un autre
  appareil, une mauvaise connexion qui renvoie la requête, ou un script,
  contournent le navigateur.

  Principe : on calcule l'empreinte de (utilisateur + route + corps de la
  requête) et on la "réserve" dans la base (fonction SQL atomique
  reserver_requete, voir migration_anti_doublon_limites.sql). Si la même
  empreinte a déjà été réservée dans les `fenetre` dernières secondes, la
  requête est refusée (409) AVANT d'exécuter quoi que ce soit.

  Si la base ne répond pas (migration pas encore exécutée), on laisse passer :
  cette protection s'ajoute aux autres (débits atomiques, mises à jour
  conditionnelles), elle ne doit jamais bloquer tout le site.
*/
export async function refuserDoublon(req, user, { fenetre = 8 } = {}) {
  try {
    const corps = await req.clone().text();
    const route = new URL(req.url).pathname;
    const empreinte = crypto.createHash("sha256").update(`${user.id}|${req.method}|${route}|${corps}`).digest("hex");
    const { data, error } = await supabaseAdmin.rpc("reserver_requete", {
      p_empreinte: empreinte,
      p_user: user.id,
      p_route: route,
      p_fenetre_secondes: fenetre,
    });
    if (error) {
      console.error("anti-doublon indisponible :", error.message);
      return null;
    }
    if (data === false) {
      return NextResponse.json(
        { error: "Cette action est déjà en cours de traitement. Patiente quelques secondes.", doublon: true },
        { status: 409 }
      );
    }
    return null;
  } catch (e) {
    console.error("anti-doublon :", e);
    return null;
  }
}

/*
  Limite de débit par utilisateur et par route : au plus `max` requêtes
  par fenêtre de `fenetreSecondes`. Renvoie une réponse 429 si dépassé.
*/
async function appliquerLimite(cle, route, max, fenetreSecondes) {
  try {
    const { data, error } = await supabaseAdmin.rpc("limiter_requete", {
      p_cle: cle,
      p_route: route,
      p_max: max,
      p_fenetre_secondes: fenetreSecondes,
    });
    if (error) {
      console.error("limite de débit indisponible :", error.message);
      return null;
    }
    if (data === false) {
      return NextResponse.json({ error: "Trop de requêtes. Réessaie dans un instant." }, { status: 429, headers: { "Retry-After": String(fenetreSecondes) } });
    }
    return null;
  } catch (e) {
    console.error("limite de débit :", e);
    return null;
  }
}

export function limiterDebit(user, route, max, fenetreSecondes) {
  return appliquerLimite(user.id, route, max, fenetreSecondes);
}

// Pour les routes SANS connexion : limite par adresse IP.
export function limiterDebitIp(req, route, max, fenetreSecondes) {
  return appliquerLimite(`ip:${ipClient(req)}`, route, max, fenetreSecondes);
}
