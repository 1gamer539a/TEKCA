import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";

export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { produitId, prixFlash, dateDebutPublic, dureeHeures } = await req.json();
    if (!produitId || !prixFlash || !dateDebutPublic || !dureeHeures) {
      return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
    }

    const { data: produit } = await supabaseAdmin.from("produits").select("id, vendeur_id, prix_base").eq("id", produitId).single();
    if (!produit) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });

    const { data: vendeurRow } = await supabaseAdmin.from("vendeurs").select("id, user_id").eq("id", produit.vendeur_id).single();
    if (!vendeurRow || vendeurRow.user_id !== user.id) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
    }

    if (Number(prixFlash) >= Number(produit.prix_base)) {
      return NextResponse.json({ error: "Le prix flash doit être inférieur au prix normal du produit." }, { status: 400 });
    }

    const debut = new Date(dateDebutPublic);
    if (isNaN(debut.getTime()) || debut < new Date()) {
      return NextResponse.json({ error: "Date de début invalide (doit être dans le futur)." }, { status: 400 });
    }
    const fin = new Date(debut.getTime() + Number(dureeHeures) * 3600 * 1000);

    const { data: venteFlash, error } = await supabaseAdmin
      .from("ventes_flash")
      .insert({
        produit_id: produitId,
        vendeur_id: vendeurRow.id,
        prix_flash: prixFlash,
        date_debut_public: debut.toISOString(),
        date_fin: fin.toISOString(),
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ succes: true, venteFlash });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur inconnue" }, { status: 500 });
  }
}
