-- ============================================================
-- RÉPARATION — comptes avec users.role = 'vendeur' sans ligne
-- correspondante dans `vendeurs` (ou l'inverse)
-- ------------------------------------------------------------
-- Cause : DevenirVendeur.jsx mettait à jour users.role AVANT de
-- créer la ligne vendeurs (et, pour un revendeur officiel, avant
-- les 3 uploads de fichiers). La moindre erreur en cours de route
-- laissait le compte "marqué vendeur" sans profil derrière —
-- corrigé dans le code (l'ordre est maintenant inversé), mais les
-- comptes déjà touchés avant ce correctif restent à réparer une
-- fois manuellement, d'où ce script.
-- ============================================================

-- 1. DIAGNOSTIC — à lancer d'abord pour voir qui est concerné.
-- Cas A : role="vendeur" mais aucune ligne vendeurs (le vrai bug).
select u.id, u.nom, u.email, u.role
from users u
left join vendeurs v on v.user_id = u.id
where u.role = 'vendeur' and v.id is null;

-- Cas B (plus rare, direction inverse) : ligne vendeurs "valide"
-- existante mais role jamais synchronisé.
select u.id, u.nom, u.email, u.role, v.statut
from users u
join vendeurs v on v.user_id = u.id
where u.role <> 'vendeur' and v.statut in ('valide');

-- 2. RÉPARATION — décommente et exécute une fois le diagnostic
-- vérifié (protection volontaire : ce script ne s'exécute pas tout
-- seul par copier-coller du fichier entier).

-- Cas A : remet ces comptes en "client" (aucun profil vendeur réel
-- derrière) — ils devront repasser par /vendre pour de vrai.
-- update users set role = 'client'
-- where role = 'vendeur'
--   and id not in (select user_id from vendeurs);

-- Cas B : synchronise le rôle vers "vendeur" pour les profils
-- réellement validés.
-- update users set role = 'vendeur'
-- where id in (select user_id from vendeurs where statut = 'valide')
--   and role <> 'vendeur';
