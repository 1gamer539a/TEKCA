-- ============================================================
-- CORRECTIF INSCRIPTION — « Impossible de créer le compte avec ces informations »
-- À coller et exécuter UNE FOIS dans Supabase SQL Editor. Ne supprime aucune donnée.
-- ------------------------------------------------------------
-- CAUSE : le formulaire envoyait un téléphone VIDE ("") quand la personne n'en saisissait pas, et la
-- table users impose un téléphone UNIQUE. Le 1er inscrit sans téléphone passait ; le 2e (et tous les
-- suivants) était refusé par la base ("Database error saving new user"), et le site affichait seulement
-- « Impossible de créer le compte avec ces informations », même avec des informations justes.
--
-- CORRECTIFS :
--  1) un téléphone vide est enregistré comme ABSENT (NULL) : autant de comptes sans téléphone que voulu ;
--  2) si un téléphone est déjà pris par un autre compte, le compte est créé quand même, sans téléphone,
--     au lieu d'échouer ;
--  3) les téléphones vides déjà enregistrés sont remis à NULL (pour que les futurs essais passent).
-- ============================================================

create or replace function public.gerer_nouvel_utilisateur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nom text := coalesce(nullif(btrim(new.raw_user_meta_data->>'nom'), ''), split_part(new.email, '@', 1));
  v_tel text := nullif(btrim(coalesce(new.raw_user_meta_data->>'telephone', '')), '');
begin
  begin
    insert into public.users (id, nom, email, telephone, role)
    values (new.id, v_nom, new.email, v_tel, 'client')
    on conflict (id) do nothing;
  exception when unique_violation then
    -- Téléphone déjà utilisé par un autre compte : on crée le profil sans téléphone.
    insert into public.users (id, nom, email, telephone, role)
    values (new.id, v_nom, new.email, null, 'client')
    on conflict (id) do nothing;
  end;
  return new;
end;
$$;

-- (le déclencheur on_auth_user_created existe déjà et appelle cette fonction)

update public.users set telephone = null where telephone is not null and btrim(telephone) = '';

-- DIAGNOSTIC (facultatif) — comptes de connexion sans profil, à vérifier si l'inscription échoue encore :
--   select a.id, a.email from auth.users a left join public.users u on u.id = a.id where u.id is null;
