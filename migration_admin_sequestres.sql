-- À exécuter une fois dans Supabase (SQL Editor) pour tracer les actions
-- manuelles de l'équipe sur les séquestres (libération / remboursement).
-- Sans elle, les actions fonctionnent mais ne sont pas journalisées.
alter type type_evenement_securite add value if not exists 'admin_sequestre';
