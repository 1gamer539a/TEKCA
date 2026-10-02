-- ============================================================
-- NOUVELLES CATÉGORIES — Immobilier, Véhicules, Meuble & Déco,
-- Jeux & Jouets Enfants, Consoles & Gaming, High-Tech, Mode & Beauté
-- ------------------------------------------------------------
-- L'onglet Catalogue de la Salle de Surveillance lit déjà
-- dynamiquement categories_taxes (voir SalleSurveillance.jsx) : les
-- taux de commission ci-dessous ne sont que des valeurs de départ,
-- ajustables ensuite depuis cet onglet sans toucher au code.
-- ============================================================

-- ALTER TYPE ... ADD VALUE ne peut pas être annulé dans la même
-- transaction que son utilisation : exécute ce fichier seul.
alter type type_produit add value if not exists 'immobilier';
alter type type_produit add value if not exists 'vehicule';
alter type type_produit add value if not exists 'meuble_deco';
alter type type_produit add value if not exists 'jouet_enfant';
alter type type_produit add value if not exists 'console_gaming';
alter type type_produit add value if not exists 'high_tech';
alter type type_produit add value if not exists 'mode_beaute';

insert into categories_taxes (nom_categorie, taux_commission, montant_abonnement) values
  ('immobilier', 7, 0),
  ('vehicule', 7, 0),
  ('meuble_deco', 7, 0),
  ('jouet_enfant', 7, 0),
  ('console_gaming', 7, 0),
  ('high_tech', 7, 0),
  ('mode_beaute', 7, 0)
on conflict (nom_categorie) do nothing;
