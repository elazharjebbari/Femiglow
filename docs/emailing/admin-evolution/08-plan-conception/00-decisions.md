# Décisions de conception

> Synthèse des décisions structurantes (ADRs étendus). Pour les ADRs
> formels (avec statut, alternatives), voir
> [00-architecture/05-adr.md](../00-architecture/05-adr.md).

## Décisions stratégiques

| # | Décision | Raison |
|---|---|---|
| 1 | Audiences natives FemiGlow (pas Listmonk) | Listmonk ignore les données comportementales FemiGlow |
| 2 | Snapshot statique par défaut au moment de l'envoi | Reproductibilité, audit, RGPD |
| 3 | Step-list typée V1 (pas canvas) | ROI plus rapide, canvas en V2 si validé |
| 4 | Table `user_event` unifiée | 1 source pour audiences ET automations |
| 5 | Cmd-K palette comme outil principal | Power user UX, scaling avec volume |
| 6 | Listmonk reste moteur de delivery | Pas refondre la stack qui marche |

## Décisions tactiques

### Frontend
- **Pas de Redux/Zustand global** en V1 — URL + React Query + local state
- **RSC + components clients** — pattern Next.js standard
- **Optimistic updates** sur toggles et saves rapides
- **Pas de drag-drop V1** — sauf pour ordering steps (V2)

### Backend
- **Server actions préférés** pour mutations admin (vs API routes)
- **Validation Zod** aux frontières (clients ET serveur, schemas partagés)
- **Audit log automatique** via wrapper `withAudit()`
- **Pas de feature flags** — tout en main, on revert si problème

### Data
- **jsonb pour les schémas évolutifs** (rules, steps, properties)
- **Versionning des schémas** via champ `version` quand pertinent
- **Soft delete partout** (`deletedAt`) + cron purge J+90
- **Indexes ciblés** sur queries chaudes (pas "au cas où")

### Tests
- **Jest + RTL** pour unit + components (existant)
- **MSW** pour integration HTTP (mockable côté serveur ET client)
- **fake-drizzle** pour mocker DB (déjà éprouvé)
- **Playwright** pour E2E (existant)
- **Test ultime par phase** = critère d'acceptance

### Sécurité
- `requireAdmin()` partout
- Pas de PII en logs
- Rate limit per-admin sur endpoints lourds
- Audit log toutes mutations

## Tradeoffs explicites

Voir [01-tradeoffs.md](01-tradeoffs.md).
