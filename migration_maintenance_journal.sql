-- À exécuter SEUL (une seule commande), dans le SQL Editor de Supabase.
-- Permet de tracer qui active ou désactive le mode maintenance.
alter type type_evenement_securite add value if not exists 'admin_maintenance';
