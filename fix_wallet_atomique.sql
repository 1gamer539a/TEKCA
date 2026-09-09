-- ============================================================
-- CORRECTIF SÉCURITÉ : opérations atomiques sur les wallets
-- ------------------------------------------------------------
-- Problème corrigé : toutes les routes API qui touchaient au solde
-- d'un wallet faisaient "SELECT solde ... puis UPDATE solde = X" en
-- deux requêtes séparées. Deux requêtes simultanées (double-clic,
-- script, ou simple lenteur réseau) pouvaient lire le même solde de
-- départ avant que l'une des deux n'écrive, permettant un retrait ou
-- transfert en double (double-dépense) même si la contrainte
-- `solde >= 0` empêchait un solde final négatif.
--
-- Ces deux fonctions font la lecture ET l'écriture dans la MÊME
-- requête SQL (donc atomique au niveau de la ligne côté Postgres) :
-- plus aucune fenêtre de course possible.
--
-- À exécuter une seule fois dans l'éditeur SQL Supabase.
-- ============================================================

-- Débite un wallet, mais SEULEMENT si le solde est suffisant.
-- Retourne le nouveau solde si l'opération a réussi, ou NULL si le
-- solde était insuffisant (dans ce cas, RIEN n'a été modifié).
create or replace function debiter_wallet_atomique(p_user_id uuid, p_montant numeric)
returns numeric
language plpgsql
security definer
as $$
declare
  v_nouveau_solde numeric;
begin
  update wallets
  set solde = solde - p_montant,
      date_maj = now()
  where user_id = p_user_id
    and solde >= p_montant
  returning solde into v_nouveau_solde;

  return v_nouveau_solde; -- NULL = solde insuffisant, aucune écriture faite
end;
$$;

-- Crédite un wallet (crée la ligne si elle n'existe pas encore).
-- Toujours atomique : deux crédits simultanés s'additionnent
-- correctement au lieu de s'écraser l'un l'autre.
create or replace function crediter_wallet_atomique(p_user_id uuid, p_montant numeric)
returns numeric
language plpgsql
security definer
as $$
declare
  v_nouveau_solde numeric;
begin
  insert into wallets (user_id, solde, date_maj)
  values (p_user_id, p_montant, now())
  on conflict (user_id) do update
    set solde = wallets.solde + excluded.solde,
        date_maj = now()
  returning solde into v_nouveau_solde;

  return v_nouveau_solde;
end;
$$;
