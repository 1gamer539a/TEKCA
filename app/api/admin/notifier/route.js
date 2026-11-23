import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurAdmin } from "../../../../lib/auth-serveur";
import { notifierPlusieurs } from "../../../../lib/notifications";
import { reponseErreurServeur } from "../../../../lib/erreurs";
import { refuserDoublon } from "../../../../lib/anti-doublon";

/*
  Onglet « Notifications » de l'admin : écrire à un utilisateur précis,
  à tous les vendeurs, ou à tout le monde (notification in-app + push
  système pour ceux qui l'ont activé, via lib/notifications.js).

  Actions (champ `action`) :
  - "chercher"   : recherche d'utilisateurs (nom, email, téléphone)
  - "historique" : derniers envois
  - "envoyer"    : envoi (cible = "utilisateur" | "vendeurs" | "tous")
  Passe par le serveur (service_role) pour qu'un membre « Marketing »
  puisse écrire à un utilisateur sans avoir accès à la liste complète.
*/
const TITRE_MAX = 100;
const MESSAGE_MAX = 500;

// ex. jean.dupont@gmail.com → j***@gmail.com ; +242 06 123 45 67 → ••••••••• 67
const masquerEmail = (e) => {
  if (!e || !e.includes("@")) return null;
  const [local, domaine] = e.split("@");
  return `${local.slice(0, 1)}***@${domaine}`;
};
const masquerTelephone = (t) => {
  const chiffres = String(t || "").replace(/\D/g, "");
  return chiffres.length >= 4 ? `••••••${chiffres.slice(-2)}` : null;
};

export async function POST(req) {
  try {
    const admin = await utilisateurAdmin(req, "marketing");
    if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

    const corps = await req.json();
    const action = corps.action || "envoyer";

    if (action === "chercher") {
      const q = String(corps.q || "").trim().replace(/[^\p{L}\p{N}@+._\- ]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
      if (q.length < 2) return NextResponse.json({ utilisateurs: [] });
      // Un membre « marketing » n'a pas accès à la liste des utilisateurs : il peut retrouver quelqu'un
      // PAR SON NOM seulement, et ne voit que ses coordonnées masquées. Seuls l'admin principal et les
      // membres ayant la permission « utilisateurs » cherchent par email / téléphone et voient tout.
      const voitTout = admin.estSuperAdmin || (admin.permissions || []).includes("utilisateurs");
      const filtre = voitTout
        ? `nom.ilike.%${q}%,email.ilike.%${q}%,telephone.ilike.%${q}%`
        : `nom.ilike.%${q}%`;
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("id, nom, email, telephone, role")
        .or(filtre)
        .limit(8);
      if (error) throw error;
      const utilisateurs = (data || []).map((u) =>
        voitTout ? u : { ...u, email: masquerEmail(u.email), telephone: masquerTelephone(u.telephone) }
      );
      return NextResponse.json({ utilisateurs });
    }

    if (action === "historique") {
      const { data, error } = await supabaseAdmin
        .from("campagnes_notification")
        .select("id, titre, message, date_envoi")
        .eq("canal", "push")
        .order("date_envoi", { ascending: false })
        .limit(20);
      if (error) throw error;
      return NextResponse.json({ campagnes: data || [] });
    }

    // --- envoi
    const doublon = await refuserDoublon(req, admin, { fenetre: 30 });
    if (doublon) return doublon;

    const titre = String(corps.titre || "").trim();
    const message = String(corps.message || "").trim();
    const cible = corps.cible;
    if (!titre || !message) return NextResponse.json({ error: "Titre et message requis." }, { status: 400 });
    if (titre.length > TITRE_MAX) return NextResponse.json({ error: `Titre trop long (${TITRE_MAX} caractères maximum).` }, { status: 400 });
    if (message.length > MESSAGE_MAX) return NextResponse.json({ error: `Message trop long (${MESSAGE_MAX} caractères maximum).` }, { status: 400 });
    if (!["utilisateur", "vendeurs", "tous"].includes(cible)) {
      return NextResponse.json({ error: "Destinataire invalide." }, { status: 400 });
    }

    let ids = [];
    let etiquette = "Tous";
    if (cible === "utilisateur") {
      if (!corps.userId) return NextResponse.json({ error: "Choisis un utilisateur." }, { status: 400 });
      const { data: u, error } = await supabaseAdmin.from("users").select("id, nom").eq("id", corps.userId).maybeSingle();
      if (error) throw error;
      if (!u) return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
      ids = [u.id];
      etiquette = `À ${u.nom || "un utilisateur"}`;
    } else if (cible === "vendeurs") {
      const { data, error } = await supabaseAdmin.from("vendeurs").select("user_id").eq("statut", "valide");
      if (error) throw error;
      ids = [...new Set((data || []).map((v) => v.user_id).filter(Boolean))];
      etiquette = "Vendeurs";
    } else {
      const { data, error } = await supabaseAdmin.from("users").select("id");
      if (error) throw error;
      ids = (data || []).map((u) => u.id);
    }

    if (ids.length === 0) return NextResponse.json({ error: "Aucun destinataire." }, { status: 400 });

    const { error: erreurCampagne } = await supabaseAdmin
      .from("campagnes_notification")
      .insert({ titre: `[${etiquette}] ${titre}`, message, canal: "push", envoye_par: admin.id });
    if (erreurCampagne) throw erreurCampagne;

    const lignes = ids.map((id) => ({ user_id: id, type: "message", texte: `${titre} — ${message}` }));
    const { error: erreurNotifs } = await notifierPlusieurs(supabaseAdmin, lignes);
    if (erreurNotifs) throw erreurNotifs;

    return NextResponse.json({ ok: true, destinataires: ids.length });
  } catch (e) {
    return reponseErreurServeur(e, "app/api/admin/notifier");
  }
}
