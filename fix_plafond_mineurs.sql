-- ============================================================
-- PLAFOND WALLET POUR LES 14-16 ANS (50 000 FCFA max en solde)
-- ------------------------------------------------------------
-- Remplace crediter_wallet_atomique (voir fix_wallet_atomique.sql)
-- par une version qui vérifie l'âge avant de créditer. Placé ICI,
-- au niveau de la fonction de crédit elle-même plutôt que dans une
-- seule route API, cette règle s'applique automatiquement à TOUTE
-- source de crédit du wallet : recharge Mobile Money, transfert reçu
-- d'un autre utilisateur, cashback, paiement vendeur — sans avoir à
-- dupliquer la vérification dans chaque route.
-- ============================================================
create or replace function crediter_wallet_atomique(p_user_id uuid, p_montant numeric)
returns numeric
language plpgsql
security definer
as $$
declare
  v_nouveau_solde numeric;
  v_solde_actuel numeric;
  v_date_naissance date;
  v_age integer;
  v_plafond constant numeric := 50000;
begin
  select date_naissance into v_date_naissance from users where id = p_user_id;

  if v_date_naissance is not null then
    v_age := extract(year from age(current_date, v_date_naissance));
    if v_age between 14 and 16 then
      select solde into v_solde_actuel from wallets where user_id = p_user_id;
      if coalesce(v_solde_actuel, 0) + p_montant > v_plafond then
        raise exception 'plafond_mineur_depasse' using errcode = 'P0001';
      end if;
    end if;
  end if;

  insert into wallets (user_id, solde, date_maj)
  values (p_user_id, p_montant, now())
  on conflict (user_id) do update
    set solde = wallets.solde + excluded.solde,
        date_maj = now()
  returning solde into v_nouveau_solde;

  return v_nouveau_solde;
end;
$$;
