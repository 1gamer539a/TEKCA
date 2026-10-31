-- À exécuter une fois dans Supabase (SQL Editor).
-- Informations personnelles : pays de résidence, adresse de livraison, photo de profil.

alter table users add column if not exists pays_residence text;
alter table users add column if not exists adresse_livraison text;
alter table users add column if not exists avatar_url text;

-- Bucket des photos de profil : lecture publique (la photo s'affiche dans les
-- échanges acheteur / vendeur), écriture limitée au dossier de l'utilisateur.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_upload_proprietaire" on storage.objects;
create policy "avatars_upload_proprietaire"
on storage.objects for insert
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_maj_proprietaire" on storage.objects;
create policy "avatars_maj_proprietaire"
on storage.objects for update
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_suppression_proprietaire" on storage.objects;
create policy "avatars_suppression_proprietaire"
on storage.objects for delete
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_lecture_publique" on storage.objects;
create policy "avatars_lecture_publique"
on storage.objects for select
using (bucket_id = 'avatars');
