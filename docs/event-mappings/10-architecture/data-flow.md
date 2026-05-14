# 10.5 — Data flow

## Flow 1 — Édition d'un mapping par l'admin

```
1. Admin charge /admin/tracking/events/mappings
                │
                ▼
2. Server component fetch GET /api/admin/tracking/events/mappings
   → store.listVersions() lit event_mapping_versions
   → renvoie [{ id, name, status, is_active, is_default, created_at, ... }]
                │
                ▼
3. Client component "MappingVersionsList" affiche la liste
                │
                ├─ active en haut (badge vert)
                ├─ drafts en milieu (badge bleu)
                ├─ archived dépliable (badge gris)
                └─ deleted toggle (par défaut caché)
                │
                ▼
4. Admin click "Éditer v3"
                │
                ▼
5. Navigate vers /admin/tracking/events/mappings/v3/edit
                │
                ▼
6. Server fetch GET /api/admin/tracking/events/mappings/v3
   → store.getVersion(v3) → row complète avec mappings JSONB
                │
                ▼
7. Client component "MappingVersionEditor" hydraté avec data
   → matrice Event × Provider rendue
   → bouton "Sauvegarder modifications" disabled tant que dirty=false
                │
                ▼
8. Admin édite une cellule (meta de "purchase" → "PurchasePremium")
   → state local marqué dirty=true
   → bouton "Sauvegarder" enabled
                │
                ▼
9. Admin click "Sauvegarder modifications"
   → Modal confirm "D-001 : action va créer une nouvelle version dérivée"
   → Admin confirme
                │
                ▼
10. PUT /api/admin/tracking/events/mappings/v3
    body = { mappings: ..., name?: 'v3 (édition Sara 2026-05-13)' }
                │
                ▼
11. Route handler :
    a. validate(mappings) via Zod par provider
    b. store.clone(v3, newMappings, { name, actorId })
       → INSERT new row (status=draft, cloned_from=v3, mappings=new)
    c. audit.auditMappingChange(action='edit', actor, version_before=v3, version_after=v4)
       → INSERT event_mapping_audit
    d. retourne 201 { newVersion }
                │
                ▼
12. Client toast "Version draft créée. Active-la pour la mettre en production."
    → redirect vers /admin/tracking/events/mappings/v4
```

## Flow 2 — Activation d'une version

```
1. Admin click "Activer v4" depuis la liste
                │
                ▼
2. Modal confirm "Activer v4 ? La version active courante (v3) sera archivée."
   → Admin confirme
                │
                ▼
3. POST /api/admin/tracking/events/mappings/v4/activate
                │
                ▼
4. Route handler :
   a. BEGIN transaction
   b. UPDATE event_mapping_versions
      SET is_active = false, status = 'archived', archived_at = now()
      WHERE is_active = true
   c. UPDATE event_mapping_versions
      SET is_active = true, status = 'active', activated_at = now()
      WHERE id = 'v4'
   d. audit.auditMappingChange(action='activate', actor, version_before=v3, version_after=v4)
   e. COMMIT
   f. Invalidate cache resolver (in-memory TTL reset)
                │
                ▼
5. Client toast "v4 active. Dispatcher utilisera ce mapping immédiatement (cache TTL 30s)."
```

## Flow 3 — Run-time : dispatcher utilise le mapping

```
1. /api/track reçoit un POST avec event "purchase" + event_id
                │
                ▼
2. /api/track/route.ts appelle dispatchToProviders({ eventName: 'purchase', ... })
                │
                ▼
3. dispatcher.ts itère sur les providers enabled :
   for kind in ['meta', 'google_ga4', 'google_ads', 'tiktok', 'snap', 'pinterest']:
     mapping = await resolveEventMapping('purchase', kind)
                │
                ▼
4. resolveEventMapping('purchase', 'meta') :
   a. Lookup cache in-memory (key='purchase|meta', TTL 30s)
      → cache hit ? retourne immédiatement (p99 < 1ms)
      → cache miss ? continue
   b. store.getActive() → version active row (mémoïsé 30s)
   c. cell = active.mappings['purchase']['meta']
   d. if cell == null || !cell.isEnabled || !cell.mappedName → return null
   e. Cache write + return cell
                │
                ▼
5. dispatcher dispatch vers Meta avec mappedName='Purchase', isCustom=false
   → POST graph.facebook.com/.../events { event_name: 'Purchase', ... }
                │
                ▼
6. Idem pour GA4, TikTok, Snap, Pinterest en parallèle
```

## Flow 4 — Export vers GTM

```
1. Admin click "Exporter vers GTM" sur la version v4
                │
                ▼
2. Modal sélection environnement (production / stage / preview / dev)
   → Admin choisit "production" + confirme
                │
                ▼
3. POST /api/admin/tracking/events/mappings/v4/export-gtm
   body = { env: 'production' }
                │
                ▼
4. Route handler :
   a. store.getVersion(v4) → mappings JSONB
   b. gtmExport.buildGtmContainer(v4.mappings, env='production')
      → produit { exportFormatVersion: 2, containerVersion: { container, tag[], variable[], trigger[] } }
   c. sha256 du payload
   d. audit.auditMappingChange(action='export_gtm', actor, version=v4, meta={env, sha256, tagsCount})
   e. retourne 200 { containerJson, meta: { sha256, tagsCount, eventsCount } }
                │
                ▼
5. Client génère un Blob + déclenche download
   → fichier "femiglow-gtm-v4-production-20260513.json"
                │
                ▼
6. Admin ouvre GTM Web UI > Admin > Container > Import Container
   → Drag & drop le fichier
   → GTM affiche preview (tags/variables/triggers à ajouter)
   → Admin valide
   → GTM applique les changements au workspace
```

## Flow 5 — Reset au default

```
1. Admin click "Revenir au mapping par défaut" sur la liste
                │
                ▼
2. Modal confirm avec récap :
   "Revenir au default factory FemiGlow ?
    L'active courante v4 (édition Sara 2026-05-13) sera archivée.
    Le default __default__ deviendra active.
    Aucune donnée n'est perdue."
   → Admin confirme
                │
                ▼
3. POST /api/admin/tracking/events/mappings/reset-default
                │
                ▼
4. Route handler :
   a. store.activate('__default__')
      → mêmes étapes que Flow 2 (transaction)
   b. audit.auditMappingChange(
        action='reset_to_default',
        actor,
        version_before=v4,
        version_after='__default__'
      )
                │
                ▼
5. Client toast "Mapping par défaut restauré. Dispatcher utilise __default__ maintenant."
```

## Cache strategy

| Layer | Cache | TTL | Invalidation |
|---|---|---|---|
| `resolveEventMapping` | In-memory Map | 30s | À chaque `store.activate()` |
| `store.getActive()` | In-memory ref | 30s | À chaque `store.activate()` |
| `/api/admin/tracking/events/mappings` (liste) | HTTP `Cache-Control: private, max-age=30` | 30s | À chaque mutation (auto via `no-store` sur PUT/POST/DELETE) |
| `/api/admin/tracking/events/mappings/[id]` | HTTP `Cache-Control: private, max-age=60` | 60s | Idem |
