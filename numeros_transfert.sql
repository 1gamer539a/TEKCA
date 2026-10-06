-- ============================================================
-- NUMÉROS DE TRANSFERT (max 3 par utilisateur)
-- À exécuter après schema.sql et rls_policies.sql
-- ============================================================
-- Un utilisateur peut enregistrer jusqu'à 3 numéros sur lesquels il
-- peut recevoir des transferts internes (en plus de son numéro
-- principal `users.telephone`). Le transfert wallet-to-wallet
-- (app/api/wallet/transferer) ne fonctionne QUE vers un numéro
-- reconnu ici ou dans users.telephone — jamais vers un numéro
-- inconnu de la plateforme, puisque le solde n'est qu'une ligne dans
-- notre base (voir la clause CGU sur la nature du wallet) : un
-- transfert vers un numéro non enregistré n'aurait aucun compte
-- destinataire réel où atterrir.
-- ============================================================

create table if not exists numeros_transfert (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  numero text not null unique,
  pays text not null,
  date_ajout timestamptz not null default now()
);

alter table numeros_transfert enable row level security;

create policy "numeros_transfert_gestion_own"
on numeros_transfert for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Limite dure de 3 numéros par utilisateur, imposée en base — pas
-- seulement côté interface, pour qu'un appel direct à Supabase ne
-- puisse pas la contourner.
create or replace function public.limiter_numeros_transfert()
returns trigger
language plpgsql
security definer
as $$
begin
  if (select count(*) from numeros_transfert where user_id = new.user_id) >= 3 then
    raise exception 'Maximum 3 numéros enregistrés par compte.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_limiter_numeros_transfert on numeros_transfert;
create trigger trg_limiter_numeros_transfert
before insert on numeros_transfert
for each row execute function public.limiter_numeros_transfert();

create index if not exists idx_numeros_transfert_user on numeros_transfert(user_id);
