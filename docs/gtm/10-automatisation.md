# 10 — Automatisation

> *Generator `container.json` + GTM API v2 — la réponse à ta question.*

---

## 1. Réponse courte

**Oui**, on peut automatiser à 90 % la création de la
configuration GTM. Trois approches existent ; la **plus
robuste pour FemiGlow** est l'**approche hybride** :

1. **Generator** TypeScript qui lit `event-catalog.ts` +
   `event-mapping.ts` et produit un `container.json` complet.
2. **GTM API v2** qui prend ce `container.json` et l'importe (ou
   met à jour) dans le conteneur cible.
3. **CI** qui vérifie que le container actuel est cohérent avec
   le code (drift detection).

Aucun clic manuel pour les opérations courantes (ajout d'event,
mapping provider). Seules les **constantes** (Pixel IDs, Conv IDs)
et les **decisions humaines** (Consent Mode, custom dimensions
GA4) restent manuelles — une fois.

> **Pour les non-CLI** : une UI admin `/admin/tracking/gtm`
> permet de visualiser, télécharger, copier et comparer le
> container.json sans terminal — cf.
> [14-admin-export.md](14-admin-export.md). C'est la voie
> recommandée pour les non-développeurs.

## 2. Les trois approches existantes

### 2.1 GTM API v2 (officielle)

`https://tagmanager.googleapis.com/tagmanager/v2/`.

**Permet** : créer, lister, mettre à jour, supprimer
**accounts → containers → workspaces → versions → environments →
tags / triggers / variables / folders / templates**.

**Auth** :
- OAuth2 (interactif)
- **Service Account** (CI / scripts) — recommandé.

**Limites** :
- 100 000 calls / jour / projet GCP
- Pas de bulk import natif (un endpoint par tag, par trigger…)
- Quelques particularités sur les `containerVersion` (snapshot
  immutable)

