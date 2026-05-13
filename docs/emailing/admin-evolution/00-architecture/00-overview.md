# Architecture overview — M5 admin emailing evolution

> Vue système haut-niveau. Pour les diagrammes : [01-system-architecture.puml](01-system-architecture.puml), [02-data-flow.puml](02-data-flow.puml). Pour les décisions : [05-adr.md](05-adr.md).

## Vue d'ensemble

```
┌────────────────────────────────────────────────────────────────────┐
│                       FemiGlow admin (Next.js)                     │
│                                                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │ Cockpit         │  │ Audience builder│  │ Automation      │    │
│  │ /transactional  │  │ /audiences      │  │ studio          │    │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘    │
│           │                    │                    │              │
│  ┌────────▼────────────────────▼────────────────────▼─────────┐   │
│  │  Server actions + API routes (Next.js)                     │   │
│  │  - listOutbox, summarizeOutbox, bulkRetry                  │   │
│  │  - createAudience, previewAudienceSize, snapshotAudience   │   │
│  │  - createAutomation, runAutomation, ...                    │   │
│  └────────┬───────────────────────────┬───────────────────────┘   │
│           │                           │                            │
└───────────┼───────────────────────────┼────────────────────────────┘
            │                           │
   ┌────────▼────────┐         ┌────────▼─────────┐         ┌──────────┐
   │  Postgres       │         │  Listmonk        │ ──┐     │ Stalwart │
   │  - emailing     │         │  (loopback 9000) │   │     │ SMTP     │
   │  - user_event   │         │                  │   │ ←   │          │
   │  - audiences    │         │  - lists         │   │ webhook         │
   │  - automations  │         │  - campaigns     │   │     │          │
   └─────────────────┘         └──────────────────┘   │     └──────────┘
                                                       │
                                       Bridges (webhooks → DB)
                                                       │
                                              ┌────────▼────────┐
                                              │ user_event      │
                                              │ (unified)       │
                                              └─────────────────┘
```

## Composants par phase

### M5.1 — Cockpit transactionnel
- **Frontend** : Refonte `/admin/emails/transactional` avec KPI header,
  command palette, saved views
- **Backend** : Nouvel endpoint de recherche typée + bulk actions
- **Data** : nouvelle table `admin_email_view` (saved views)

### M5.2 — Events utilisateur unifiés
- **Frontend** : –
- **Backend** : Bridges (web tracking, email webhooks, server actions)
  vers `user_event`
- **Data** : nouvelle table `user_event`

### M5.3 — Audiences
- **Frontend** : Builder + preview + page list/detail
- **Backend** : Rules compiler (Rules JSON → Drizzle query), Snapshot
  engine, Listmonk sync (push éphémère)
- **Data** : `email_audience`, `email_audience_snapshot`,
  `email_audience_snapshot_member`

### M5.4 — Campagnes intégrées
- **Frontend** : Wizard step 2 refait
- **Backend** : Modif `finalizeCampaign()` → snapshot + push + create
  Listmonk campaign
- **Data** : ajout colonnes `email_campaign_link.audience_id`,
  `email_campaign_link.snapshot_id`

### M5.5 — Automation studio
- **Frontend** : Wizard + page edit + run detail
- **Backend** : Runner V2 (nouveaux step types), conditions DSL,
  catalogue events
- **Data** : extension `email_automation.steps` jsonb, `lead_tag`

### M5.6 — Polish
- **Frontend** : Cmd-K universel, a11y, micro-copy
- **Backend** : –
- **Data** : –

## Principes architecturaux

### Idempotency partout
- `snapshotAudience(audienceId, snapshotKey?)` : si snapshot avec même
  key existe, retourne ; sinon crée
- `pushSnapshotToListmonk(snapshotId)` : si liste éphémère existe, ne
  recrée pas
- `bulkRetry(ids[])` : retry uniquement les ids actuellement en `failed`
  (ignore ceux déjà retried)

### Async pour les opérations longues
- Snapshot, push Listmonk, backfill events → endpoint qui retourne 202
  + `job_id`, frontend poll status
- Job persisté en `admin_job` table (à créer en M5.2 ou plus tard)

### Type safety end-to-end
- Zod schemas partagés entre client et serveur (`src/lib/types/`)
- Drizzle pour la DB
- TypeScript strict mode

### Pas de couplage entre sections
- Transactional / Audiences / Automations sont 3 modules quasi-
  indépendants, communiquent via les tables data (`email_outbox`,
  `email_audience`, `email_automation`)
- Cmd-K palette est un composant partagé qui se branche sur la section
  via context

### Source de vérité unique
- Pour un email envoyé : `email_outbox` (FemiGlow)
- Pour une audience : `email_audience` (FemiGlow)
- Pour les events users : `user_event` (FemiGlow)
- Listmonk = moteur de delivery, pas source de vérité

## Évolutivité

| Axe | Stratégie |
|---|---|
| **Volume emails** | Outbox déjà testé à 10k/jour ; au-delà passer en batch worker dédié |
| **Volume events** | `user_event` partitionnable par mois si > 100M rows |
| **Nb audiences** | Rules JSON → indexable, pas de limite |
| **Nb automations** | Runner cron actuel suffit jusqu'à 100+ automations actives |
| **Multi-langue** | Templates Listmonk déjà multi-langue, audiences ont colonne `language` |
| **Multi-tenant** | Hors scope V1, mais schéma compatible (ajouter `tenant_id` partout) |

## Sécurité & RGPD

- Toute action audit log → `admin_audit_log` (table existante)
- Suppression user → trigger PostgreSQL purge `user_event`, anonymise
  `email_outbox.payload_json`, retire de `email_audience_snapshot_member`
- Pas de PII dans logs applicatifs
- Listes éphémères Listmonk : auto-purge J+30 par cron
- Snapshots : auto-purge J+90 (configurable)
