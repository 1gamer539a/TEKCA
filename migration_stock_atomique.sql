-- ============================================================
-- DÉCRÉMENT ATOMIQUE DU STOCK — vêtements (par variante) et
-- accessoires (stock_global)
-- ------------------------------------------------------------
-- Avant ce correctif, le stock existait en base (colonnes
-- variantes_produits.stock et produits.stock_global) et pouvait
-- même être saisi dans le formulaire vendeur, mais n'était JAMAIS
-- vérifié ni décrémenté à l'achat — un produit à 0 en stock restait
-- commandable à l'infini. Même principe que debiter_wallet_atomique
-- (lecture + vérification + écriture dans la même requête SQL,
-- pour éviter que deux achats simultanés passent tous les deux la
-- vérification alors qu'il ne reste qu'un seul exemplaire) :
-- retourne le nouveau stock si l'opération a réussi, NULL si stock
-- insuffisant (ou id introuvable).
-- ============================================================

create or replace function decrementer_stock_variante(p_variante_id uuid, p_quantite int)
returns int
language plpgsql
security definer
as $$
declare
  v_nouveau_stock int;
begin
  update variantes_produits
  set stock = stock - p_quantite
  where id = p_variante_id and stock >= p_quantite
  returning stock into v_nouveau_stock;
  return v_nouveau_stock;
end;
$$;

create or replace function incrementer_stock_variante(p_variante_id uuid, p_quantite int)
returns void
language plpgsql
security definer
as $$
begin
  update variantes_produits set stock = stock + p_quantite where id = p_variante_id;
end;
$$;

create or replace function decrementer_stock_global(p_produit_id uuid, p_quantite int)
returns int
language plpgsql
security definer
as $$
declare
  v_nouveau_stock int;
begin
  update produits
  set stock_global = stock_global - p_quantite
  where id = p_produit_id and stock_global >= p_quantite
  returning stock_global into v_nouveau_stock;
  return v_nouveau_stock;
end;
$$;

create or replace function incrementer_stock_global(p_produit_id uuid, p_quantite int)
returns void
language plpgsql
security definer
as $$
begin
  update produits set stock_global = stock_global + p_quantite where id = p_produit_id;
end;
$$;
