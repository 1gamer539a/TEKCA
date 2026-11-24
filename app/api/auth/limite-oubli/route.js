import { NextResponse } from "next/server";
import { limiterDebitIp } from "../../../../lib/anti-doublon";
import supabaseAdmin from "../../../../lib/supabaseAdmin";

/*
  Appelée AVANT l'envoi d'un email « mot de passe oublié » : limite les demandes
  par adresse IP (5 par heure) et par email (3 par heure), pour qu'on ne puisse
  pas inonder la boîte de quelqu'un d'emails ni épuiser l'envoi (Resend).
  Ne révèle jamais si l'email correspond à un compte.
*/
export async function POST(req) {
  try {
    const { email } = await req.json().catch(() => ({}));
    const emailNettoye = String(email || "").trim().toLowerCase();
    if (!emailNettoye || emailNettoye.length > 254 || !emailNettoye.includes("@")) {
      return NextResponse.json({ error: "Email invalide." }, { status: 400 });
    }

    const refusIp = await limiterDebitIp(req, "auth/oubli-ip", 5, 3600);
    if (refusIp) return refusIp;

    // Limite par email, avec la même table que les limites de débit (clé = "email:<adresse>").
    try {
      const { data, error } = await supabaseAdmin.rpc("limiter_requete", {
        p_cle: `email:${emailNettoye}`,
        p_route: "auth/oubli-email",
        p_max: 3,
        p_fenetre_secondes: 3600,
      });
      if (!error && data === false) {
        return NextResponse.json({ error: "Trop de demandes pour cette adresse. Réessaie dans une heure." }, { status: 429 });
      }
    } catch (e) {
      console.error("limite email indisponible :", e);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("limite-oubli :", e);
    return NextResponse.json({ ok: true }); // en cas de panne de la limite, on ne bloque pas la demande
  }
}
