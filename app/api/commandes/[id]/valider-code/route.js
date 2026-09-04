import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../../lib/supabaseAdmin";
import { utilisateurConnecte } from "../../../../../lib/auth-serveur";

const MAX_TENTATIVES = 4;

/*
  Appelée quand le vendeur saisit, en présence de l'acheteur, le code
  à 6 chiffres communiqué par ce dernier à la remise du colis. En cas
  de bon code : débloque le séquestre exactement comme
  confirmer-reception (même montant, même crédit wallet vendeur).
  En cas de mauvais code : incrémente le compteur de tentatives.
  Au 4e échec, le code est bloqué — seul le support (via SalleSurveillance,
  après vérification manuelle) pourra débloquer la situation.
*/
export async function POST(req, { params }) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const commandeId = params.id;
    const { code } = await req.json();
    if (!code) return NextResponse.json({ error: "Code requis." }, { status: 400 });

    const { data: commande } = await supabaseAdmin
      .from("commandes")
      .select("id, client_id, vendeur_id, montant_total, commission_appliquee, statut")
      .eq("id", commandeId)
      .single();
    if (!commande) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });

    const { data: vendeurRow } = await supabaseAdmin
      .from("vendeurs")
      .select("id, user_id, nb_ventes")
      .eq("id", commande.vendeur_id)
      .single();
    if (!vendeurRow || vendeurRow.user_id !== user.id) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
    }

    const { data: codeLivraison } = await supabaseAdmin
      .from("codes_livraison")
      .select("id, code, tentatives, bloque, date_validation")
      .eq("commande_id", commandeId)
      .single();
    if (!codeLivraison) {
      return NextResponse.json({ error: "Pas de code de livraison pour cette commande." }, { status: 404 });
    }
    if (codeLivraison.date_validation) {
      return NextResponse.json({ error: "Cette commande a déjà été confirmée." }, { status: 400 });
    }
    if (codeLivraison.bloque) {
      return NextResponse.json(
        { error: "code_bloque", message: "Trop de tentatives. Contacte le support pour débloquer cette commande." },
        { status: 403 }
      );
    }

    // Mauvais code
    if (String(code).trim() !== codeLivraison.code) {
      const nouvellesTentatives = codeLivraison.tentatives + 1;
      const doitBloquer = nouvellesTentatives >= MAX_TENTATIVES;

      await supabaseAdmin
        .from("codes_livraison")
        .update({ tentatives: nouvellesTentatives, bloque: doitBloquer })
        .eq("id", codeLivraison.id);

      if (doitBloquer) {
        return NextResponse.json(
          { error: "code_bloque", message: "Trop de tentatives. Contacte le support pour débloquer cette commande." },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: "code_incorrect", message: `Code incorrect. Il te reste ${MAX_TENTATIVES - nouvellesTentatives} essai(s).` },
        { status: 400 }
      );
    }

    // Bon code — débloque le séquestre, même logique que confirmer-reception
    const { data: sequestre } = await supabaseAdmin
      .from("sequestres")
      .select("id, montant_produit, statut")
      .eq("commande_id", commandeId)
      .single();
    if (!sequestre || sequestre.statut !== "retenu") {
      return NextResponse.json({ error: "Cette commande a déjà été traitée." }, { status: 400 });
    }

    const montantVendeur = Number(sequestre.montant_produit) - Number(commande.commission_appliquee || 0);

    const { data: walletVendeur } = await supabaseAdmin.from("wallets").select("solde").eq("user_id", vendeurRow.user_id).single();
    const soldeVendeur = Number(walletVendeur?.solde || 0);

    if (walletVendeur) {
      await supabaseAdmin
        .from("wallets")
        .update({ solde: soldeVendeur + montantVendeur, date_maj: new Date().toISOString() })
        .eq("user_id", vendeurRow.user_id);
    } else {
      await supabaseAdmin.from("wallets").insert({ user_id: vendeurRow.user_id, solde: montantVendeur });
    }

    await supabaseAdmin.from("transactions_wallet").insert({
      user_id: vendeurRow.user_id,
      type: "recharge",
      montant: montantVendeur,
      statut: "reussi",
    });

    await supabaseAdmin.from("vendeurs").update({ nb_ventes: (vendeurRow.nb_ventes || 0) + 1 }).eq("id", commande.vendeur_id);

    await supabaseAdmin
      .from("sequestres")
      .update({ statut: "libere_manuel", confirme_par_client: true, date_liberation: new Date().toISOString() })
      .eq("id", sequestre.id);

    await supabaseAdmin.from("commandes").update({ statut: "livre" }).eq("id", commandeId);

    await supabaseAdmin
      .from("codes_livraison")
      .update({ date_validation: new Date().toISOString() })
      .eq("id", codeLivraison.id);

    return NextResponse.json({ succes: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur inconnue" }, { status: 500 });
  }
}
