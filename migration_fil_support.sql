-- ============================================================
-- MIGRATION — à exécuter dans Supabase SQL Editor
-- (fait suite aux migrations précédentes)
-- ============================================================
-- CORRECTIF — une réponse admin à une réclamation (contacts_support)
-- n'était qu'une notification à sens unique : le client ne pouvait
-- pas voir sa réclamation d'origine + la réponse ensemble, ni
-- répondre à son tour. Ce fil dédié fonctionne comme messages_chat
-- (déjà utilisé pour la messagerie acheteur/vendeur), mais pour les
-- échanges avec le support/l'équipe TEKÇA.

create table if not exists messages_support (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts_support(id) on delete cascade,
  expediteur_id uuid not null references users(id),
  contenu text not null,
  date_creation timestamptz not null default now()
);

create index if not exists idx_messages_support_contact on messages_support(contact_id, date_creation);

alter table messages_support enable row level security;

drop policy if exists "messages_support_lecture" on messages_support;
create policy "messages_support_lecture"
on messages_support for select
using (
  exists (
    select 1 from contacts_support cs
    where cs.id = messages_support.contact_id
    and (cs.client_id = auth.uid() or exists (select 1 from users where id = auth.uid() and role in ('admin','equipe')))
  )
);

drop policy if exists "messages_support_ecriture" on messages_support;
create policy "messages_support_ecriture"
on messages_support for insert
with check (
  auth.uid() = expediteur_id
  and exists (
    select 1 from contacts_support cs
    where cs.id = messages_support.contact_id
    and (cs.client_id = auth.uid() or exists (select 1 from users where id = auth.uid() and role in ('admin','equipe')))
  )
);
