import { NextResponse } from "next/server";
import supabaseAdmin from "../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../lib/auth-serveur";

/*
  Renvoie les codes des produits digitaux achetés par le client
  connecté — la SEULE façon d'obtenir le texte d'un code
  (codes_coffre_fort n'a aucune policy RLS pour l'acheteur, voir
  migration_coffre_fort_numerique.sql).

  Le PIN n'est pas re-vérifié ICI (le cookie "tekca_pin_ok" est déjà
  exigé par middleware.js pour toute l'app, une fois par session) :
  c'est le composant AchatsNumeriques.jsx qui redemande volontairement
  le PIN à chaque ouverture de cette page via la modale
  ConfirmationPIN, comme une confirmation explicite avant de révéler
  un code — au même titre qu'avant un paiement.
*/
export async function GET(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { data: commandes, error } = await supabaseAdmin
      .from("commandes")
      .select(`
        id, date_creation,
        produits ( nom, via_coffre_fort ),
        vendeurs ( nom_boutique ),
        codes_coffre_fort ( code )
      `)
      .eq("client_id", user.id)
      .eq("statut", "livre")
      .not("codes_coffre_fort", "is", null)
      .order("date_creation", { ascending: false });
    if (error) throw error;

    const achats = (commandes || [])
      .filter((c) => c.produits?.via_coffre_fort && c.codes_coffre_fort?.length)
      .map((c) => ({
        commandeId: c.id,
        produit: c.produits?.nom,
        boutique: c.vendeurs?.nom_boutique || "Boutique",
        dateAchat: c.date_creation,
        code: c.codes_coffre_fort[0]?.code,
      }));

    return NextResponse.json({ achats });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur serveur." }, { status: 500 });
  }
}
