-- 0066 — Sûreté de publication (audit 2026-06-10, P1-4) : un draft = un post.
-- Le couple approve (read-then-insert) sans contrainte permettait deux posts
-- pour le même draft sur double-clic concurrent. Vérifié avant pose : aucun
-- doublon en base (select draft_id ... group by ... having count(*)>1 → 0).
-- L'index simple est remplacé par l'index unique (qui sert aussi le lookup).

CREATE UNIQUE INDEX IF NOT EXISTS "content_post_draft_unique" ON "content_post" ("draft_id");

DROP INDEX IF EXISTS "content_post_draft_idx";
