import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurAdmin } from "../../../../lib/auth-serveur";

/*
  Remplace les deux anciens appels directs depuis SalleSurveillance.jsx :
  supabase.from("wallets").update({ is_frozen: true/false, ... })...
  Avec RLS active (rls_policies.sql), plus aucune écriture sur `wallets`
  n'est autorisée depuis le client, même pour un admin — donc cette
  route, protégée par utilisateurAdmin(), est désormais le seul moyen
  de geler/dégeler un portefeuille.
*/
export async function POST(req) {
  try {
    const admin = await utilisateurAdmin(req);
    if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

    const { userId, geler, raison } = await req.json();
    if (!userId || typeof geler !== "boolean") {
      return NextResponse.json({ error: "userId et geler (booléen) requis." }, { status: 400 });
    }

    const { data: walletExistant } = await supabaseAdmin
      .from("wallets")
      .select("user_id")
      .eq("user_id", userId)
      .single();

    const champs = {
      is_frozen: geler,
      freeze_reason: geler ? raison || "Gelé manuellement par l'équipe" : null,
      date_maj: new Date().toISOString(),
    };

    if (walletExistant) {
      const { error } = await supabaseAdmin.from("wallets").update(champs).eq("user_id", userId);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from("wallets").insert({ user_id: userId, solde: 0, ...champs });
      if (error) throw error;
    }

    if (geler) {
      await supabaseAdmin.from("notifications").insert({
        user_id: userId,
        type: "message",
        texte: "Ton portefeuille a été temporairement gelé par l'équipe. Contacte le support pour plus d'infos.",
      });
    }

    return NextResponse.json({ succes: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur inconnue" }, { status: 500 });
  }
}
