import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurAdmin } from "../../../../lib/auth-serveur";
import { controlerPin } from "../../../../lib/pin-serveur";
import { DEVISE_PAR_PAYS, MARGE_CHANGE, estFCFA } from "../../../../lib/devises";
import { reponseErreurServeur } from "../../../../lib/erreurs";

/*
  Mise à jour MANUELLE des taux de change par l'équipe.
  GET → devises hors FCFA, pays concernés, taux actuel et date.
  PUT → { devise, unitesPour1000Fcfa, pin } : rôle admin/équipe + PIN revérifié.
*/
const DEVISES_HORS_FCFA = [...new Set(Object.values(DEVISE_PAR_PAYS).filter((d) => !estFCFA(d)))];

export async function GET(req) {
  try {
    const admin = await utilisateurAdmin(req);
    if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    const { data } = await supabaseAdmin.from("taux_change").select("devise, unites_pour_1000_fcfa, date_maj");
    const parDevise = Object.fromEntries((data || []).map((r) => [r.devise, r]));
    return NextResponse.json({
      margePourcent: MARGE_CHANGE * 100,
      devises: DEVISES_HORS_FCFA.map((devise) => ({
        devise,
        pays: Object.entries(DEVISE_PAR_PAYS).filter(([, d]) => d === devise).map(([c]) => c),
        taux: parDevise[devise] ? Number(parDevise[devise].unites_pour_1000_fcfa) : null,
        dateMaj: parDevise[devise]?.date_maj || null,
      })),
    });
  } catch (e) {
    return reponseErreurServeur(e, "app/api/admin/taux-change");
  }
}

export async function PUT(req) {
  try {
    const admin = await utilisateurAdmin(req);
    if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    const { devise, unitesPour1000Fcfa, pin } = await req.json();
    const taux = Number(unitesPour1000Fcfa);
    if (!DEVISES_HORS_FCFA.includes(devise)) return NextResponse.json({ error: "Devise inconnue." }, { status: 400 });
    if (!Number.isFinite(taux) || taux <= 0 || taux > 1e9) return NextResponse.json({ error: "Taux invalide." }, { status: 400 });

    const verifPin = await controlerPin(admin.id, pin);
    if (!verifPin.ok) return NextResponse.json({ error: verifPin.error, tentativesRestantes: verifPin.tentativesRestantes }, { status: verifPin.status });

    const { error } = await supabaseAdmin
      .from("taux_change")
      .upsert({ devise, unites_pour_1000_fcfa: taux, date_maj: new Date().toISOString(), maj_par: admin.id }, { onConflict: "devise" });
    if (error) throw error;
    return NextResponse.json({ succes: true });
  } catch (e) {
    return NextResponse.json({ error: "Enregistrement impossible (migration_taux_change.sql exécutée ?)." }, { status: 500 });
  }
}
