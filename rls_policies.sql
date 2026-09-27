-- ============================================================
-- POLITIQUES RLS — PLATEFORME GAMING
-- À exécuter dans l'éditeur SQL de Supabase, APRÈS schema.sql
-- ============================================================
-- Pourquoi ce fichier existe :
-- La clé "anon" Supabase est publique par construction (elle est dans
-- le bundle JS envoyé au navigateur). Sans RLS, quiconque inspecte le
-- code ou le réseau peut appeler Supabase directement et lire/modifier
-- N'IMPORTE QUELLE ligne de N'IMPORTE QUELLE table — soldes de wallet,
-- statut de vérification d'identité, etc. Les routes serveur (qui
-- utilisent supabaseAdmin / la clé service_role) ne sont PAS
-- concernées par RLS : elles continuent de tout voir, comme avant.
-- ============================================================

-- ------------------------------------------------------------
-- Fonction utilitaire : est-ce un admin/équipe ?
-- SECURITY DEFINER pour éviter la récursion RLS quand cette
-- fonction est appelée depuis une policy sur la table users elle-même.
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role in ('admin', 'equipe')
  );
$$;

-- ------------------------------------------------------------
-- Fonction utilitaire : l'utilisateur connecté est-il le
-- propriétaire (via vendeurs.user_id) d'un vendeur_id donné ?
-- ------------------------------------------------------------
create or replace function public.est_proprietaire_vendeur(v_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.vendeurs
    where id = v_id and user_id = auth.uid()
  );
$$;

-- ============================================================
-- USERS
-- ============================================================
alter table users enable row level security;

create policy "users_select_own_or_admin"
on users for select
to authenticated
using (id = auth.uid() or is_admin());

create policy "users_insert_own"
on users for insert
to authenticated
with check (id = auth.uid());

create policy "users_update_own_or_admin"
on users for update
to authenticated
using (id = auth.uid() or is_admin())
with check (id = auth.uid() or is_admin());

-- Empêche un utilisateur normal de s'auto-attribuer un rôle admin ou
-- de se marquer "identité vérifiée" via une simple requête UPDATE —
-- RLS seule ne fait pas de contrôle par colonne, donc on verrouille
-- ces champs avec un trigger. service_role (routes serveur) n'est PAS
-- affecté par ce trigger que si on ne l'exempte pas explicitement ;
-- ici on l'exempte via auth.role() = 'service_role'.
create or replace function public.proteger_champs_sensibles_users()
returns trigger
language plpgsql
security definer
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Modification du rôle non autorisée.';
  end if;
  if new.piece_identite_verifiee is distinct from old.piece_identite_verifiee then
    raise exception 'Modification de la vérification d''identité non autorisée.';
  end if;
  if new.captcha_verifie is distinct from old.captcha_verifie then
    raise exception 'Modification du statut captcha non autorisée.';
  end if;
  if new.telephone_verifie is distinct from old.telephone_verifie then
    raise exception 'Modification du statut de vérification téléphone non autorisée.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_champs_sensibles_users on users;
create trigger trg_proteger_champs_sensibles_users
before update on users
for each row execute function public.proteger_champs_sensibles_users();

-- ============================================================
-- VENDEURS
-- ============================================================
alter table vendeurs enable row level security;

create policy "vendeurs_select_public_valides"
on vendeurs for select
to public
using (statut = 'valide' and visible_publiquement = true);

create policy "vendeurs_select_own_or_admin"
on vendeurs for select
to authenticated
using (user_id = auth.uid() or is_admin());

create policy "vendeurs_insert_own"
on vendeurs for insert
to authenticated
with check (user_id = auth.uid());

create policy "vendeurs_update_own_or_admin"
on vendeurs for update
to authenticated
using (user_id = auth.uid() or is_admin())
with check (user_id = auth.uid() or is_admin());

-- Le statut de validation (en_attente/valide/suspendu/refuse) ne doit
-- pas pouvoir être auto-attribué par le vendeur — seul service_role
-- (route admin serveur) peut le changer.
create or replace function public.proteger_statut_vendeur()
returns trigger
language plpgsql
security definer
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.statut is distinct from old.statut then
    raise exception 'Modification du statut vendeur non autorisée.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_statut_vendeur on vendeurs;
