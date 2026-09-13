-- ============================================================
-- MIGRATION — à exécuter dans Supabase SQL Editor
-- (fait suite aux migrations précédentes)
-- ============================================================
-- CORRECTIF — le code s'abonne en temps réel à messages_chat et
-- messages_support (FilDiscussion.jsx, FilSupport.jsx) via
-- supabase.channel(...).on("postgres_changes", ...), mais Supabase
-- n'envoie ces événements QUE pour les tables explicitement ajoutées
-- à la publication "supabase_realtime" — jamais faite pour ces
-- tables. Résultat : un message envoyé était bien écrit en base
-- (visible après un rechargement), mais n'apparaissait jamais tout
-- seul côté destinataire, qui pouvait avoir l'impression qu'il
-- n'était jamais arrivé.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages_chat'
  ) then
    alter publication supabase_realtime add table messages_chat;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages_support'
  ) then
    alter publication supabase_realtime add table messages_support;
  end if;
end $$;
