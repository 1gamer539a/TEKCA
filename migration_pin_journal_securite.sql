-- ============================================================
-- MIGRATION — à exécuter dans Supabase SQL Editor
-- ============================================================
-- CORRECTIF — le code de /api/securite/pin/verifier insère un
-- événement de type 'pin_echoue' à chaque code PIN incorrect, pour
-- que la limitation anti brute-force (5 échecs / 15 min) puisse les
-- compter. Mais l'enum type_evenement_securite (schema.sql) ne
-- contenait que 'connexion_echouee', 'pin_reinitialise' et
-- 'connexion_suspecte' — donc CET INSERT ÉCHOUAIT SILENCIEUSEMENT à
-- chaque mauvais code PIN (l'erreur n'était pas vérifiée dans le
-- code), et le compteur d'échecs restait bloqué à zéro pour
-- toujours : la protection anti brute-force sur le PIN n'a jamais
-- réellement fonctionné.
--
-- Ajoute aussi 'pin_modifie', utilisé par la nouvelle route
-- /api/securite/pin/modifier (changement de PIN) pour tracer les
-- changements réussis.
--
-- ALTER TYPE ... ADD VALUE ne peut pas être annulé dans la même
-- transaction sur Postgres < 12, donc à exécuter tel quel, une
-- instruction à la fois si l'éditeur SQL de Supabase le demande.

alter type type_evenement_securite add value if not exists 'pin_echoue';
alter type type_evenement_securite add value if not exists 'pin_modifie';
