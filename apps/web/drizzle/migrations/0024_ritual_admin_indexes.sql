-- Migration 0024 — Index admin pour filtres avancés
-- Cf. docs/reviews-wall/execution/19-plan-action-ameliorations.md § P1.3 + P4.2
--
-- Ces index sont conçus pour les requêtes filtrées par (status, source) et
-- pour le surfaçage des auto-flags dans la queue admin. À 5 000+ rituels,
-- ils font passer les listes filtrées de O(n) à O(log n).

CREATE INDEX IF NOT EXISTS idx_rt_status_source_created
  ON ritual_testimonials (status, source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rt_autoflags_gin
  ON ritual_testimonials USING gin (auto_flags);

CREATE INDEX IF NOT EXISTS idx_ral_actor_created
  ON ritual_audit_log (actor_id, created_at DESC);
