-- ============================================================
-- ABONNEMENTS PUSH — stocke l'abonnement Web Push de chaque
-- utilisateur (un par appareil/navigateur où il a activé les
-- notifications), pour permettre l'envoi de vraies notifications
-- système même app fermée/arrière-plan.
-- ============================================================

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

create policy "push_subscriptions_select_own"
on push_subscriptions for select
to authenticated
using (user_id = auth.uid());

create policy "push_subscriptions_insert_own"
on push_subscriptions for insert
to authenticated
with check (user_id = auth.uid());

create policy "push_subscriptions_delete_own"
on push_subscriptions for delete
to authenticated
using (user_id = auth.uid());
