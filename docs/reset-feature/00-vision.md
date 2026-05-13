# 00 — Vision & exigences

## Problème

L'application accumule de la donnée dérive (variantes produit obsolètes, médias orphelins,
migrations désynchronisées, seeds partiels). Aucune procédure documentée ne permet de
revenir à un état canonique propre. Le bug identifié (variante `FEMI-KIT-30` à 249 dh
qui survit malgré le seed à 199 dh) est symptomatique.

## Vision

Un **bouton rouge contrôlé** : depuis `/admin/settings/reset`, l'admin peut en quelques
clics ramener l'environnement à un état déterministe, avec garanties de sécurité.

## Exigences fonctionnelles

### EF-1 — Quatre niveaux de reset
- `soft` : re-run des 16 seeders en upsert (pas de destructif)
- `medium` : TRUNCATE des tables catalogue + CMS + SEO, puis seed
- `hard` : DROP SCHEMA + migrate from-scratch + wipe média + seed
- `custom` : sélection domaine par domaine (commerce / content / chat / tracking)

### EF-2 — Préservation sélective
- L'admin peut cocher : préserver `orders`, `leads`, `chat_lead`, `ritual_testimonials`,
  `admin_users`, `audit_events`.
- En mode `hard`, la table `admin_users` est *toujours* préservée (sauf flag explicite
  `--nuke-admins` réservé au CLI).

### EF-3 — Backup automatique
- Avant toute action destructive, dump SQL + tar média dans `/var/backups/femiglow/<ISO-ts>/`.
- Le backup est validé (taille > seuil, manifest JSON) avant de passer en phase destructive.

### EF-4 — Rollback
- Sur échec à partir de la phase « wipe », auto-restore depuis le backup pris en phase 2.
- Restore manuel : `pnpm reset restore --backup-id=<id>`.

### EF-5 — Wizard UI
- 7 étapes : Welcome → Mode → Custom-options → Preservation → Preview → Confirm → Execute.
- Progress live via SSE (réutilise pattern seeders).
- Étape Report finale avec liens vers backup, audit log, pages de vérification.

### EF-6 — CLI exécutable
- `pnpm --filter @femiglow/web reset -- --mode=hard --confirm=RESET`.
- Modes : `--dry-run`, `--non-interactive`, `--restore --backup-id=<id>`.

### EF-7 — Audit complet
- Une entrée `audit_events` par phase (action = `reset.<phase>`).
- Audit du payload (mode, options, durée, stats, success/failure).

## Exigences non-fonctionnelles

### ENF-1 — Robustesse
- Aucun crash silencieux : toute exception capturée, classée, et reportée à l'UI/CLI.
- Phases découplées : l'échec d'une phase non critique ne stoppe pas le reset
  (cf. `10-error-taxonomy.md`).

### ENF-2 — Sécurité
- Auth admin obligatoire (session cookie iron-sealed, déjà existant).
- Confirmation typée (« RESET » ou « HARD RESET » selon mode) côté UI ET CLI.
- Rate-limit : 1 reset toutes les 5 minutes max par admin.
- Lock global : un seul reset à la fois (réutilise `job-store` hasRunningJob check).

### ENF-3 — Observabilité
- Logs JSON structurés (level, phase, step, ts, durationMs, payload).
- SSE event stream pour UI (réutilise pattern seeders).
- Métriques exposées : `reset.duration.<phase>`, `reset.success`, `reset.failure`.

### ENF-4 — Performance
- Hard reset complet doit terminer en < 90 s sur le serveur actuel.
- Backup ne doit pas excéder 30 s (DB ~50 MB + média ~700 MB compressé).

### ENF-5 — Maintenabilité
- Chaque phase = un module pur testable isolément.
- Pas de dépendance circulaire avec seeders (réutilisation par composition).
- Documentation à jour (ce dossier).

### ENF-6 — Testabilité
- Coverage unitaire ≥ 80 % sur `lib/reset/`.
- Tests Jest pour orchestrator + chaque phase.
- Tests MSW pour les hooks UI.
- Test Playwright e2e du wizard complet (dry-run en CI).

### ENF-7 — Ergonomie
- Wizard avec progression visuelle, ETA temps réel.
- Confirmation typée : oblige à recopier le mode (pas juste cocher une case).
- Récap d'impact AVANT confirmation : compte les lignes qui vont être supprimées.
- Cancel disponible jusqu'à la phase Wipe (au-delà, on rollback automatique).

## Non-objectifs (out of scope V1)

- **Reset multi-tenant** : un seul env à la fois.
- **Backup distant (S3)** : reste local, manifest documenté pour upload manuel.
- **Reset partiel temporel** (« remets-moi l'état d'il y a 3 jours ») : nécessite versioning DB, hors scope.
- **Reset sélectif par produit** : seed-level, pas reset-level.

## Critères d'acceptation

1. Soft reset corrige le bug FEMI-KIT-30 (variante stale supprimée).
2. Hard reset depuis DB vide ramène l'app à un /kit fonctionnel avec image + prix 199 dh en < 90 s.
3. Une coupure de courant simulée pendant la phase Wipe déclenche un rollback auto au prochain démarrage.
4. Aucun appel non-autorisé à `/api/admin/reset/*` ne renvoie autre chose que 401/403.
5. Le wizard est utilisable au clavier seul (a11y).
6. Tests verts en CI (Jest + Playwright dry-run).