create trigger trg_proteger_statut_vendeur
before update on vendeurs
for each row execute function public.proteger_statut_vendeur();

-- ============================================================
-- PRODUITS
-- ============================================================
alter table produits enable row level security;

create policy "produits_select_public_valides"
on produits for select
to public
using (statut_validation = 'valide');

create policy "produits_select_own_ou_admin"
on produits for select
to authenticated
using (est_proprietaire_vendeur(vendeur_id) or is_admin());

create policy "produits_insert_own"
on produits for insert
to authenticated
with check (est_proprietaire_vendeur(vendeur_id));

create policy "produits_update_own_ou_admin"
on produits for update
to authenticated
using (est_proprietaire_vendeur(vendeur_id) or is_admin())
with check (est_proprietaire_vendeur(vendeur_id) or is_admin());

create policy "produits_delete_own_ou_admin"
on produits for delete
to authenticated
using (est_proprietaire_vendeur(vendeur_id) or is_admin());

-- Un vendeur ne peut pas se valider lui-même
create or replace function public.proteger_statut_produit()
returns trigger
language plpgsql
security definer
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.statut_validation is distinct from old.statut_validation then
    raise exception 'Modification du statut de validation non autorisée.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_statut_produit on produits;
create trigger trg_proteger_statut_produit
before update on produits
for each row execute function public.proteger_statut_produit();

-- ============================================================
-- VARIANTES PRODUITS
-- ============================================================
alter table variantes_produits enable row level security;

create policy "variantes_select_public"
on variantes_produits for select
to public
using (
  exists (select 1 from produits p where p.id = produit_id and p.statut_validation = 'valide')
);

create policy "variantes_gestion_own_ou_admin"
on variantes_produits for all
to authenticated
using (
  exists (
    select 1 from produits p
    where p.id = produit_id and (est_proprietaire_vendeur(p.vendeur_id) or is_admin())
  )
)
with check (
  exists (
    select 1 from produits p
    where p.id = produit_id and (est_proprietaire_vendeur(p.vendeur_id) or is_admin())
  )
);

-- ============================================================
-- COMMANDES — écriture réservée au serveur (supabaseAdmin),
-- lecture ouverte au client concerné et au vendeur concerné
-- ============================================================
alter table commandes enable row level security;

create policy "commandes_select_client_vendeur_admin"
on commandes for select
to authenticated
using (client_id = auth.uid() or est_proprietaire_vendeur(vendeur_id) or is_admin());

