-- ============================================================
-- MIGRATION — à exécuter dans Supabase SQL Editor
-- (fait suite aux migrations précédentes)
-- ============================================================
-- CORRECTIF CRITIQUE — le code fait supabase.storage.from("preuves")
-- et .from("produits") partout (vérification d'identité, preuve
-- d'activité vendeur, photos produit), mais ces buckets n'ont jamais
-- été créés sur le projet Supabase : chaque tentative d'upload
-- échouait avec "404 Bucket not found". Ça explique d'un coup
-- plusieurs bugs signalés (photo produit invisible, échec de la
-- vérification d'identité...).

insert into storage.buckets (id, name, public)
values ('preuves', 'preuves', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('produits', 'produits', true)
on conflict (id) do nothing;

-- Autorise tout utilisateur connecté à uploader dans son propre
-- dossier (chemin commençant par son user id), et tout le monde à
-- lire (bucket public — nécessaire pour que les photos produit
-- s'affichent sur Le Marché sans authentification).
drop policy if exists "preuves_upload_proprietaire" on storage.objects;
create policy "preuves_upload_proprietaire"
on storage.objects for insert
with check (bucket_id = 'preuves' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "preuves_lecture_publique" on storage.objects;
create policy "preuves_lecture_publique"
on storage.objects for select
using (bucket_id = 'preuves');

drop policy if exists "produits_upload_proprietaire" on storage.objects;
create policy "produits_upload_proprietaire"
on storage.objects for insert
with check (bucket_id = 'produits' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "produits_lecture_publique" on storage.objects;
create policy "produits_lecture_publique"
on storage.objects for select
using (bucket_id = 'produits');

-- NOTE SÉCURITÉ — le bucket "preuves" contient des pièces d'identité.
-- Il est mis en "public" ici pour rester compatible avec le code
-- existant (qui utilise getPublicUrl()), mais ça veut dire que
-- n'importe qui devinant l'URL exacte (aléatoire, mais pas
-- impossible) pourrait voir une pièce d'identité. Si tu veux du
-- stockage vraiment privé (URL signées, expirantes), dis-le-moi —
-- c'est un changement plus large côté code (upload ET affichage)
-- qu'on peut faire dans un prochain lot.

-- CORRECTIF — les documents uploadés à l'inscription "Boutique
-- établie" (identité recto/verso, justificatif d'activité) étaient
-- envoyés dans le stockage mais leur URL n'était JAMAIS enregistrée
-- nulle part : une fois uploadés, ils devenaient introuvables, pour
-- l'équipe comme pour le vendeur. Recto/verso séparés (au lieu d'un
-- seul fichier) + champ de justification texte, comme demandé.
alter table vendeurs add column if not exists identite_recto_url text;
alter table vendeurs add column if not exists identite_verso_url text;
alter table vendeurs add column if not exists activite_url text;
alter table vendeurs add column if not exists justification text;
