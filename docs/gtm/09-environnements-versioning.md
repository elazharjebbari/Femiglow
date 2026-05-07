# 09 — Environnements & versioning

> *dev / preview / prod / stage, versions GTM, change log*

---

## 1. Quatre environnements GTM

| Environnement   | Auth env GTM      | Hostname matching                    | Pixels       |
| --------------- | ----------------- | ------------------------------------ | ------------ |
| **Production**  | `ENV-LIVE`        | `femiglow.ma`, `www.femiglow.ma`      | IDs réels    |
| **Stage**       | `ENV-STAGE`       | `stage.femiglow.ma`                   | IDs Stage    |
| **Preview**     | `ENV-PREVIEW`     | `*.vercel.app`                        | IDs Preview  |
| **Dev local**   | `ENV-DEV`         | `localhost`, `127.0.0.1`              | aucun pixel  |

## 2. Snippet GTM par env

Chaque environnement a son **auth string** (généré dans GTM Admin
→ Environments). Le snippet inclut l'auth :

```html
<!-- Snippet GTM - Production -->
<script>(function(w,d,s,l,i){...})(window,document,'script','dataLayer','GTM-XXXXXXX');</script>

<!-- Snippet GTM - Stage avec auth -->
<script>
(function(w,d,s,l,i){...})(window,document,'script','dataLayer','GTM-XXXXXXX&gtm_auth=ABC123&gtm_preview=env-2&gtm_cookies_win=x');
</script>
```

L'auth string force le browser à lire la **version publiée dans
cet environnement** plutôt que la version Live par défaut.

## 3. Côté code — injection conditionnelle

```ts
// apps/web/src/lib/tracking/providers/gtm.ts (à étendre)
import { getEnvironment } from '@/lib/env';

const GTM_AUTH: Record<string, string | null> = {
  production: null,                  // auth par défaut = Live
  stage:      'ABC&gtm_preview=env-2&gtm_cookies_win=x',
  preview:    'DEF&gtm_preview=env-3&gtm_cookies_win=x',
  dev:        'GHI&gtm_preview=env-4&gtm_cookies_win=x',
};

export function getGtmSnippet(containerId: string): string {
  const env = getEnvironment();   // 'production' | 'stage' | 'preview' | 'dev'
  const auth = GTM_AUTH[env];
  const suffix = auth ? '&' + auth : '';
  // …injecte gtm.js?id=GTM-XXX[&gtm_auth=...]
}
```

## 4. Workflow Workspaces → Versions → Environments

```
┌─────────────────────────────┐
│  Workspace "feature/X"       │
│  (un dev modifie)            │
│  → Submit Changes            │
└──────────────┬───────────────┘
               │
               ▼
       Version créée
       (snapshot immuable)
       Numéro auto incrémenté
               │
               ▼
       Publish to Environment :
        - Live (= production)
        - Stage
        - Preview
        - Dev
       (chaque env a sa version)
```

> **Règle FemiGlow** : on **publie d'abord en Preview**, on
> teste, puis en **Stage**, puis en **Live**. Pas de saut direct
> vers Live.

## 5. Procédure de publication

### 5.1 Cycle standard

```
1. Modifier `event-catalog.ts`           (commit/PR Git)
2. Regénérer container.json              (`pnpm tsx scripts/gtm-generate.ts`)
3. Diff vs container actuel              (`pnpm tsx scripts/gtm-diff.ts`)
4. Importer dans workspace `feature/X`   (UI ou API)
5. Submit Changes → Version N             (UI)
6. Publish Version N to Preview          (UI ou API)
7. Tester (Tag Assistant, GA4 DebugView, Playwright e2e)
8. Publish Version N to Stage            (UI ou API)
9. Test régression sur stage.femiglow.ma
10. Publish Version N to Live            (UI ou API)
11. Notification Slack #tracking
```

### 5.2 Hotfix

```
1. Workspace `hotfix/<incident>`
2. Modifier directement (sans Git PR si urgence)
3. Submit Changes → Version N
4. Publish to Live (skip Preview/Stage si urgence)
5. Post-mortem : remonter le change en Git
```

