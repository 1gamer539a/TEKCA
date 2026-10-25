import { NextResponse } from "next/server";
import { utilisateurConnecte } from "../../../../lib/auth-serveur";
import { resoudreDestinataire } from "../../../../lib/resoudre-destinataire";
import { tauxFraisTransfert } from "../../../../lib/commission";
import { reponseErreurServeur } from "../../../../lib/erreurs";
import { limiterDebit } from "../../../../lib/anti-doublon";

/*
  Étape de confirmation avant transfert : renvoie le pseudo du
  destinataire ET le taux de frais applicable (selon le palier de
  l'expéditeur) pour affichage ("Envoyer 5 000 FCFA + 250 FCFA de
  frais à @jean ?") AVANT que l'utilisateur ne confirme réellement
  l'envoi. Ne débite ni ne crédite personne — lecture seule.
*/
export async function POST(req) {
  try {
    const user = await utilisateurConnecte(req);
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    const tropDeRequetes = await limiterDebit(user, "wallet/verifier-destinataire", 20, 600);
    if (tropDeRequetes) return tropDeRequetes;

    const { identifiant } = await req.json();
    if (!identifiant) return NextResponse.json({ error: "Identifiant requis." }, { status: 400 });

    const destinataire = await resoudreDestinataire(identifiant);
    if (!destinataire) {
      return NextResponse.json({ error: "Aucun compte TEKÇA n'a cet identifiant." }, { status: 404 });
    }
    if (destinataire.id === user.id) {
      return NextResponse.json({ error: "Tu ne peux pas te transférer à toi-même." }, { status: 400 });
    }

    const tauxFrais = await tauxFraisTransfert(user.id);

    return NextResponse.json({ pseudo: destinataire.pseudo, tauxFrais });
  } catch (e) {
    return reponseErreurServeur(e, "app/api/wallet/verifier-destinataire");
  }
}
