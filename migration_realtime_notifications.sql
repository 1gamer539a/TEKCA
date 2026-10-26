-- ============================================================
-- MIGRATION — active le temps réel sur `notifications`
-- ------------------------------------------------------------
-- Même besoin que migration_realtime.sql (messages_chat,
-- messages_support) : NotificationsTempsReel.jsx s'abonne en
-- temps réel à `notifications`, mais sans cette étape, Supabase
-- n'envoie jamais ces événements (table pas dans la publication
-- "supabase_realtime").
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;
