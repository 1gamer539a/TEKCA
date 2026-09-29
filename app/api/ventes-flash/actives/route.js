import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { palierActif } from "../../../../lib/commission";

const AVANCE_PREMIUM_HEURES = 12;

/*
  Ne filtre jamais via RLS (la ligne ventes_flash est publique en
  lecture — voir abonnements_v2_cashback_flash.sql) : la règle
  "visible 12h avant seulement pour Premium" dépend à la fois de
  l'heure ET du palier de la personne qui demande, donc calculée ici,
  pas dans une policy.
*/
export async function GET(req) {
  try {
    const maintenant = new Date();

    let estPremium = false;
    const user = await utilisateurConnecte(req);
    if (user) {
      const palier = await palierActif(user.id);
      estPremium = palier === "premium";
    }

    const { data: ventes } = await supabaseAdmin
      .from("ventes_flash")
      .select("id, produit_id, prix_flash, date_debut_public, date_fin, produits(nom, prix_base, images)")
      .gt("date_fin", maintenant.toISOString())
      .order("date_debut_public", { ascending: true });

    const visibles = (ventes || []).filter((vente) => {
      const debutPublic = new Date(vente.date_debut_public);
      if (maintenant >= debutPublic) return true;
      if (estPremium) {
        const debutAnticipe = new Date(debutPublic.getTime() - AVANCE_PREMIUM_HEURES * 3600 * 1000);
        return maintenant >= debutAnticipe;
      }
      return false;
    });

    return NextResponse.json({ ventes: visibles });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur inconnue" }, { status: 500 });
  }
}
