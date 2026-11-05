-- À exécuter dans Supabase (SQL Editor), EN 3 ÉTAPES, dans cet ordre.
-- But : un produit ne peut plus avoir une livraison incohérente avec sa
-- catégorie (ex. recharge en « livraison à domicile », ou accessoire en
-- « instantané »). immobilier et vehicule ne sont volontairement pas touchés.

-- ÉTAPE 1 — Aperçu (lecture seule) des produits existants incohérents :
select id, type, modes_remise
from produits
where (type in ('recharge_jeu','abonnement_service','ebook','template')
        and not (modes_remise <@ array['instantane']::text[]))
   or (type in ('accessoire','vetement','mode_beaute','jouet_enfant','console_gaming','high_tech','meuble_deco')
        and not (modes_remise <@ array['domicile','main_propre']::text[]));

-- ÉTAPE 2 — Mise en conformité des produits existants :
update produits set modes_remise = array['instantane']::text[]
where type in ('recharge_jeu','abonnement_service','ebook','template')
  and modes_remise is distinct from array['instantane']::text[];

update produits set modes_remise = array_remove(modes_remise, 'instantane')
where type in ('accessoire','vetement','mode_beaute','jouet_enfant','console_gaming','high_tech','meuble_deco')
  and 'instantane' = any(modes_remise);

-- ÉTAPE 3 — Règle appliquée par la base (refuse toute nouvelle incohérence) :
alter table produits drop constraint if exists produits_modes_remise_coherents;
alter table produits add constraint produits_modes_remise_coherents check (
  case
    when type in ('recharge_jeu','abonnement_service','ebook','template')
      then modes_remise <@ array['instantane']::text[]
    when type in ('accessoire','vetement','mode_beaute','jouet_enfant','console_gaming','high_tech','meuble_deco')
      then modes_remise <@ array['domicile','main_propre']::text[]
    else true
  end
);
