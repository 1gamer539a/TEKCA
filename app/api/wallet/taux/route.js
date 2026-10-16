import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { deviseDuPays, estFCFA, tauxPour, convertirDepuisFCFA } from "../../../../lib/devises";
import { reponseErreurServeur } from "../../../../lib/erreurs";

/*
  Aperçu de conversion affiché dans le portefeuille avant de valider une
  recharge ou un retrait : GET ?pays=GH&montant=5000&sens=recharge|retrait.
  Ne modifie rien. Le montant réellement envoyé est recalculé côté serveur
  au moment de l'opération (recharger / retirer).
*/
export async function GET(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const devise = deviseDuPays(searchParams.get("pays") || "CG");
    if (estFCFA(devise)) return NextResponse.json({ devise, fcfa: true });

    const taux = await tauxPour(supabaseAdmin, devise);
    if (!taux) return NextResponse.json({ devise, fcfa: false, disponible: false });
    const montant = parseFloat(searchParams.get("montant"));
    if (!montant || montant <= 0 || montant > 100000000) return NextResponse.json({ devise, fcfa: false, disponible: true, montantLocal: null });
    const sens = searchParams.get("sens") === "retrait" ? "retrait" : "recharge";
    return NextResponse.json({ devise, fcfa: false, disponible: true, montantLocal: convertirDepuisFCFA(montant, taux, devise, sens) });
  } catch (e) {
    return reponseErreurServeur(e, "app/api/wallet/taux");
  }
}
