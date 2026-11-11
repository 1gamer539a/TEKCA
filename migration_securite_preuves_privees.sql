-- ============================================================
-- SÉCURITÉ — bucket "preuves" PRIVÉ (pièces d'identité, justificatifs)
-- À exécuter UNE FOIS dans Supabase SQL Editor, APRÈS
-- migration_roles_equipe.sql.
-- ------------------------------------------------------------
-- PROBLÈME : le bucket "preuves" était PUBLIC et lisible par tout le
-- monde (policy "preuves_lecture_publique"). Toute personne obtenant
-- l'URL d'une pièce d'identité pouvait l'ouvrir, sans être connectée.
--
-- CORRECTION :
--   * le bucket passe en privé ;
--   * lecture autorisée uniquement au propriétaire du fichier (son
--     dossier = son user id) et aux membres d'équipe des domaines
--     concernés (kyc, catalogue pour les preuves d'achat, support) ;
--   * l'interface (Salle de surveillance) ouvre les documents via des
--     URLs signées de 5 minutes (components/ApercuPreuve.jsx).
-- Les URLs déjà enregistrées en base restent utilisables : le code en
-- extrait le chemin du fichier.
--
-- Le bucket "produits" (photos de produits) reste public : c'est voulu,
-- ces images s'affichent sur le Marché sans connexion.
-- ============================================================

update storage.buckets set public = false where id = 'preuves';

drop policy if exists "preuves_lecture_publique" on storage.objects;
drop policy if exists "preuves_lecture_proprietaire_ou_equipe" on storage.objects;
create policy "preuves_lecture_proprietaire_ou_equipe"
on storage.objects for select
to authenticated
using (
  bucket_id = 'preuves'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.a_une_permission(array['kyc', 'catalogue', 'support'])
  )
);

-- Vérification : doit renvoyer public = false
--   select id, public from storage.buckets where id = 'preuves';

-- ============================================================
-- NETTOYAGE — ancien accès admin "email + code partagé"
-- ------------------------------------------------------------
-- Cette table (fix_admin_acces.sql) n'est plus utilisée nulle part dans le
-- code. La laisser en base, c'est laisser la possibilité d'un jeton d'accès
-- admin oublié. On la supprime. (Sans effet si elle n'existe pas.)
-- ============================================================
drop table if exists public.admin_acces_sessions;
