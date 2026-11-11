import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurAdmin } from "../../../../lib/auth-serveur";
import { notifier } from "../../../../lib/notifications";
import { reponseErreurServeur } from "../../../../lib/erreurs";
import { refuserDoublon } from "../../../../lib/anti-doublon";

/*
  Suppression d'un produit par l'admin (vol, contrefaçon, arnaque…), sans passer par la base.

  Règles :
  - Réservé à l'admin principal et aux membres de l'équipe ayant la permission « catalogue ».
  - Un MOTIF est OBLIGATOIRE (5 à 200 caractères) : il est transmis au vendeur par notification.
  - Chaque suppression est inscrite dans le journal `journal_suppressions_produits` (qui, quand,
    quoi, pourquoi). L'inscription se fait AVANT la suppression : si le journal est inaccessible,
    on refuse de supprimer plutôt que de laisser une suppression sans trace.
  - Produit jamais commandé : suppression définitive. Produit déjà commandé (clé étrangère) : on ne
    peut pas l'effacer sans casser l'historique des commandes, il est RETIRÉ de la vente (statut
    « refuse », invisible sur Le Marché) et le journal l'indique (« retire »).
*/
const MOTIF_MIN = 5;
const MOTIF_MAX = 200;

export async function POST(req) {
  try {
    const admin = await utilisateurAdmin(req, "catalogue");
    if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
    const doublon = await refuserDoublon(req, admin, { fenetre: 8 });
    if (doublon) return doublon;

    const { produitId, motif } = await req.json();
    if (!produitId) return NextResponse.json({ error: "Produit requis." }, { status: 400 });
    const raison = String(motif || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
    if (raison.length < MOTIF_MIN) {
      return NextResponse.json({ error: `Le motif de suppression est obligatoire (au moins ${MOTIF_MIN} caractères) : il sera transmis au vendeur.` }, { status: 400 });
    }
    if (raison.length > MOTIF_MAX) {
      return NextResponse.json({ error: `Motif trop long (${MOTIF_MAX} caractères maximum).` }, { status: 400 });
    }

    const { data: produit, error: erreurLecture } = await supabaseAdmin
      .from("produits")
      .select("id, nom, vendeur_id, vendeurs ( user_id, nom_boutique )")
      .eq("id", produitId)
      .maybeSingle();
    if (erreurLecture) throw erreurLecture;
    if (!produit) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });

    // Qui supprime : on garde aussi son nom tel qu'il est aujourd'hui (il pourrait changer plus tard).
    const { data: profilAdmin } = await supabaseAdmin.from("users").select("nom, email").eq("id", admin.id).maybeSingle();

    // 1) Journal d'abord (sans trace, pas de suppression).
    const { data: ligneJournal, error: erreurJournal } = await supabaseAdmin
      .from("journal_suppressions_produits")
      .insert({
        produit_id: produit.id,
        produit_nom: produit.nom,
        vendeur_id: produit.vendeur_id,
        vendeur_user_id: produit.vendeurs?.user_id || null,
        nom_boutique: produit.vendeurs?.nom_boutique || null,
        supprime_par: admin.id,
        supprime_par_nom: profilAdmin?.nom || profilAdmin?.email || null,
        motif: raison,
        resultat: "supprime",
      })
      .select("id")
      .single();
    if (erreurJournal || !ligneJournal) {
      console.error("journal_suppressions_produits :", erreurJournal);
      return NextResponse.json({ error: "Suppression annulée : le journal n'est pas disponible (migration SQL non exécutée ?). Rien n'a été supprimé." }, { status: 503 });
    }

    // 2) Suppression, ou retrait de la vente si le produit a un historique de commandes.
    let resultat = "supprime";
    const { error: erreurSuppression } = await supabaseAdmin.from("produits").delete().eq("id", produitId);
    if (erreurSuppression) {
      if (erreurSuppression.code === "23503") {
        const { error: erreurRetrait } = await supabaseAdmin.from("produits").update({ statut_validation: "refuse" }).eq("id", produitId);
        if (erreurRetrait) {
          await supabaseAdmin.from("journal_suppressions_produits").delete().eq("id", ligneJournal.id);
          throw erreurRetrait;
        }
        resultat = "retire";
        await supabaseAdmin.from("journal_suppressions_produits").update({ resultat }).eq("id", ligneJournal.id);
      } else {
        await supabaseAdmin.from("journal_suppressions_produits").delete().eq("id", ligneJournal.id);
        throw erreurSuppression;
      }
    }

    // 3) Le vendeur est prévenu, avec le motif.
    if (produit.vendeurs?.user_id) {
      await notifier(supabaseAdmin, {
        user_id: produit.vendeurs.user_id,
        type: "message",
        texte: `Ton produit « ${produit.nom} » a été retiré de la plateforme par l'équipe TEKÇA. Motif : ${raison}`,
      });
    }

    return NextResponse.json({ ok: true, resultat });
  } catch (e) {
    return reponseErreurServeur(e, "app/api/admin/produit-supprimer");
  }
}
