-- ============================================================
-- COFFRE-FORT NUMÉRIQUE — stock de codes pour les produits
-- digitaux (recharges de jeu, abonnements, ebooks, templates)
-- ------------------------------------------------------------
-- Principe : contrairement aux produits physiques (protégés par le
-- séquestre TEKÇA, fonds débloqués après confirmation de réception),
-- un produit digital est livré INSTANTANÉMENT après paiement — un
-- code pré-enregistré par le vendeur est attribué à la commande et
-- le vendeur est crédité immédiatement (pas de séquestre, pas
-- d'attente).
--
-- À exécuter après schema.sql, rls_policies.sql, auth_setup.sql et
-- fix_wallet_atomique.sql (réutilise crediter_wallet_atomique).
-- ============================================================

-- Nouveaux types de produits digitaux — recharge_jeu et
-- abonnement_service existaient déjà, on ajoute ebook et template.
-- ALTER TYPE ... ADD VALUE ne peut pas être utilisé dans la même
-- transaction qu'un INSERT référençant la nouvelle valeur : ce
-- script ne fait qu'ajouter les valeurs, aucune donnée n'est insérée
-- avec, donc pas de souci d'exécution en une seule fois.
alter type type_produit add value if not exists 'ebook';
alter type type_produit add value if not exists 'template';

-- Marque les produits publiés via le coffre-fort numérique (livraison
-- automatique par code, pas de séquestre). Séparé du champ `type`
-- pour ne pas casser les recharges de jeu existantes, créées avant
-- cette fonctionnalité et toujours livrées manuellement par le
-- vendeur via la messagerie — elles gardent via_coffre_fort = false
-- et continuent de fonctionner comme avant.
alter table produits add column if not exists via_coffre_fort boolean not null default false;

create type statut_code_coffre_fort as enum ('disponible', 'vendu');

create table if not exists codes_coffre_fort (
  id uuid primary key default gen_random_uuid(),
  produit_id uuid not null references produits(id) on delete cascade,
  code text not null,
  statut statut_code_coffre_fort not null default 'disponible',
  commande_id uuid references commandes(id),
  date_creation timestamptz not null default now(),
  date_vente timestamptz,
  unique (produit_id, code)
);

create index if not exists idx_codes_coffre_fort_produit_statut on codes_coffre_fort(produit_id, statut);
create index if not exists idx_codes_coffre_fort_commande on codes_coffre_fort(commande_id);

alter table codes_coffre_fort enable row level security;

-- Le vendeur voit et gère uniquement le stock de ses propres
-- produits (ajout unitaire, import en masse, historique) — jamais le
-- stock d'un autre vendeur.
create policy "Le vendeur gère le stock de ses propres produits"
on codes_coffre_fort for all
to authenticated
using (
  produit_id in (
    select p.id from produits p
    join vendeurs v on v.id = p.vendeur_id
    where v.user_id = auth.uid()
  )
)
with check (
  produit_id in (
    select p.id from produits p
    join vendeurs v on v.id = p.vendeur_id
    where v.user_id = auth.uid()
  )
);
-- Volontairement AUCUNE policy pour l'acheteur : un code acheté ne
-- doit jamais être lisible via une requête Supabase classique côté
-- client, seulement via la route serveur dédiée
-- (/api/achats-numeriques), qui vérifie le PIN avant de le renvoyer —
-- même logique que codes_livraison.sql pour le séquestre physique.

-- ------------------------------------------------------------
-- Réclame atomiquement UN code disponible pour un produit et le
-- marque vendu, lié à la commande. SKIP LOCKED évite que deux
-- achats simultanés sur le même produit ne se disputent le même
-- code (chacun saute les lignes déjà verrouillées par l'autre).
-- Retourne le code, ou aucune ligne si le stock est épuisé (le
-- code appelant doit alors annuler la commande).
-- ------------------------------------------------------------
-- Catégories pour les deux nouveaux types digitaux — même mécanique
-- que les catégories existantes (taux_commission n'est plus utilisé
-- pour la commission vendeur depuis le passage aux paliers
-- d'abonnement, voir lib/commission.js, mais la colonne reste
-- obligatoire sur cette table).
insert into categories_taxes (nom_categorie, taux_commission, montant_abonnement)
values ('ebook', 5, 0), ('template', 5, 0)
on conflict (nom_categorie) do nothing;

create or replace function reclamer_code_coffre_fort(p_produit_id uuid, p_commande_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  v_code_id uuid;
  v_code text;
begin
  select id, code into v_code_id, v_code
  from codes_coffre_fort
  where produit_id = p_produit_id and statut = 'disponible'
  order by date_creation asc
  for update skip locked
  limit 1;

  if v_code_id is null then
    return null; -- stock épuisé
  end if;

  update codes_coffre_fort
  set statut = 'vendu', commande_id = p_commande_id, date_vente = now()
  where id = v_code_id;

  return v_code;
end;
$$;
