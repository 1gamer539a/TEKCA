import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurAdmin } from "../../../../lib/auth-serveur";

const STATUTS_VALIDES = ["en_attente", "valide", "suspendu", "refuse"];

/*
  Remplace l'ancien appel direct depuis SalleSurveillance.jsx :
  supabase.from("vendeurs").update({ statut: nouveauStatut })...
  `statut` est protégé par trigger (rls_policies.sql) — un vendeur ne
  peut jamais se valider lui-même, seule cette route (service_role,
  après vérification du rôle admin/équipe) peut le faire.
*/
export async function POST(req) {
  try {
    const admin = await utilisateurAdmin(req);
    if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

    const { vendeurId, nouveauStatut } = await req.json();
    if (!vendeurId || !nouveauStatut) {
      return NextResponse.json({ error: "vendeurId et nouveauStatut requis." }, { status: 400 });
    }
    if (!STATUTS_VALIDES.includes(nouveauStatut)) {
      return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
    }

    const misAJour = { statut: nouveauStatut };
    if (nouveauStatut === "valide") misAJour.date_validation = new Date().toISOString();

    const { data: vendeur, error } = await supabaseAdmin
      .from("vendeurs")
      .update(misAJour)
      .eq("id", vendeurId)
      .select("user_id, nom_boutique")
      .single();
    if (error) throw error;

    if (vendeur?.user_id) {
      const messages = {
        valide: `Ta boutique "${vendeur.nom_boutique}" a été validée. Tu peux commencer à vendre.`,
        refuse: `Ta demande pour la boutique "${vendeur.nom_boutique}" a été refusée. Contacte le support pour plus de détails.`,
        suspendu: `Ta boutique "${vendeur.nom_boutique}" a été suspendue. Contacte le support pour plus de détails.`,
        en_attente: `Ta boutique "${vendeur.nom_boutique}" est repassée en attente de validation.`,
      };
      await supabaseAdmin.from("notifications").insert({
        user_id: vendeur.user_id,
        type: "message",
        texte: messages[nouveauStatut] || `Statut de ta boutique mis à jour : ${nouveauStatut}.`,
      });
    }

    return NextResponse.json({ succes: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur inconnue" }, { status: 500 });
  }
}
