-- ============================================================
-- ACCÈS ADMIN PAR EMAIL + CODE (remplace la connexion classique)
-- ------------------------------------------------------------
-- Le lien vers la Salle de Surveillance ne demande plus une vraie
-- connexion Supabase (email/mot de passe ou Google) : on saisit
-- directement un email déjà marqué admin/équipe en base + un code
-- partagé (ADMIN_CODE, variable d'environnement Vercel). En cas de
-- succès, un jeton aléatoire est stocké ici et posé en cookie —
-- le middleware vérifie ensuite ce jeton à chaque page /admin/*.
-- ============================================================
create table if not exists admin_acces_sessions (
  token text primary key,
  email text not null,
  expire_a timestamptz not null,
  date_creation timestamptz not null default now()
);

create index if not exists idx_admin_acces_expire on admin_acces_sessions(expire_a);

-- RLS : personne ne doit pouvoir lire/écrire cette table directement
-- depuis le client — uniquement via le service role côté serveur
-- (route API + middleware, qui utilisent tous les deux la clé
-- service_role, jamais exposée au navigateur).
alter table admin_acces_sessions enable row level security;