-- Pas de policy insert/update/delete pour "authenticated" : toute
-- création/modification de commande passe par /api/commandes/* côté
-- serveur (service_role), qui contourne RLS. C'est voulu — les
-- montants et statuts ne doivent jamais être écrits depuis le client.

-- ============================================================
-- AVIS
-- ============================================================
alter table avis enable row level security;

create policy "avis_select_public"
on avis for select
to public
using (true);

create policy "avis_insert_own_commande"
on avis for insert
to authenticated
with check (
  client_id = auth.uid()
  and exists (
    select 1 from commandes c
    where c.id = commande_id and c.client_id = auth.uid() and c.statut = 'livre'
  )
);

-- ============================================================
-- CONVERSATIONS & MESSAGES_CHAT
-- ============================================================
alter table conversations enable row level security;

create policy "conversations_select_participant_ou_admin"
on conversations for select
to authenticated
using (client_id = auth.uid() or est_proprietaire_vendeur(vendeur_id) or is_admin());

create policy "conversations_insert_client"
on conversations for insert
to authenticated
with check (client_id = auth.uid());

alter table messages_chat enable row level security;

create policy "messages_select_participant_ou_admin"
on messages_chat for select
to authenticated
using (
  exists (
    select 1 from conversations c
    where c.id = conversation_id
      and (c.client_id = auth.uid() or est_proprietaire_vendeur(c.vendeur_id) or is_admin())
  )
);

create policy "messages_insert_participant"
on messages_chat for insert
to authenticated
with check (
  expediteur_id = auth.uid()
  and exists (
    select 1 from conversations c
    where c.id = conversation_id
      and (c.client_id = auth.uid() or est_proprietaire_vendeur(c.vendeur_id))
  )
);

create policy "messages_update_lu_participant"
on messages_chat for update
to authenticated
using (
  exists (
    select 1 from conversations c
    where c.id = conversation_id
      and (c.client_id = auth.uid() or est_proprietaire_vendeur(c.vendeur_id))
  )
)
with check (
  exists (
    select 1 from conversations c
    where c.id = conversation_id
      and (c.client_id = auth.uid() or est_proprietaire_vendeur(c.vendeur_id))
  )
);

-- ============================================================
-- WALLET GÉNÉRAL — lecture seule pour le propriétaire, AUCUNE
-- écriture depuis le client (même pas pour un admin). Tout passe
-- par les routes serveur (/api/wallet/*) avec service_role.
--
-- ⚠️ Ceci casse volontairement les appels directs actuellement
-- faits par components/SalleSurveillance.jsx (geler/dégeler un
-- wallet, marquer une identité vérifiée) : ces actions doivent être
-- déplacées vers de nouvelles routes serveur admin protégées par
-- is_admin(), sinon elles échoueront après activation de RLS.
-- ============================================================
alter table wallets enable row level security;

create policy "wallets_select_own_ou_admin"
on wallets for select
to authenticated
using (user_id = auth.uid() or is_admin());

-- Pas de policy insert/update/delete pour authenticated → refusé par
-- défaut. Seul service_role peut écrire.

alter table transactions_wallet enable row level security;

create policy "transactions_wallet_select_own_ou_admin"
on transactions_wallet for select
to authenticated
using (user_id = auth.uid() or destinataire_id = auth.uid() or is_admin());

-- Idem : aucune écriture client. Tout passe par les routes serveur.

-- ============================================================
-- WALLETS_RECHARGE & DEPOTS_WALLET (soldes prépayés vendeur)
-- ============================================================
alter table wallets_recharge enable row level security;

create policy "wallets_recharge_select_own_ou_admin"
on wallets_recharge for select
to authenticated
using (est_proprietaire_vendeur(vendeur_id) or is_admin());

-- Écriture réservée au serveur (décrément automatique à la commande,
-- dépôt validé par paiement) → pas de policy authenticated en insert/update.

alter table depots_wallet enable row level security;

create policy "depots_wallet_select_own_ou_admin"
on depots_wallet for select
to authenticated
using (
  exists (
    select 1 from wallets_recharge wr
    where wr.id = wallet_id and (est_proprietaire_vendeur(wr.vendeur_id) or is_admin())
  )
);

-- ============================================================
-- IA — abonnements, générations, logs
-- ============================================================
alter table ia_abonnements enable row level security;

create policy "ia_abonnements_select_own_ou_admin"
on ia_abonnements for select
to authenticated
using (user_id = auth.uid() or is_admin());
-- Écriture (changement de forfait) réservée au serveur.

alter table ia_generations enable row level security;

create policy "ia_generations_select_own_ou_admin"
on ia_generations for select
to authenticated
using (user_id = auth.uid() or is_admin());
-- Insertion faite côté serveur (route /api/ia) pour fiabiliser le
-- comptage de la limite 3/jour — pas de policy insert authenticated.

alter table logs_ia enable row level security;

create policy "logs_ia_admin_only"
on logs_ia for select
to authenticated
using (is_admin());
-- Écrit uniquement par le serveur.

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
alter table notifications enable row level security;

create policy "notifications_select_own"
on notifications for select
to authenticated
using (user_id = auth.uid());

create policy "notifications_update_lu_own"
on notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
-- Insertion faite par le serveur (déclenchée par les événements
-- métier : commande, message, statut produit, wallet gelé...).

-- ============================================================
-- SEQUESTRES — lecture par client/vendeur concernés, écriture serveur
-- ============================================================
alter table sequestres enable row level security;

create policy "sequestres_select_participant_ou_admin"
on sequestres for select
to authenticated
using (
  exists (
    select 1 from commandes c
    where c.id = commande_id
      and (c.client_id = auth.uid() or est_proprietaire_vendeur(c.vendeur_id) or is_admin())
  )
);

-- ============================================================
-- BOOSTS & PROMOTION DE COMPTES
-- ============================================================
alter table boosts enable row level security;

create policy "boosts_select_public"
on boosts for select
to public
using (date_fin > now());

create policy "boosts_select_own_ou_admin"
on boosts for select
to authenticated
using (est_proprietaire_vendeur(vendeur_id) or is_admin());
-- Création via route serveur (paiement du boost vérifié).

alter table comptes_promus enable row level security;

create policy "comptes_promus_select_public_valides"
on comptes_promus for select
to public
using (statut_validation = 'valide');

create policy "comptes_promus_select_own_ou_admin"
on comptes_promus for select
to authenticated
using (user_id = auth.uid() or is_admin());

create policy "comptes_promus_insert_own"
on comptes_promus for insert
to authenticated
with check (user_id = auth.uid());

create policy "comptes_promus_update_own_ou_admin"
on comptes_promus for update
to authenticated
using (user_id = auth.uid() or is_admin())
with check (user_id = auth.uid() or is_admin());

alter table boosts_compte enable row level security;

create policy "boosts_compte_select_public"
on boosts_compte for select
to public
using (date_fin > now());

create policy "boosts_compte_select_own_ou_admin"
on boosts_compte for select
to authenticated
using (
  exists (
    select 1 from comptes_promus cp
    where cp.id = compte_promu_id and (cp.user_id = auth.uid() or is_admin())
  )
);

-- ============================================================
-- FORMATION & PROJETS DE RÉFÉRENCE — lecture publique, écriture admin
-- ============================================================
alter table modules_formation enable row level security;

create policy "modules_formation_select_public"
on modules_formation for select
to public
using (true);

create policy "modules_formation_admin_write"
on modules_formation for all
to authenticated
using (is_admin())
with check (is_admin());

alter table projets_reference enable row level security;

create policy "projets_reference_select_public"
on projets_reference for select
to public
using (true);

create policy "projets_reference_admin_write"
on projets_reference for all
to authenticated
using (is_admin())
with check (is_admin());

-- ============================================================
-- PRODUITS DIGITAUX (marketing digital)
-- ============================================================
alter table produits_digitaux enable row level security;

create policy "produits_digitaux_select_public_valides"
on produits_digitaux for select
to public
using (statut_validation = 'valide');

create policy "produits_digitaux_select_own_ou_admin"
on produits_digitaux for select
to authenticated
using (est_proprietaire_vendeur(vendeur_id) or is_admin());

create policy "produits_digitaux_insert_own"
on produits_digitaux for insert
to authenticated
with check (est_proprietaire_vendeur(vendeur_id));

create policy "produits_digitaux_update_own_ou_admin"
on produits_digitaux for update
to authenticated
using (est_proprietaire_vendeur(vendeur_id) or is_admin())
with check (est_proprietaire_vendeur(vendeur_id) or is_admin());

-- ============================================================
-- TOURNOIS
-- ============================================================
alter table tournois enable row level security;

create policy "tournois_select_public"
on tournois for select
to public
using (true);

create policy "tournois_admin_write"
on tournois for all
to authenticated
using (is_admin())
with check (is_admin());

alter table inscriptions_tournoi enable row level security;

create policy "inscriptions_tournoi_select_own_ou_admin"
on inscriptions_tournoi for select
to authenticated
using (joueur_id = auth.uid() or is_admin());

create policy "inscriptions_tournoi_insert_own"
on inscriptions_tournoi for insert
to authenticated
with check (joueur_id = auth.uid());

alter table resultats_tournoi enable row level security;

create policy "resultats_tournoi_select_public"
on resultats_tournoi for select
to public
using (true);

create policy "resultats_tournoi_admin_write"
on resultats_tournoi for all
to authenticated
using (is_admin())
with check (is_admin());

-- ============================================================
-- FAVORIS
-- ============================================================
alter table favoris enable row level security;

create policy "favoris_gestion_own"
on favoris for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ============================================================
-- CONTACTS SUPPORT (signalements)
-- ============================================================
alter table contacts_support enable row level security;

create policy "contacts_support_select_own_ou_admin"
on contacts_support for select
to authenticated
using (client_id = auth.uid() or is_admin());

create policy "contacts_support_insert_own"
on contacts_support for insert
to authenticated
with check (client_id = auth.uid());

create policy "contacts_support_update_admin"
on contacts_support for update
to authenticated
using (is_admin())
with check (is_admin());

-- ============================================================
-- DEMANDES DE RETRAIT VENDEUR (payouts)
-- ============================================================
alter table demandes_retrait enable row level security;

create policy "demandes_retrait_select_own_ou_admin"
on demandes_retrait for select
to authenticated
using (est_proprietaire_vendeur(vendeur_id) or is_admin());

create policy "demandes_retrait_insert_own"
on demandes_retrait for insert
to authenticated
with check (est_proprietaire_vendeur(vendeur_id));

create policy "demandes_retrait_update_admin"
on demandes_retrait for update
to authenticated
using (is_admin())
with check (is_admin());

-- ============================================================
-- JOURNAL DE SÉCURITÉ — 100% interne, aucun accès client
-- ============================================================
alter table journal_securite enable row level security;

create policy "journal_securite_admin_only"
on journal_securite for select
to authenticated
using (is_admin());
-- Écrit uniquement par le serveur (service_role).

-- ============================================================
-- CONTENU ÉDITORIAL PUBLIC — bannières, FAQ, catégories
-- ============================================================
alter table bannieres_accueil enable row level security;

create policy "bannieres_select_public_actives"
on bannieres_accueil for select
to public
using (active = true);

create policy "bannieres_admin_write"
on bannieres_accueil for all
to authenticated
using (is_admin())
with check (is_admin());

alter table faq enable row level security;

create policy "faq_select_public"
on faq for select
to public
using (true);

create policy "faq_admin_write"
on faq for all
to authenticated
using (is_admin())
with check (is_admin());

alter table categories_taxes enable row level security;

create policy "categories_taxes_select_public"
on categories_taxes for select
to public
using (true);

create policy "categories_taxes_admin_write"
on categories_taxes for all
to authenticated
using (is_admin())
with check (is_admin());

-- ============================================================
-- CODES PROMO — pas de lecture publique de la liste complète
-- (évite le scraping / la fuite de codes non annoncés) ; la
-- validation d'un code au checkout doit passer par une route
-- serveur qui vérifie active/date_expiration/nb_utilisations.
-- ============================================================
alter table codes_promo enable row level security;

create policy "codes_promo_admin_only"
on codes_promo for select
to authenticated
using (is_admin());

create policy "codes_promo_admin_write"
on codes_promo for all
to authenticated
using (is_admin())
with check (is_admin());

-- ============================================================
-- CAMPAGNES NOTIFICATION & AGENTS LIVRAISON — 100% admin
-- ============================================================
alter table campagnes_notification enable row level security;

create policy "campagnes_notification_admin_only"
on campagnes_notification for all
to authenticated
using (is_admin())
with check (is_admin());

alter table agents_livraison enable row level security;

create policy "agents_livraison_admin_only"
on agents_livraison for all
to authenticated
using (is_admin())
with check (is_admin());

-- ============================================================
-- CONTRAINTE MANQUANTE — un solde de wallet ne doit jamais être négatif
-- (filet de sécurité en plus des vérifications applicatives)
-- ============================================================
alter table wallets add constraint wallets_solde_non_negatif check (solde >= 0);
alter table wallets_recharge add constraint wallets_recharge_solde_non_negatif check (solde >= 0);

-- ============================================================
-- À FAIRE CÔTÉ APPLICATIF APRÈS CE SCRIPT :
-- 1. Déplacer les écritures directes de components/SalleSurveillance.jsx
--    (geler/dégeler wallet, marquer identité vérifiée, valider un
--    vendeur/produit) vers de nouvelles routes serveur app/api/admin/*
--    qui utilisent supabaseAdmin + vérifient is_admin() côté serveur.
-- 2. Vérifier que le composant d'inscription (AuthCompte.jsx, non
--    encore branché à Supabase Auth) insère bien la ligne `users`
--    avec id = auth.uid() du compte Supabase Auth créé.
-- ============================================================
