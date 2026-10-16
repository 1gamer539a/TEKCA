import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurAdmin } from "../../../../lib/auth-serveur";
import { controlerPin } from "../../../../lib/pin-serveur";
import { reponseErreurServeur } from "../../../../lib/erreurs";

/*
  Interrupteur de MAINTENANCE (arrêt d'urgence de TEKÇA).
  GET → état actuel. PUT { actif, message, pin } → active / désactive.
  Réservé à l'équipe (admin / equipe), PIN revérifié côté serveur.
*/
export async function GET(req) {
  try {
    const admin = await utilisateurAdmin(req);
    if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    const { data } = await supabaseAdmin.from("etat_systeme").select("maintenance, message, active_depuis, active_par").eq("id", 1).maybeSingle();
    let activePar = null;
    if (data?.active_par) {
      const { data: u } = await supabaseAdmin.from("users").select("nom").eq("id", data.active_par).maybeSingle();
      activePar = u?.nom || null;
    }
    return NextResponse.json({ actif: !!data?.maintenance, message: data?.message || "", activeDepuis: data?.active_depuis || null, activePar });
  } catch (e) {
    return reponseErreurServeur(e, "api/admin/maintenance");
  }
}

export async function PUT(req) {
  try {
    const admin = await utilisateurAdmin(req);
    if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    const { actif, message, pin } = await req.json();
    if (typeof actif !== "boolean") return NextResponse.json({ error: "Valeur invalide." }, { status: 400 });

    const verifPin = await controlerPin(admin.id, pin);
    if (!verifPin.ok) return NextResponse.json({ error: verifPin.error, tentativesRestantes: verifPin.tentativesRestantes }, { status: verifPin.status });

    const maintenant = new Date().toISOString();
    const { error } = await supabaseAdmin.from("etat_systeme").upsert(
      {
        id: 1,
        maintenance: actif,
        message: actif ? String(message || "").trim().slice(0, 300) || null : null,
        active_depuis: actif ? maintenant : null,
        active_par: actif ? admin.id : null,
        date_maj: maintenant,
      },
      { onConflict: "id" }
    );
    if (error) throw error;

    try {
      await supabaseAdmin.from("journal_securite").insert({ user_id: admin.id, type: "admin_maintenance", details: `maintenance=${actif}` });
    } catch (e) {
      console.error("Journal admin_maintenance non enregistré :", e);
    }
    return NextResponse.json({ succes: true, actif });
  } catch (e) {
    return reponseErreurServeur(e, "api/admin/maintenance");
  }
}
