import { NextResponse } from "next/server";
import supabaseAdmin from "../../../../lib/supabaseAdmin";
import { utilisateurSuperAdmin } from "../../../../lib/auth-serveur";
import { controlerPin } from "../../../../lib/pin-serveur";
import { reponseErreurServeur } from "../../../../lib/erreurs";
import { POSTES, permissionsValides } from "../../../../lib/permissions";
import { refuserDoublon } from "../../../../lib/anti-doublon";

/*
  Gestion de l'équipe — RÉSERVÉ À L'ADMIN PRINCIPAL (role = 'admin', et
  email = ADMIN_PRINCIPAL_EMAIL si cette variable est définie).

  GET     → liste des membres 'equipe' et de leurs domaines.
  POST    { email, permissions[], poste?, pin } → ajoute ou modifie un membre.
  DELETE  { userId, pin } → retire le rôle (le compte redevient client/vendeur).

  Garde-fous : le PIN de l'admin est revérifié pour toute modification ;
  on ne peut jamais toucher à un compte 'admin' (impossible de créer ou
  de rétrograder un admin depuis cette route — c'est volontairement un
  geste manuel en base) ; chaque changement est écrit dans journal_securite.
*/

async function journaliser(type, adminId, cibleId, details) {
  try {
    await supabaseAdmin.from("journal_securite").insert({ user_id: adminId, type, details: `cible=${cibleId};${details}` });
  } catch (e) {
    console.error("Journal équipe non enregistré :", e);
  }
}

export async function GET(req) {
  try {
    const admin = await utilisateurSuperAdmin(req);
    if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

    const { data: membres, error } = await supabaseAdmin
      .from("users")
      .select("id, nom, email, date_creation")
      .eq("role", "equipe")
      .order("date_creation", { ascending: false });
    if (error) throw error;

    const ids = (membres || []).map((m) => m.id);
    const { data: lignes } = ids.length
      ? await supabaseAdmin.from("equipe_permissions").select("user_id, poste, permissions").in("user_id", ids)
      : { data: [] };
    const parId = Object.fromEntries((lignes || []).map((l) => [l.user_id, l]));

    return NextResponse.json({
      membres: (membres || []).map((m) => ({
        id: m.id,
        nom: m.nom,
        email: m.email,
        poste: parId[m.id]?.poste || null,
        permissions: parId[m.id]?.permissions || [],
      })),
    });
  } catch (e) {
    return reponseErreurServeur(e, "app/api/admin/equipe GET");
  }
}

export async function POST(req) {
  try {
    const admin = await utilisateurSuperAdmin(req);
    if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    const doublon = await refuserDoublon(req, admin, { fenetre: 8 });
    if (doublon) return doublon;

    const { email, permissions, poste, pin } = await req.json();
    const emailNettoye = String(email || "").trim().toLowerCase();
    if (!emailNettoye || emailNettoye.length > 254 || !emailNettoye.includes("@")) {
      return NextResponse.json({ error: "Email invalide." }, { status: 400 });
    }
    if (!permissionsValides(permissions) || permissions.length === 0) {
      return NextResponse.json({ error: "Choisis au moins un domaine valide." }, { status: 400 });
    }
    const posteNettoye = Object.prototype.hasOwnProperty.call(POSTES, poste) ? poste : "personnalise";

    const verifPin = await controlerPin(admin.id, pin);
    if (!verifPin.ok) return NextResponse.json({ error: verifPin.error, tentativesRestantes: verifPin.tentativesRestantes }, { status: verifPin.status });

    // Échappe % _ \ : ilike sert ici à ignorer la casse, pas à chercher par motif.
    const motif = emailNettoye.replace(/[\\%_]/g, "\\$&");
    const { data: cible } = await supabaseAdmin
      .from("users")
      .select("id, nom, email, role")
      .ilike("email", motif)
      .maybeSingle();
    if (!cible) {
      return NextResponse.json({ error: "Aucun compte TEKÇA avec cet email. La personne doit d'abord créer son compte." }, { status: 404 });
    }
    if (cible.role === "admin") {
      return NextResponse.json({ error: "Ce compte est administrateur : son rôle ne se modifie pas ici." }, { status: 400 });
    }

    if (cible.role !== "equipe") {
      const { error: erreurRole } = await supabaseAdmin.from("users").update({ role: "equipe" }).eq("id", cible.id);
      if (erreurRole) throw erreurRole;
    }
    const { error } = await supabaseAdmin.from("equipe_permissions").upsert(
      {
        user_id: cible.id,
        poste: posteNettoye,
        permissions: [...new Set(permissions)],
        attribue_par: admin.id,
        date_maj: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) throw error;

    await journaliser("equipe_attribution", admin.id, cible.id, `poste=${posteNettoye};permissions=${[...new Set(permissions)].join(",")}`);
    return NextResponse.json({ succes: true, membre: { id: cible.id, nom: cible.nom, email: cible.email } });
  } catch (e) {
    return reponseErreurServeur(e, "app/api/admin/equipe POST");
  }
}

export async function DELETE(req) {
  try {
    const admin = await utilisateurSuperAdmin(req);
    if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    const doublon = await refuserDoublon(req, admin, { fenetre: 8 });
    if (doublon) return doublon;

    const { userId, pin } = await req.json();
    if (!userId) return NextResponse.json({ error: "userId requis." }, { status: 400 });

    const verifPin = await controlerPin(admin.id, pin);
    if (!verifPin.ok) return NextResponse.json({ error: verifPin.error, tentativesRestantes: verifPin.tentativesRestantes }, { status: verifPin.status });

    const { data: cible } = await supabaseAdmin.from("users").select("id, role").eq("id", userId).maybeSingle();
    if (!cible) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
    if (cible.role !== "equipe") {
      return NextResponse.json({ error: "Ce compte n'est pas membre de l'équipe." }, { status: 400 });
    }

    // Retire d'abord les droits, puis le rôle : en cas d'échec au milieu,
    // le compte reste sans aucun domaine (donc sans accès).
    const { error: erreurPerm } = await supabaseAdmin.from("equipe_permissions").delete().eq("user_id", userId);
    if (erreurPerm) throw erreurPerm;

    const { data: boutique } = await supabaseAdmin
      .from("vendeurs")
      .select("id")
      .eq("user_id", userId)
      .eq("statut", "valide")
      .limit(1);
    const roleApres = boutique?.length ? "vendeur" : "client";
    const { error: erreurRole } = await supabaseAdmin.from("users").update({ role: roleApres }).eq("id", userId);
    if (erreurRole) throw erreurRole;

    await journaliser("equipe_revocation", admin.id, userId, `role_apres=${roleApres}`);
    return NextResponse.json({ succes: true });
  } catch (e) {
    return reponseErreurServeur(e, "app/api/admin/equipe DELETE");
  }
}