**Documentation** : [developers.google.com/tag-platform/tag-manager/api/v2](https://developers.google.com/tag-platform/tag-manager/api/v2)

**SDK Node officiel** : `googleapis` (paquet `googleapis` de Google).

```ts
import { google } from 'googleapis';
const tagmanager = google.tagmanager({ version: 'v2', auth });
await tagmanager.accounts.containers.workspaces.tags.create({
  parent: 'accounts/A/containers/C/workspaces/W',
  requestBody: { name: 'GA4 Evt — purchase', type: 'gaawe', /* ... */ },
});
```

### 2.2 Container Import / Export JSON (UI)

GTM Admin permet :

- **Export** : télécharge un JSON contenant tous les tags,
  triggers, variables.
- **Import** : upload d'un JSON ; choix `Merge` (overwrite) ou
  `Overwrite` (remplace tout).

**Avantage** : pas besoin d'API, c'est un drag-drop.

**Inconvénient** : manuel, un humain doit cliquer.

### 2.3 GTM API v2 + container.json (notre choix)

On combine les deux :

1. Le générateur produit un `container.json` (format identique
   à l'export UI).
2. Un script TS lit ce JSON et appelle l'API v2 pour
   créer/synchroniser tags, triggers, variables.

> **Pourquoi pas l'import UI manuel ?** Parce qu'on veut une CI
> qui pousse les changements automatiquement après un merge.

## 3. Architecture du générateur

```
┌─────────────────────────────────────────────────────────────┐
│  Source de vérité :                                         │
│   - event-catalog.ts (38 events)                             │
│   - event-mapping.ts (events × providers)                    │
│   - docs/gtm/annexes/gtm-spec.yaml (constantes, conv IDs)    │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  scripts/            │
        │  gtm-generate.ts     │   ← lit catalogues + spec
        │                      │
        │  - build variables   │
        │  - build triggers    │
        │  - build tags        │
        │  - build folders     │
        │  - assemble JSON     │
        └──────────┬───────────┘
                   │
                   ▼
   docs/gtm/annexes/container-template.json   (committed)
   infra/gtm/container.production.json        (gitignored)
                   │
                   ▼
        ┌──────────────────────┐
        │  scripts/            │
        │  gtm-push.ts         │   ← appelle GTM API v2
        │                      │
        │  - service account    │
        │  - workspace target   │
        │  - diff + sync        │
        │  - publish to env     │
        └──────────────────────┘
```

## 4. Le fichier `gtm-spec.yaml`

Liste les éléments que **l'humain décide** une fois :

```yaml
# docs/gtm/annexes/gtm-spec.yaml
account_id: '6000000000'
container_id: '12345678'
container_path: 'accounts/6000000000/containers/12345678'
default_workspace_id: '5'

constants:
  GA4_ID_PROD: 'G-XXXXXXX1'
  GA4_ID_STAGE: 'G-XXXXXXX2'
  GA4_ID_PREVIEW: 'G-XXXXXXX3'
  META_PIXEL_ID_PROD: '11111111111'
  META_PIXEL_ID_STAGE: '22222222222'
  TIKTOK_PIXEL_ID_PROD: 'CXXXXXXX'
  SNAP_PIXEL_ID_PROD: 'aaaa-bbbb-cccc-dddd'
  PIN_TAG_ID_PROD: '0123456789'
  GOOGLE_ADS_CUSTOMER: '123-456-7890'
  GOOGLE_ADS_CONV_PURCHASE: 'AW-XXX/abc123'
  GOOGLE_ADS_CONV_LEAD: 'AW-XXX/def456'
  GOOGLE_ADS_CONV_SIGNUP: 'AW-XXX/ghi789'
  GOOGLE_ADS_CONV_INIT_CHECKOUT: 'AW-XXX/jkl000'
  DEFAULT_CURRENCY: 'MAD'
  COOKIE_DOMAIN: 'auto'

environments:
  production:
    hostname_match: ['femiglow.ma', 'www.femiglow.ma']
    auth: 'ENV-LIVE'
    enabled_providers: [google_ga4, meta, tiktok, snap, pinterest, google_ads]
  stage:
    hostname_match: ['stage.femiglow.ma']
    auth: 'ENV-STAGE'
    enabled_providers: [google_ga4]
  preview:
    hostname_match: ['*.vercel.app']
    auth: 'ENV-PREVIEW'
    enabled_providers: [google_ga4]
  dev:
    hostname_match: ['localhost', '127.0.0.1']
    auth: 'ENV-DEV'
    enabled_providers: []

custom_dimensions:
  - name: schema_version
    scope: event
    source: 'DLV - schema_version'
  - name: locale
    scope: user
    source: 'DLV - page.locale'
  - name: utm_source
    scope: event
    source: 'URL - utm_source'
  # ...

consent_mode:
  defaults:
    ad_storage: denied
    analytics_storage: denied
    ad_user_data: denied
    ad_personalization: denied
    functionality_storage: denied
    personalization_storage: denied
    security_storage: granted
    wait_for_update: 500

extra_triggers:
  - id: PV_KIT_PAGE
    type: pageview
    name: 'PV — Kit Page'
    conditions:
      - var: 'DLV - page.path'
        op: equals
        value: '/kit'

extra_tags:
  # tags qui n'ont pas de mapping standard
  - id: AUX_PAGE_TYPE_PUSH
    name: 'Aux JS — Page Type'
    type: html
    code: |
      <script>
      window.dataLayer.push({ page_type: '{{RLT - Page Type by Path}}' });
      </script>
    triggers: [PV_ALL_PAGES]
    priority: 75
```

> Le YAML est lu par le générateur. Les humains éditent ce
> fichier ; tout le reste est dérivé.

## 5. Logique du `gtm-generate.ts`

```ts
// scripts/gtm-generate.ts (squelette)

import { EVENT_CATALOG } from '@/lib/tracking/event-catalog';
import { mapEventName } from '@/lib/tracking/providers/event-mapping';
import yaml from 'yaml';
import fs from 'node:fs/promises';

async function main() {
  const spec = yaml.parse(await fs.readFile('docs/gtm/annexes/gtm-spec.yaml', 'utf-8'));

  const variables: Variable[] = [];
  const triggers: Trigger[]   = [];
  const tags: Tag[]           = [];
  const folders: Folder[]     = [];

  // 1. Folders
  folders.push(...buildStandardFolders());

  // 2. Variables
  variables.push(...buildBuiltinVariables());                     // (in container builtinVariable[])
  variables.push(...buildConstants(spec.constants));               // 18 const
  variables.push(...buildDataLayerVariables(EVENT_CATALOG));       // 32 DLV
  variables.push(...buildLookupTables(spec));                       // 6 LUT
  variables.push(...buildRegexLookups());                           // 2 RLT
  variables.push(...buildJsVariables());                            // 8 JS
  variables.push(...buildUrlVariables());                           // 11 URL

  // 3. Triggers
  triggers.push(buildInitConsentTrigger());                          // INIT
  triggers.push(buildPageViewTriggerAll());                          // PV — All
  triggers.push(buildPageViewTriggerPublic());                       // PV — Public
  for (const t of spec.extra_triggers ?? []) triggers.push(buildExtraTrigger(t));
  for (const ev of EVENT_CATALOG) {
    triggers.push(buildCustomEventTrigger(ev));                      // CE — <event>
  }
  triggers.push(...buildGroupTriggers());                            // CE Group — *
  triggers.push(...buildExceptionTriggers());                        // EX — *

  // 4. Tags
  tags.push(buildConsentDefaultTag(spec.consent_mode));              // CMP Cfg — Default
  tags.push(buildConsentUpdateTag());                                 // CMP Cfg — Update
  tags.push(buildGa4ConfigurationTag(spec));                          // GA4 Cfg
  for (const ev of EVENT_CATALOG) {
    if (ev.defaultProviders.includes('google_ga4')) {
      tags.push(buildGa4EventTag(ev));                                 // GA4 Evt — <event>
    }
  }
  tags.push(buildMetaInitTag(spec));
  for (const ev of EVENT_CATALOG) {
    const metaName = mapEventName(ev.name, 'meta');
    if (metaName) tags.push(buildMetaEventTag(ev, metaName));
  }
  // idem pour TikTok, Snap, Pinterest…

  for (const conv of ['purchase', 'generate_lead', 'sign_up', 'begin_checkout']) {
    tags.push(buildAdsConversionTag(conv, spec));
  }
  tags.push(buildAdsRemarketingTag(spec));

  for (const t of spec.extra_tags ?? []) tags.push(buildExtraTag(t));

  // 5. Assemble
  const container = {
    exportFormatVersion: 2,
    exportTime: new Date().toISOString(),
    containerVersion: {
      path: spec.container_path,
      accountId: spec.account_id,
      containerId: spec.container_id,
      container: { /* ... */ },
      tag: tags,
      trigger: triggers,
      variable: variables,
      folder: folders,
      builtInVariable: builtinVariableList(),
    },
  };

  await fs.writeFile('infra/gtm/container.production.json', JSON.stringify(container, null, 2));
  console.log(`✓ Generated ${tags.length} tags, ${triggers.length} triggers, ${variables.length} variables`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

> Le fichier final ressemble à un export UI standard. GTM peut
> l'importer tel quel.

## 6. Logique du `gtm-push.ts`

```ts
// scripts/gtm-push.ts (squelette)

import { google, tagmanager_v2 } from 'googleapis';
import { JWT } from 'google-auth-library';
import fs from 'node:fs/promises';

const tm = google.tagmanager({
  version: 'v2',
  auth: new JWT({
    keyFile: process.env.GTM_SERVICE_ACCOUNT_KEY!,
    scopes: ['https://www.googleapis.com/auth/tagmanager.edit.containers',
             'https://www.googleapis.com/auth/tagmanager.publish'],
  }),
});

async function main() {
  const args = parseArgs();                    // --env=production --workspace=feature/abc
  const targetWorkspace = await ensureWorkspace(args.workspace);

  const desired = JSON.parse(await fs.readFile('infra/gtm/container.production.json', 'utf-8'));
  const current = await snapshotCurrent(targetWorkspace);

  const diff = computeDiff(current, desired);
  console.log(`Diff: +${diff.toCreate.length} create, ~${diff.toUpdate.length} update, -${diff.toDelete.length} delete`);

  if (args.dryRun) { print(diff); return; }
  await applyDiff(tm, targetWorkspace, diff);

  // Submit changes -> Version
  const version = await tm.accounts.containers.workspaces.create_version({
    path: targetWorkspace.path,
    requestBody: { name: `Auto v${Date.now()}`, notes: args.notes ?? 'auto-generated' },
  });

  // Publish to env
  if (args.env && version.data.containerVersion?.containerVersionId) {
    await tm.accounts.containers.environments.update({
      path: `accounts/A/containers/C/environments/${args.env}`,
      requestBody: { containerVersionId: version.data.containerVersion.containerVersionId },
    });
  }

  console.log('✓ Pushed and published');
}

main().catch(err => { console.error(err); process.exit(1); });
```

### 6.1 Diff intelligent

`computeDiff` compare les éléments par **nom canonique** (clé
naturelle) :

- tag : `name`
- trigger : `name`
- variable : `name`

Si le même nom existe avec un contenu différent → update. Si
absent côté distant → create. Si absent côté local → delete.

> **Important** : les créations doivent suivre cet ordre :
> 1. variables, 2. triggers, 3. tags. Sinon les références
> internes échouent.

## 7. Variables d'environnement requises

```
GTM_ACCOUNT_ID=6000000000
GTM_CONTAINER_ID=12345678
GTM_SERVICE_ACCOUNT_KEY=/path/to/service-account.json
```

> Le service account doit avoir le rôle **`tagmanager.user`**
> + permissions **Edit + Publish** sur le container.

## 8. Création du Service Account (une fois)

```
1. Console GCP → IAM & Admin → Service Accounts
2. Create service account "gtm-femiglow-ci"
3. Generate JSON key, download
4. GTM Admin → User Management → Add → email du SA
5. Permissions : Container Admin (Edit + Publish)
6. Stocker la clé en variable Vercel ou GitHub Secret
```

## 9. Workflow CI

`.github/workflows/gtm-sync.yml` :

```yaml
name: GTM sync

on:
  push:
    branches: [main]
    paths:
      - 'apps/web/src/lib/tracking/event-catalog.ts'
      - 'apps/web/src/lib/tracking/providers/event-mapping.ts'
      - 'docs/gtm/annexes/gtm-spec.yaml'

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: pnpm install
      - run: pnpm tsx scripts/gtm-generate.ts
      - run: pnpm tsx scripts/gtm-diff.ts --env=production
      - name: Push if main
        env:
          GTM_SERVICE_ACCOUNT_KEY: ${{ secrets.GTM_SA_KEY_PATH }}
          GTM_ACCOUNT_ID: ${{ secrets.GTM_ACCOUNT_ID }}
          GTM_CONTAINER_ID: ${{ secrets.GTM_CONTAINER_ID }}
        run: pnpm tsx scripts/gtm-push.ts --env=preview --workspace=auto-ci
      - name: Slack notify
        if: always()
        # ... post diff to Slack
```

> En **preview** uniquement automatiquement. La promotion vers
> Stage / Live reste **manuelle** (sécurité).

## 10. Drift detection

Un script `scripts/gtm-diff.ts` peut tourner périodiquement
(cron Vercel) pour détecter les **modifications manuelles** dans
GTM qui dérivent du code :

```sh
pnpm tsx scripts/gtm-diff.ts --env=production --notify-slack
```

Si quelqu'un modifie un tag à la main, la CI alerte et l'admin
peut soit :
- promouvoir le change en code (PR `event-catalog.ts`),
- ou rejeter (overwrite via push).

## 11. Plan d'implémentation (~70 tickets)

### Phase 1 — Setup (10 tickets, 5 jours)

| ID       | Tâche                                                    |
| -------- | -------------------------------------------------------- |
| GTM-001  | Créer compte GTM + container `GTM-FEMIGLOW`              |
| GTM-002  | Créer environnements (Live, Stage, Preview, Dev)         |
| GTM-003  | Créer service account + permissions Edit/Publish         |
| GTM-004  | Stocker clé SA dans Vercel + GitHub Secrets               |
| GTM-005  | Créer Pixel IDs (Meta, TikTok, Snap, Pinterest)          |
| GTM-006  | Créer Conversion Actions Google Ads (4)                  |
| GTM-007  | Rédiger `docs/gtm/annexes/gtm-spec.yaml`                  |
| GTM-008  | Stub `scripts/gtm-generate.ts` + `gtm-push.ts` + `gtm-diff.ts` |
| GTM-009  | Tests unitaires des helpers (build* functions)            |
| GTM-010  | CI workflow `.github/workflows/gtm-sync.yml`              |

### Phase 2 — Generator core (15 tickets, 4 jours)

| ID       | Tâche                                                    |
| -------- | -------------------------------------------------------- |
| GTM-011  | Builder Built-in Variables                                 |
| GTM-012  | Builder Constants (depuis spec.constants)                 |
| GTM-013  | Builder DataLayer Variables (depuis event-catalog params) |
| GTM-014  | Builder Lookup Tables (Env, GA4 ID, Pixel IDs, Currency)  |
| GTM-015  | Builder RegEx Lookups (Page Type, Funnel Step)            |
| GTM-016  | Builder Custom JS Variables (Items mappers, Is Bot, etc.) |
| GTM-017  | Builder URL Variables (utm_*, gclid, fbclid, …)          |
| GTM-018  | Builder Folders                                           |
| GTM-019  | Builder Init Trigger (Consent Default)                    |
| GTM-020  | Builder Page View Triggers                                 |
| GTM-021  | Builder Custom Event Triggers (1 par event)               |
| GTM-022  | Builder Group Triggers (E-commerce, FemiGlow, Forms, Video) |
| GTM-023  | Builder Exception Triggers (Admin, Bot, Consent, Dev)    |
| GTM-024  | Builder GA4 Configuration tag                              |
| GTM-025  | Builder GA4 Event tags (1 par event applicable)           |

### Phase 3 — Generator providers (15 tickets, 4 jours)

| ID       | Tâche                                                    |
| -------- | -------------------------------------------------------- |
| GTM-026  | Builder Meta Init tag                                     |
| GTM-027  | Builder Meta Event tags (1 par mapping)                  |
| GTM-028  | Builder TikTok Init tag                                  |
| GTM-029  | Builder TikTok Event tags                                |
| GTM-030  | Builder Snap Init tag                                     |
| GTM-031  | Builder Snap Event tags                                   |
| GTM-032  | Builder Pinterest Init tag                                |
| GTM-033  | Builder Pinterest Event tags                              |
| GTM-034  | Builder Google Ads Conversion tags (4)                    |
| GTM-035  | Builder Google Ads Remarketing tag                        |
| GTM-036  | Builder Aux JS tags (Page Type, Hash helper)              |
| GTM-037  | Tests : générer 90 tags sans erreur                       |
| GTM-038  | Tests : générer 50 triggers cohérents                     |
| GTM-039  | Tests : générer 80 variables référencées                  |
| GTM-040  | Validation JSON contre schema GTM (zod ou JSON Schema)   |

### Phase 4 — Pusher API (10 tickets, 3 jours)

| ID       | Tâche                                                    |
| -------- | -------------------------------------------------------- |
| GTM-041  | Auth service account                                       |
| GTM-042  | Lister tags / triggers / variables actuels                |
| GTM-043  | Logique de diff par nom canonique                         |
| GTM-044  | Apply create / update / delete (ordre var → trig → tag)  |
| GTM-045  | Création de version (containerVersion)                    |
| GTM-046  | Publication vers env Live / Stage / Preview               |
| GTM-047  | Mode `--dry-run` (affiche le diff sans appliquer)         |
| GTM-048  | Mode `--rollback=v(N-1)`                                  |
| GTM-049  | Slack notification (succès / échec)                       |
| GTM-050  | Tests intégration (mock GTM API)                          |

### Phase 5 bis — Events chat (~ 12 tickets, 2 jours)

Cf. [13-events-chat.md §13](13-events-chat.md). À insérer **après
Phase 3 et avant Phase 4 (Pusher API)** : les events chat sont des
données déclaratives, intégrées au générateur sans changement
d'infra.

| ID            | Tâche                                                                              |
| ------------- | ---------------------------------------------------------------------------------- |
| GTM-CHAT-001  | Ajouter les 10 events `fg_chat_*` dans `event-catalog.ts`                           |
| GTM-CHAT-002  | Ajouter les schémas Zod chat dans `schemas.ts`                                      |
| GTM-CHAT-003  | Étendre `event-mapping.ts` (Meta : widget_open, message_sent, lead_email_captured) |
| GTM-CHAT-004  | Ajouter custom dimensions `chat_*` dans `gtm-spec.yaml`                             |
| GTM-CHAT-005  | Ajouter tag `Meta Evt — Chat Engagement` (1re ouverture par session)                |
| GTM-CHAT-006  | Ajouter tag `Meta Evt — Chat Contact` (1er message user)                            |
| GTM-CHAT-007  | Ajouter triggers conditionnels « first per session »                                |
| GTM-CHAT-008  | Ajouter Variable JS `Chat Attributed` (lit `localStorage.fg.chat.v1`)               |
| GTM-CHAT-009  | Regénérer container.json + diff                                                     |
| GTM-CHAT-010  | Tests Playwright (10 scénarios chat — cf. doc 13 §12)                              |
| GTM-CHAT-011  | Configurer custom dimensions côté GA4 UI                                            |
| GTM-CHAT-012  | Audit consent : aucun event chat ne fuit si `analytics_storage = denied`           |

DoD Phase 5 bis : un visiteur ouvre le widget en preview, tape un
message, GA4 DebugView reçoit `fg_chat_widget_open` et
`fg_chat_message_sent` avec les bons paramètres ; Meta Test Events
reçoit `ChatEngagement` (1re ouv.) et `Contact` (1er msg user) avec
le même `eventID` que la conversion finale.

### Phase 5 ter — UI Admin export GTM (~17 tickets, 5 jours)

Cf. [14-admin-export.md §12](14-admin-export.md). Insérée **après
Phase 5 bis (events chat)** : l'UI consomme le générateur côté
serveur. Permet aux non-devs de visualiser et télécharger le
container.json.

| ID            | Tâche                                                                          |
| ------------- | ------------------------------------------------------------------------------ |
| GTM-EXP-001   | Route page Next.js `/admin/tracking/gtm`                                        |
| GTM-EXP-002   | Service `lib/tracking/gtm/exporter.ts` (build + stats + meta)                   |
| GTM-EXP-003   | Utilitaire `prettyPrint` avec ordre stable des clés                              |
| GTM-EXP-004   | Route `GET /api/admin/tracking/gtm/container?env=&format=&download=`            |
| GTM-EXP-005   | Composant `<GtmEnvSelector>`                                                     |
| GTM-EXP-006   | Composants `<GtmStatsGrid>` + `<GtmMetaInfo>`                                    |
| GTM-EXP-007   | Composant `<GtmJsonPreview>` (Shiki SSR + line numbers + collapse)              |
| GTM-EXP-008   | Composant `<GtmActionsBar>` (download + copy + diff link)                       |
| GTM-EXP-009   | Composant `<GtmImportInstructions>`                                              |
| GTM-EXP-010   | Modal plein écran `<GtmJsonPreviewFullscreen>`                                   |
| GTM-EXP-011   | Route `GET /api/admin/tracking/gtm/diff` (cache 60 s)                            |
| GTM-EXP-012   | Page `/admin/tracking/gtm/diff` + composants `<GtmDiffPanel>` + `<DiffViewer>`   |
| GTM-EXP-013   | Audit log `tracking.gtm.download` / `.copy` / `.push`                            |
| GTM-EXP-014   | Tests unit (pretty stable, stats, meta, sha256)                                  |
| GTM-EXP-015   | Tests E2E (download, copy, env switch, sécurité)                                 |
| GTM-EXP-016   | Stories Storybook des composants GTM                                              |
| GTM-EXP-017   | Doc utilisateur intégrée dans la page                                              |

DoD Phase 5 ter : un admin peut télécharger le `container.json`
depuis `/admin/tracking/gtm` sans CLI. Tests E2E verts.

### Phase 5 — Tests, runbook, docs (~15 tickets, 3 jours)

| ID       | Tâche                                                    |
| -------- | -------------------------------------------------------- |
| GTM-051  | Tests Playwright collecte (10 parcours clés)              |
| GTM-052  | Test Tag Assistant (manuel, documenté)                    |
| GTM-053  | Test GA4 DebugView                                         |
| GTM-054  | Test Meta Test Events Tool                                 |
| GTM-055  | Test TikTok Pixel Helper                                   |
| GTM-056  | Validation Lighthouse perf                                 |
| GTM-057  | Audit RGPD signé                                          |
| GTM-058  | Runbook complet (cf. doc 12)                               |
| GTM-059  | Rédaction CHANGELOG.md initial                             |
| GTM-060  | Plan post-launch (KPIs à suivre, owners)                  |
| GTM-061  | Doc finale partagée équipe                                 |
| GTM-062  | Formation interne (1h) sur le workflow                    |
| GTM-063  | Migration progressive : activer en preview, monitorer 7j  |
| GTM-064  | Activation prod                                            |
| GTM-065  | Audit post-mortem (1 semaine après lancement)             |

### Phases 6-7 (Phase 2 — sGTM, A/B tests)

À planifier après V1 stable.

## 12. Estimation totale

| Phase                       | Charge                |
| --------------------------- | --------------------- |
| 1 — Setup                   | 5 j                   |
| 2 — Generator core           | 4 j                   |
| 3 — Generator providers     | 4 j                   |
| **5 bis — Events chat**     | **2 j**                |
| **5 ter — UI Admin export** | **5 j**                |
| 4 — Pusher API              | 3 j                   |
| 5 — Tests + runbook         | 3 j                   |
| **Total V1**                | **~ 26 jours**         |
| 5 ter Phase 2 — Push depuis UI | + 2.5 j            |
| 6 — sGTM                    | + 5 j                 |
| 7 — A/B tests               | + 3 j                 |

## 13. Outils alternatifs / community

| Outil                    | Statut       | Utilité FemiGlow                         |
| ------------------------ | ------------ | ---------------------------------------- |
| `gtm-cli` (community)    | maintenu     | utile pour CRUD ad-hoc                    |
| `gtm-pretty`             | maintenu     | format un container.json pour relecture    |
| `Tag Manager Templates`  | community    | sources des templates à intégrer          |
| Stape iOS/Android SDK     | (sGTM)       | Phase 3 (mobile)                          |
| Terraform Provider GTM    | unofficial   | déconseillé (instable)                    |

## 14. FAQ

**Q : Pourquoi pas Google Tag Manager Templates Builder ?**
A : Pour publier des tag templates dans la community gallery — pas
notre besoin V1.

**Q : Pourquoi pas Segment / RudderStack ?**
A : Couches supplémentaires, coûts récurrents, et le datalayer
maison + GTM couvre déjà 95 % du besoin.

**Q : Et si GTM API tombe ?**
A : Fallback manuel : importer le JSON via UI GTM (drag-drop).

**Q : Les modifications UI faites en urgence sont écrasées ?**
A : Oui, à la prochaine push CI. D'où la convention « hotfix
direct → PR Git de réconciliation dans la foulée ».

## 15. Lecture suivante

- [11 — Tests & debug](11-tests-debug.md)
- [12 — Runbook](12-runbook.md)
- [`scripts/gtm-generate.ts`](scripts/gtm-generate.ts) — squelette
  exécutable.
- [`scripts/gtm-push.ts`](scripts/gtm-push.ts) — squelette
  exécutable.
