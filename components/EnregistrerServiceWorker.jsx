"use client";

import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { viderPrechargement } from "../lib/precharge";

/*
  Enregistre le service worker pour TOUT LE MONDE (avant, seulement pour les utilisateurs
  connectés qui activaient les notifications) : c'est lui qui permet d'ouvrir l'application
  sans réseau. À la déconnexion, il vide les copies de données de la personne et le
  préchargement du démarrage, pour qu'elles ne restent pas sur un appareil partagé.
*/
export default function EnregistrerServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const enregistrer = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") enregistrer();
    else window.addEventListener("load", enregistrer, { once: true });

    const { data } = supabase.auth.onAuthStateChange((evenement) => {
      if (evenement === "SIGNED_OUT") {
        viderPrechargement();
        navigator.serviceWorker.controller?.postMessage({ type: "VIDER_DONNEES" });
      }
    });
    return () => data?.subscription?.unsubscribe();
  }, []);
  return null;
}
