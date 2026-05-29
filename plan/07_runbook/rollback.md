# Rollback — Stratégie de retour arrière par phase

> Principe : chaque bascule risquée est derrière un **flag**, chaque migration est **réversible**, le fallback est le **mode MOCK**.
> Réflexe d'urgence : `SOCIAL_PUBLISHING_MODE=dry-run` (coupe la publication réelle) + désactiver le scheduler.

## Désactivation scheduler (immédiat, toutes phases)
```bash
# self-hosted /api/cron/tick (ACT-BE-021) : cesser de poller
pm2 stop femiglow-cron     # ou retirer le cron externe qui frappe /api/cron/tick
```
Effet : aucune nouvelle publication programmée ; idempotence (BE-022) garantit zéro double-post au redémarrage.

## Flags de bascule
| Flag | Défaut sûr | Rollback |
|---|---|---|
| `SOCIAL_PUBLISHING_MODE` | `dry-run` (mock) | repasser `dry-run` → Postiz réel coupé |
| `ENGINE_BRIDGE` (invokeEngine B→A, ARC-003) | `off` | `off` → B garde son chemin natif |
| `ENGINE_A_CAPABILITIES` (bascule ARC-010) | incrémental | retirer la capacité basculée → B reprend la main |

## Migrations réversibles
- Chaque migration Drizzle a un `down`. Rollback : `pnpm --filter web db:migrate:down`.
- Tables sensibles (`content_post`, `social_publish_job`, `audit_events`, `generation_run`) : `down` testé avant `up` en prod.

## Par phase
- **P0** : revert commit (config-only) ; restaurer ancien comportement test. Aucune donnée touchée.
- **P1** : si double-post/mauvais état → scheduler stop + `SOCIAL_PUBLISHING_MODE=dry-run` ; idempotence (BE-022) + sync (DA-004) empêchent l'incohérence ; migration `down` si besoin.
- **P2** : `ENGINE_BRIDGE=off` → texte repasse par chemin natif ; badges Live re-figés via revert UX.
- **P3** : revert robustesse ; `dry_run` reste honnête (fallback mock) ; sélection compte redevient optionnelle si bug bloquant.
- **P4** : compose réel derrière capability ; rollback = revenir aux assets stub + `MEDIA_DIR` précédent ; isolation tmpdir évite pollution prod.
- **P5** : `ENGINE_A_CAPABILITIES` retire capacité par capacité → B reprend ; duplication B conservée jusqu'à smoke G5 stable, supprimée seulement après fenêtre d'observation.

## Fallback mock (filet ultime)
Tous providers (OpenAI, Higgsfield, Postiz, voix/musique) ont un adapter mock. En cas d'incident provider live : forcer le mode mock du domaine concerné, le pipeline reste fonctionnel et vérifiable.
