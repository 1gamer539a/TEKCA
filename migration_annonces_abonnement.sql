-- À exécuter dans le SQL Editor de Supabase, AVANT de déployer.
-- Annonces IMMOBILIER et VÉHICULE : contact uniquement (pas de paiement TEKÇA).
-- Règles imposées par la base (le formulaire ne suffit pas : les produits sont
-- enregistrés directement depuis le téléphone) :
--   1. publier exige un abonnement payant actif ET une identité vérifiée ;
--   2. l'annonce n'est visible du public que tant que l'abonnement est actif.

-- ÉTAPE 1 — Aperçu (lecture seule) : annonces existantes qui disparaîtront
-- tant que leur vendeur n'a pas d'abonnement actif.
select p.id, p.nom, p.type, v.user_id
from produits p join vendeurs v on v.id = p.vendeur_id
where p.type in ('immobilier','vehicule')
  and not exists (select 1 from abonnements_utilisateur a where a.user_id = v.user_id and a.statut = 'actif' and a.date_fin >= now());

-- ÉTAPE 2 — Fonction « ce vendeur a-t-il un abonnement payant actif ? »
create or replace function public.vendeur_a_abonnement_payant(p_vendeur_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from vendeurs v join abonnements_utilisateur a on a.user_id = v.user_id
    where v.id = p_vendeur_id and a.statut = 'actif' and a.date_fin >= now()
  );
$$;

-- ÉTAPE 3 — Contrôle à la publication
create or replace function public.exiger_conditions_annonces()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_identite boolean;
begin
  if new.type in ('immobilier','vehicule') then
    if not public.vendeur_a_abonnement_payant(new.vendeur_id) then
      raise exception 'Un abonnement payant est nécessaire pour publier une annonce immobilier ou véhicule.';
    end if;
    select u.piece_identite_verifiee into v_identite
      from vendeurs v join users u on u.id = v.user_id where v.id = new.vendeur_id;
    if coalesce(v_identite, false) = false then
      raise exception 'La vérification d''identité est obligatoire pour publier une annonce immobilier ou véhicule.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_exiger_conditions_annonces on produits;
create trigger trg_exiger_conditions_annonces
before insert or update of type on produits
for each row execute function public.exiger_conditions_annonces();

-- ÉTAPE 4 — Visibilité publique : une annonce immobilier / véhicule disparaît
-- quand l'abonnement expire (le vendeur la voit toujours dans son tableau de bord).
drop policy if exists "produits_select_public_valides" on produits;
create policy "produits_select_public_valides"
on produits for select to public
using (
  statut_validation = 'valide'
  and (type not in ('immobilier','vehicule') or public.vendeur_a_abonnement_payant(vendeur_id))
);
