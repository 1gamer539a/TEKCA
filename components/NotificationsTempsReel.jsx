"use client";

import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

/*
  Système global de notifications "vivantes" :
  - Demande la permission de notification du navigateur une fois.
  - Écoute en temps réel (Supabase Realtime) les nouveaux messages
    de chat ET les nouvelles notifications in-app pour l'utilisateur
    connecté, joue un son, et affiche une notification navigateur si
    l'onglet n'est pas au premier plan et que la permission est
    accordée.

  Sécurité : l'abonnement realtime à messages_chat ne filtre rien
  côté serveur, mais Supabase Realtime respecte les policies RLS
  (voir "messages_select_participant_ou_admin" dans rls_policies.sql)
  — chaque utilisateur ne reçoit donc que les messages des
  conversations dont il fait partie, jamais ceux des autres.

  Monté une seule fois dans LayoutRacine.jsx.
*/
export default function NotificationsTempsReel() {
  const audioCtxRef = useRef(null);

  const jouerSon = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1175, ctx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Certains navigateurs bloquent l'audio avant une interaction
      // utilisateur — on ignore silencieusement plutôt que de casser
      // l'app pour un simple son manqué.
    }
  };

  const notifierNavigateur = (titre, corps) => {
    if (document.visibilityState === "visible") return; // déjà en train de regarder l'app
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    new Notification(titre, { body: corps, icon: "/icon.png" });
  };

  useEffect(() => {
    let userId = null;
    let canaux = [];

    const demarrer = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;

      // Demande la permission une seule fois — ne re-sollicite jamais
      // si l'utilisateur a déjà répondu (accepté ou refusé).
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission();
      }

      const canalMessages = supabase
        .channel("messages-temps-reel-global")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages_chat" },
          (payload) => {
            if (payload.new.expediteur_id === userId) return; // mes propres messages
            jouerSon();
            notifierNavigateur("Nouveau message — TEKÇA", payload.new.contenu?.slice(0, 120) || "Tu as reçu un message.");
          }
        )
        .subscribe();

      const canalNotifs = supabase
        .channel("notifications-temps-reel-global")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          (payload) => {
            jouerSon();
            notifierNavigateur(payload.new.type === "commande" ? "Commande — TEKÇA" : "TEKÇA", payload.new.texte);
          }
        )
        .subscribe();

      canaux = [canalMessages, canalNotifs];
    };

    demarrer();
    return () => { canaux.forEach((c) => supabase.removeChannel(c)); };
  }, []);

  return null;
}