## 6. Versioning Git

Le `container.json` est **généré** depuis `event-catalog.ts`. On
versionne :

| Fichier                                       | Versionné Git ? | Notes                                              |
| --------------------------------------------- | --------------- | -------------------------------------------------- |
| `event-catalog.ts`                            | ✓               | Source de vérité                                    |
| `event-mapping.ts`                            | ✓               | Source de vérité                                    |
| `docs/gtm/annexes/container-template.json`    | ✓               | Template structurel (sans IDs)                      |
| `infra/gtm/container.production.json`         | ✗ (gitignored)  | Généré à chaque build, contient IDs                |
| `infra/gtm/container.stage.json`              | ✗               | Idem                                                |
| `docs/gtm/CHANGELOG.md`                       | ✓               | Historique des changements GTM                      |

## 7. CHANGELOG GTM

Convention :

```markdown
# CHANGELOG GTM

## [v1.4.0] - 2026-05-12 — Production

### Added
- Tag `GA4 Evt — fg_consent_change` pour observer les changements de consentement
- Variable `DLV - user_data.country` pour Pinterest enhanced

### Changed
- `Meta Init` priorité 70 → 75 pour passer avant `TikTok Init`

### Removed
- Tag `Aux JS — Old GA UA` (obsolète)

### Migration notes
- Aucune action côté code
```

Mis à jour à chaque PR de change GTM.

## 8. Permissions GTM par rôle

| Rôle FemiGlow      | Permission GTM                                            |
| ------------------ | --------------------------------------------------------- |
| Tech Lead          | Admin (sur tous les workspaces)                            |
| Acquisition         | Edit (workspaces feature/) + Approve (Live)               |
| Data / Analytics   | Edit (workspaces feature/)                                 |
| QA                 | View (tous workspaces)                                     |
| Service Account API | Edit + Publish (utilisé par le générateur, cf. doc 10)    |

## 9. Tag Assistant Preview — chaque environnement

Chaque environnement peut être inspecté via Tag Assistant :

```
Tag Assistant → Connect to a domain → enter URL
  - Production : https://femiglow.ma
  - Stage      : https://stage.femiglow.ma
  - Preview    : https://<branch>.femiglow.vercel.app
  - Dev        : http://localhost:3000   (avec --host=0.0.0.0 + ngrok pour Tag Assistant)
```

## 10. Rollback

### 10.1 Rollback rapide

```
GTM → Versions → Sélectionner v(N-1) → Publish
```

Restaure la version précédente en moins de 30 secondes.

### 10.2 Rollback Git (si change vient du générateur)

```bash
git revert <commit>          # annule le change dans event-catalog.ts
pnpm tsx scripts/gtm-generate.ts
pnpm tsx scripts/gtm-push.ts --env=production
```

## 11. Quotas GTM

| Limite                                  | Valeur                            |
| --------------------------------------- | --------------------------------- |
| Tags par container                      | 1 200 (largement suffisant)        |
| Triggers par container                  | 1 000                              |
| Variables par container                 | 1 000                              |
| Versions par container                  | illimité (anciennes purgées par GTM) |
| Workspaces simultanés                   | 3 (dont 1 Default)                  |
| API calls / day (GTM API v2)            | 100 000 / project                   |

## 12. Monitoring & alerting

| Source                               | Métrique                                            | Alerte                                  |
| ------------------------------------ | --------------------------------------------------- | --------------------------------------- |
| GA4 DebugView                         | Events reçus avec `consent_state = 'denied'`        | Investigation manuelle hebdo            |
| Meta Events Manager                   | Match Quality Score                                 | < 6 → ticket P1                          |
| Tag Assistant Preview                 | Tags non-fired                                      | Vérifier au moindre doute                |
| Sentry / Logs Vercel                  | Erreurs JS dans Custom HTML tags                    | Slack canal #tracking                    |
| Lighthouse CI                         | Score perf < 90                                     | PR-level check                            |

## 13. Lecture suivante

- [10 — Automatisation](10-automatisation.md)
- [12 — Runbook](12-runbook.md)
