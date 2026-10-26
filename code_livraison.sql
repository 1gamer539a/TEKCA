-- ============================================================
-- CODE DE CONFIRMATION DE LIVRAISON (produits physiques)
-- À exécuter après schema.sql, rls_policies.sql et auth_setup.sql
-- ============================================================
-- Principe : à la création d'une commande de produit physique
-- (vêtement/accessoire), un code à 6 chiffres est généré et réservé
-- à l'acheteur. Au moment de la remise en main propre, l'acheteur
-- communique ce code au vendeur, qui le saisit dans son tableau de
-- bord pour confirmer la livraison et débloquer le séquestre.
--
-- Le code vit dans sa PROPRE table, sans aucune policy RLS de
-- lecture/écriture pour "authenticated" — volontairement. Même la
-- table `sequestres` (que le vendeur peut lire) n'expose jamais ce
-- code : seules les deux routes serveur dédiées
-- (/api/commandes/[id]/code-livraison pour l'acheteur,
-- /api/commandes/[id]/valider-code pour le vendeur) y accèdent, via
-- service_role. Si le code était lisible directement par le vendeur
-- via une requête Supabase classique, tout l'intérêt de la
-- vérification en main propre disparaîtrait.
-- ============================================================

create table if not exists codes_livraison (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null unique references commandes(id) on delete cascade,
  code text not null,
  tentatives int not null default 0,
  bloque boolean not null default false,
  date_creation timestamptz not null default now(),
  date_validation timestamptz
);

alter table codes_livraison enable row level security;
-- Aucune policy pour "authenticated" ou "public" = accès refusé par
-- défaut pour tout le monde sauf service_role (nos routes API).

create index if not exists idx_codes_livraison_commande on codes_livraison(commande_id);
