# 14 — Export GTM depuis l'admin Tracking

> *UI de prévisualisation et de téléchargement du `container.json`
> depuis `/admin/tracking/gtm`. Pretty-print, copie, download, diff,
> push optionnel.*

---

## 1. Pourquoi cette UI

Le générateur (`docs/gtm/scripts/gtm-generate.ts`) produit un
`container.json` à partir d'`event-catalog.ts`. En V1, l'admin doit
pouvoir :

1. **Visualiser** le container actuel (pretty-print) sans CLI.
2. **Télécharger** le fichier pour l'importer dans GTM Admin (UI Google).
3. **Copier** le contenu (utile pour collage dans un outil de diff
   externe ou un Slack avec collègue).
4. **Comparer** le container généré vs le container actuel en
   prod (drift detection visuel).
5. *[Phase 2]* **Pousser** le container vers GTM via l'API
   sans terminal.

Cela évite tout passage par le CLI pour les opérations courantes.

> **Hôte** : `/admin/tracking/gtm` — sous-route de la console
> Tracking existante (`docs/tracking/05-ui-ux-design.md`).

## 2. Position dans la console admin

```
/admin/tracking
├── /                       Dashboard KPIs
├── /inventory              Arbre pages × composants
├── /components/[id]        Éditeur composant
├── /providers              Liste pixels
├── /events                 Timeline log
├── /test                   Testeur d'event
├── /settings               Config globale
└── /gtm                    ★ NOUVEAU — Export GTM container
    ├── /                   Preview + actions
    ├── /diff               Diff vs container distant
    └── /push               (Phase 2) Push API
```

## 3. Page principale `/admin/tracking/gtm`

### 3.1 Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Tracking                                                            │
│                                                                       │
│ ┌────────────────────────────────────────────────────────────────┐  │
│ │  Export GTM                                                      │  │
│ │  Le conteneur GTM est généré depuis le catalogue d'événements.  │  │
│ └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│ ┌──────────┬──────────┬──────────┬──────────┐                        │
│ │ Env      │ Tags     │ Triggers │ Variables│                        │
│ │          │          │          │          │                        │
│ │ ┌──────┐ │   99     │   58     │   85     │                        │
│ │ │ prod ▾│ │          │          │          │                        │
│ │ └──────┘ │ 9 conv   │ 10 chat  │ 5 chat dim│                        │
│ │ stage    │          │          │          │                        │
│ │ preview  │          │          │          │                        │
│ │ dev      │          │          │          │                        │
│ └──────────┴──────────┴──────────┴──────────┘                        │
│                                                                       │
│ Container size : 187 kB · 3 458 lignes                                │
│ Generated at   : 2026-05-06 14:21:09 UTC · v1.4.0                     │
│ SHA-256        : a1b2c3d4e5f6…                                        │
│                                                                       │
│  [ Télécharger .json ]  [ Copier le JSON ]  [ Voir le diff distant ] │
│                                                                       │
│ ┌─ Aperçu pretty-printed ─────────────────────────────── [⤢ plein écran] ┐│
│ │      1   {                                                        ││
│ │      2     "exportFormatVersion": 2,                              ││
│ │      3     "exportTime": "2026-05-06T14:21:09Z",                  ││
│ │      4     "containerVersion": {                                  ││
│ │      5       "path": "accounts/6000…/containers/12345…",          ││
│ │      6       "container": { … },                                  ││
│ │     17       "tag": [                                              ││
│ │     18         { "name": "GA4 Cfg — Production", … },             ││
│ │     34         { "name": "GA4 Evt — fg_chat_widget_open", … },    ││
│ │   …    │      …                                                  ││
│ │                                                                  ││
│ │  [ ↑ collapse all ]   [ ↓ expand all ]   [ go to line: __ ]     ││
│ └────────────────────────────────────────────────────────────────────┘│
│                                                                       │
│ ┌─ Comment importer ─────────────────────────────────────────────────┐│
│ │  1. Ouvrir GTM → ton compte → ton conteneur                        ││
│ │  2. Admin → Import Container                                        ││
│ │  3. Choisir le fichier téléchargé                                   ││
│ │  4. Workspace : "feature/auto-import-<date>"                        ││
│ │  5. Mode : Merge (recommandé) ou Overwrite                         ││
│ │  6. Confirmer                                                       ││
│ └────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 Sections

| Section                    | Rôle                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| Sélecteur environnement    | `production` / `stage` / `preview` / `dev` — change les Pixel IDs intégrés au JSON         |
| Cartes statistiques        | Nombre de tags, triggers, variables, dont conv / chat                                      |
| Méta-informations          | Taille, lignes, hash SHA-256, version générée, timestamp                                  |
| Boutons d'action           | Télécharger, Copier, Voir diff, *[Phase 2] Push API*                                       |
| Aperçu pretty-printed      | Vue éditeur read-only avec line numbers + collapse/expand + recherche                      |
| Bloc d'aide à l'import      | Procédure pas-à-pas pour l'import GTM UI                                                   |

## 4. Composants UI

```
src/components/admin/tracking/gtm/
├── GtmExportPage.tsx                  // page racine, layout
├── GtmEnvSelector.tsx                  // <select> ou <Tabs>
├── GtmStatsGrid.tsx                    // 4 cartes
├── GtmMetaInfo.tsx                     // size, lines, hash, generatedAt
├── GtmActionsBar.tsx                   // Download / Copy / Diff / Push
├── GtmJsonPreview.tsx                  // viewer pretty-print
│   ├── uses                           //   - Shiki ou Prism (SSR-friendly)
│   └── line gutter, fold              //   - syntax highlighting
├── GtmImportInstructions.tsx           // bloc bas
├── GtmDiffPanel.tsx                    // vue diff distant (route /diff)
└── GtmPushDialog.tsx                   // (Phase 2) modal de push
```

### 4.1 `GtmJsonPreview.tsx` — viewer

```tsx
interface Props {
  json: string;                    // déjà pretty-printed côté server
  highlight?: 'json';
  defaultFolded?: number[];        // niveaux dépliés par défaut
  onCopy?: () => void;
}
```

Critères :

- **Read-only** (le JSON est immuable côté UI ; toute modif passe
  par `event-catalog.ts`).
- **Line numbers** alignées à droite, gris muted.
- **Syntax highlighting** JSON via Shiki (pré-rendu côté serveur)
  ou Prism côté client. Préférence : Shiki SSR pour zero JS bundle
  pour les pages admin volumineuses.
- **Collapse/expand** par bloc (`{`, `[`).
- **Recherche** (`Ctrl+F` natif suffit en V1, recherche custom
  en V2).
- **Plein écran** (modal sur la valeur entière du JSON).
- **Coloration** :
  - clés string : encre 80 %
  - valeurs string : champagne `#C8A876`
  - valeurs numériques : sauge profond `#A8C4A6`
  - booléens / null : ciel `#7AA8C0`
  - ponctuation : brume

### 4.2 `GtmActionsBar.tsx`

```tsx
<div className="flex gap-3">
  <Button variant="primary" onClick={onDownload}>
    Télécharger .json
  </Button>
  <Button variant="secondary" onClick={onCopy}>
    {copied ? '✓ Copié' : 'Copier le JSON'}
  </Button>
  <Button variant="ghost" onClick={() => router.push('/admin/tracking/gtm/diff')}>
    Voir le diff distant
  </Button>
  {/* Phase 2 */}
  {/* <Button variant="danger" onClick={onPush}>Pousser via API…</Button> */}
</div>
```

### 4.3 `GtmStatsGrid.tsx`

```tsx
<dl className="grid grid-cols-4 gap-4">
  <Stat label="Tags"      value={stats.tags}      sub={`${stats.conversions} conversions`} />
  <Stat label="Triggers"  value={stats.triggers}  sub={`${stats.chatTriggers} chat`} />
  <Stat label="Variables" value={stats.variables} sub={`${stats.chatDims} chat dims`} />
  <Stat label="Folders"   value={stats.folders}   sub={`9 catégories`} />
</dl>
```

## 5. Routes API

Toutes auth `iron-session` + rôle `tracking-admin` (ou `chat-admin`).

### 5.1 `GET /api/admin/tracking/gtm/container`

```
Query :
  env       : 'production' | 'stage' | 'preview' | 'dev' (default: production)
  format    : 'json' | 'pretty' | 'minified'  (default: pretty)
  download  : boolean — si true, force le header Content-Disposition

Response (Content-Type: application/json) :
{
  "container": { /* container.json complet */ },
  "stats": {
    "tags": 99,
    "triggers": 58,
    "variables": 85,
    "folders": 9,
    "conversions": 9,
    "chatTriggers": 10,
    "chatDims": 5
  },
  "meta": {
    "generatedAt": "2026-05-06T14:21:09Z",
    "version": "1.4.0",
    "sizeBytes": 191488,
    "lineCount": 3458,
    "sha256": "a1b2c3d4..."
  }
}

Response (download=true, format=pretty) :
  Content-Type: application/json; charset=utf-8
  Content-Disposition: attachment; filename="gtm-femiglow-production-2026-05-06.json"
  body: <pretty-printed JSON>
```

### 5.2 `GET /api/admin/tracking/gtm/diff`

```
Query :
  env : 'production' | 'stage' | 'preview' (default: production)

Response :
{
  "summary": { "create": 3, "update": 1, "delete": 0 },
  "items": [
    { "kind": "tag",      "name": "GA4 Evt — fg_chat_widget_open",  "action": "create" },
    { "kind": "trigger",  "name": "CE — fg_chat_message_sent",      "action": "create" },
    { "kind": "variable", "name": "DLV - chat.session_id",          "action": "create" },
    { "kind": "tag",      "name": "Meta Evt — Purchase",            "action": "update", "diff": "<...>" }
  ],
  "remoteSnapshotAt": "2026-05-06T14:18:43Z"
}
```

> Le snapshot remote est récupéré via GTM API v2 avec le service
> account. Le résultat est mis en cache 60 secondes pour éviter
> les hits répétés.

### 5.3 `POST /api/admin/tracking/gtm/push` *(Phase 2)*

```
Body :
{
  "env": "preview",
  "workspace": "feature/auto-from-admin",
  "notes": "Triggered by admin@x at 2026-05-06"
}

Response (streaming SSE recommandé pour suivre le diff/apply) :
  event: diff       data: { create: 3, update: 1, delete: 0 }
  event: applying   data: { kind: 'variable', name: '...', status: 'created' }
  ...
  event: version    data: { containerVersionId: 'xxx', name: 'Auto v...' }
  event: published  data: { env: 'preview' }
  event: done       data: { ok: true }
```

Pré-conditions Phase 2 :
- Service account configuré (cf. doc 10).
- Permissions `tracking-admin` + `gtm-push`.
- Confirmation modale obligatoire avant exécution.
- Audit log enrichi : `chat.gtm.push` avec acteur, env, version.

## 6. Implémentation côté serveur

### 6.1 Service `lib/tracking/gtm/exporter.ts`

```ts
import { generateContainer } from '@/scripts/gtm-generate';
import { computeStats, computeMeta } from './stats';
import { prettyPrint } from './pretty';

export const gtmExporter = {
  async build(env: 'production' | 'stage' | 'preview' | 'dev') {
    const container = await generateContainer({ env });   // appelle le générateur
    const pretty = prettyPrint(container);                 // 2-spaces, stable order
    const stats = computeStats(container);
    const meta = computeMeta(pretty, container);
    return { container, pretty, stats, meta };
  },

  async diffRemote(env: string) {
    const { container } = await this.build(env);
    const remote = await fetchRemoteSnapshot(env);          // via GTM API
    return computeDiff(remote, container);
  },
};
```

### 6.2 `prettyPrint`

Pretty-print stable (clés triées dans un ordre déterministe pour
diff propre) :

```ts
const KEY_ORDER = [
  // racine
  'exportFormatVersion', 'exportTime', 'containerVersion',
  // entité
  'name', 'type', 'parameter', 'priority', 'tagFiringOption',
  'firingTriggerId', 'blockingTriggerId', 'setupTag',
  'fingerprint', 'parentFolderId', 'tagId', 'triggerId', 'variableId',
];

export function prettyPrint(o: unknown): string {
  return JSON.stringify(sortKeys(o, KEY_ORDER), null, 2);
}
```

> Avantage : deux générations consécutives produisent le même
> pretty-print → diff trivial.

### 6.3 `computeStats`

```ts
function computeStats(c: Container) {
  const tags = c.containerVersion.tag ?? [];
  const triggers = c.containerVersion.trigger ?? [];
  const variables = c.containerVersion.variable ?? [];
  const folders = c.containerVersion.folder ?? [];

  return {
    tags: tags.length,
    triggers: triggers.length,
    variables: variables.length,
    folders: folders.length,
    conversions: tags.filter((t) => /Ads Conv|GA4 Evt — purchase|GA4 Evt — generate_lead|GA4 Evt — sign_up/.test(t.name)).length,
    chatTriggers: triggers.filter((t) => t.name?.startsWith('CE — fg_chat_')).length,
    chatDims: variables.filter((v) => v.name?.startsWith('DLV - chat.')).length,
  };
}
```

### 6.4 `computeMeta`

```ts
import { createHash } from 'node:crypto';

function computeMeta(pretty: string, container: Container) {
  return {
    generatedAt: new Date().toISOString(),
    version: container.containerVersion?.containerVersion ?? '1.0.0',
    sizeBytes: Buffer.byteLength(pretty, 'utf8'),
    lineCount: pretty.split('\n').length,
    sha256: createHash('sha256').update(pretty).digest('hex'),
  };
}
```

## 7. Comportements UX

### 7.1 Téléchargement

```ts
async function onDownload() {
  const res = await fetch(`/api/admin/tracking/gtm/container?env=${env}&format=pretty&download=true`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gtm-femiglow-${env}-${ymd()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Container téléchargé.');
}
```

Le filename suit le pattern `gtm-femiglow-<env>-YYYY-MM-DD.json`.

### 7.2 Copie presse-papier

```ts
async function onCopy() {
  await navigator.clipboard.writeText(prettyJson);
  setCopied(true);
  toast('Copié dans le presse-papier.');
  setTimeout(() => setCopied(false), 2000);
}
```

### 7.3 Bouton Plein écran

Ouvre une modal qui affiche le JSON sur 100 vh, sans le reste de
la page. Flèche back ou `Esc` pour revenir.

### 7.4 Reload après changement env

Quand le sélecteur change, requête API re-tirée. Le JSON est
re-render avec un fade 200 ms — pas de flash blanc.

### 7.5 Sécurité

- Le JSON n'inclut **jamais** les API keys / tokens en clair :
  les Custom HTML tags portent `{{LUT - Meta Pixel ID by Env}}`,
  pas la valeur résolue. Les **Pixel IDs publics** sont OK.
- Toutefois la page est protégée par auth admin pour limiter
  l'exposition des constantes internes (Conversion Labels, etc.).
- Watermark optionnel : footer du fichier export indique
  `// Generated for admin@x at <timestamp>` (commentaire JSON-Cs
  invalide → désactivé en V1, gardé en idée).

## 8. Diff distant — page `/admin/tracking/gtm/diff`

### 8.1 Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Export GTM                                                          │
│                                                                       │
│  Diff vs production                                                   │
│  Snapshot distant pris à 14:18:43 UTC                                 │
│                                                                       │
│  ┌─ Résumé ──────────────────────────────────────────────────┐       │
│  │  + 3 à créer    ~ 1 à mettre à jour    – 0 à supprimer    │       │
│  └────────────────────────────────────────────────────────────┘       │
│                                                                       │
│  ┌─ Détail ──────────────────────────────────────────────────┐       │
│  │  + tag      GA4 Evt — fg_chat_widget_open                  │       │
│  │  + trigger  CE — fg_chat_message_sent                       │       │
│  │  + variable DLV - chat.session_id                           │       │
│  │  ~ tag      Meta Evt — Purchase   [voir diff →]            │       │
│  └────────────────────────────────────────────────────────────┘       │
│                                                                       │
│  [ Régénérer l'aperçu ]   [ Pousser ces changements (Phase 2) ]      │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.2 Détail d'un diff item

Au clic sur `[voir diff →]`, panneau latéral avec **diff côte à côte**
des deux JSON (pretty-printed), via la même librairie qu'un Git
diff (`diff2html` ou `react-diff-viewer`).

## 9. Permissions & audit

| Action                          | Rôle requis           | Audit log                      |
| ------------------------------- | --------------------- | ------------------------------ |
| Visualiser preview              | `tracking-viewer`     | non                            |
| Télécharger container           | `tracking-admin`      | `tracking.gtm.download` (acteur, env, sha256) |
| Copier JSON                     | `tracking-admin`      | `tracking.gtm.copy` (acteur, env, sha256)     |
| Voir diff distant               | `tracking-admin`      | non                            |
| Pousser via API (Phase 2)       | `tracking-admin` + `gtm-push` | `tracking.gtm.push` (acteur, env, versionId) |

## 10. Performance

| Cible                                       | Valeur               |
| ------------------------------------------- | -------------------- |
| TTI page `/admin/tracking/gtm`              | < 700 ms             |
| Génération côté serveur                     | < 800 ms             |
| Pretty-print de 200 kB                       | < 100 ms             |
| Render preview (Shiki SSR)                   | < 60 ms              |
| Cache TTL `GET /container`                   | 60 s (clé : env)     |
| Cache TTL `GET /diff`                        | 60 s (clé : env)     |

> Le générateur est rapide (< 200 ms en pratique sur Vercel).
> Le bottleneck est la sérialisation pretty.

## 11. Tests

### 11.1 Unit (Vitest)

```ts
it('produit un JSON pretty stable entre 2 runs', () => {
  const a = prettyPrint(generateContainer({ env: 'production' }));
  const b = prettyPrint(generateContainer({ env: 'production' }));
  expect(a).toBe(b);
});

it('inclut les tags chat quand event-catalog les contient', () => {
  const c = generateContainer({ env: 'production' });
  expect(c.containerVersion.tag.find(t => t.name === 'GA4 Evt — fg_chat_widget_open')).toBeDefined();
});

it('expose un sha256 stable pour le même contenu', () => {
  const a = computeMeta(prettyPrint(c), c);
  const b = computeMeta(prettyPrint(c), c);
  expect(a.sha256).toBe(b.sha256);
});
```

### 11.2 E2E (Playwright)

```ts
test('admin peut télécharger le container.json', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/tracking/gtm');
  await expect(page.getByText(/Tags/)).toBeVisible();
  await expect(page.getByText(/99/)).toBeVisible();              // total tags
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Télécharger/ }).click();
  const dl = await downloadPromise;
  expect(dl.suggestedFilename()).toMatch(/^gtm-femiglow-production-\d{4}-\d{2}-\d{2}\.json$/);
});

test('changement env recharge le JSON', async ({ page }) => {
  await page.goto('/admin/tracking/gtm');
  await page.getByLabel('Environnement').selectOption('preview');
  await expect(page.getByText(/preview/)).toBeVisible();
  // les Pixel IDs preview doivent apparaître dans le pretty
});

test('copie JSON dans le presse-papier', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/admin/tracking/gtm');
  await page.getByRole('button', { name: /Copier/ }).click();
  await expect(page.getByText(/Copié/)).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('"exportFormatVersion": 2');
});
```

### 11.3 Sécurité

```ts
test('endpoint refuse si pas authentifié', async ({ request }) => {
  const res = await request.get('/api/admin/tracking/gtm/container?env=production');
  expect(res.status()).toBe(401);
});

test('aucune valeur API key n\'apparaît dans le JSON', async ({ request }) => {
  const res = await getJsonAsAdmin(request, '?env=production');
  const txt = JSON.stringify(res);
  expect(txt).not.toMatch(/EAA[A-Za-z0-9]{20,}/);                    // pattern Meta Access Token
  expect(txt).not.toMatch(/AIza[0-9A-Za-z_-]{35}/);                   // Google API key
  expect(txt).not.toMatch(/sk-[0-9A-Za-z]{20,}/);                     // OpenAI
});
```

## 12. Plan d'action — tickets `GTM-EXP-XXX`

À insérer en **Phase 5 ter** dans le plan principal
(cf. [10-automatisation.md §11](10-automatisation.md)).

| ID            | Tâche                                                                          | Estim |
| ------------- | ------------------------------------------------------------------------------ | ----- |
| GTM-EXP-001   | Route page Next.js `/admin/tracking/gtm`                                        | 0.25 j |
| GTM-EXP-002   | Service `lib/tracking/gtm/exporter.ts` (build + stats + meta)                   | 0.5 j |
| GTM-EXP-003   | Utilitaire `prettyPrint` avec ordre stable des clés                              | 0.25 j |
| GTM-EXP-004   | Route `GET /api/admin/tracking/gtm/container` (avec query env/format/download) | 0.5 j |
| GTM-EXP-005   | Composant `<GtmEnvSelector>`                                                     | 0.25 j |
| GTM-EXP-006   | Composant `<GtmStatsGrid>` + `<GtmMetaInfo>`                                     | 0.5 j |
| GTM-EXP-007   | Composant `<GtmJsonPreview>` (Shiki SSR + line numbers + collapse)              | 0.75 j |
| GTM-EXP-008   | Composant `<GtmActionsBar>` (download + copy + diff link)                       | 0.5 j |
| GTM-EXP-009   | Composant `<GtmImportInstructions>`                                              | 0.25 j |
| GTM-EXP-010   | Modal plein écran `<GtmJsonPreviewFullscreen>`                                   | 0.25 j |
| GTM-EXP-011   | Route `GET /api/admin/tracking/gtm/diff` + cache 60 s                            | 0.5 j |
| GTM-EXP-012   | Page `/admin/tracking/gtm/diff` + composants `<GtmDiffPanel>` + `<DiffViewer>`   | 0.75 j |
| GTM-EXP-013   | Audit log entries `tracking.gtm.download`, `.copy`, `.push`                      | 0.25 j |
| GTM-EXP-014   | Tests unit (pretty stable, stats, meta, sha256)                                  | 0.5 j |
| GTM-EXP-015   | Tests E2E (download, copy, env switch, sec)                                      | 0.5 j |
| GTM-EXP-016   | Story Storybook des composants GTM                                                | 0.25 j |
| GTM-EXP-017   | Doc utilisateur dans la page (bloc "Comment importer")                            | 0.25 j |

### Phase 2 (push API depuis l'UI)

| ID            | Tâche                                                                              | Estim |
| ------------- | ---------------------------------------------------------------------------------- | ----- |
| GTM-EXP-018   | Route `POST /api/admin/tracking/gtm/push` (SSE)                                     | 0.75 j |
| GTM-EXP-019   | Modal `<GtmPushDialog>` (sélection env + workspace + notes)                         | 0.5 j |
| GTM-EXP-020   | Affichage progress en temps réel (consume SSE)                                      | 0.5 j |
| GTM-EXP-021   | Permissions `gtm-push` + audit                                                       | 0.25 j |
| GTM-EXP-022   | Tests E2E push (stub API)                                                            | 0.5 j |

**Total Phase 5 ter (V1)** : ~ 7 jours.
**Total Phase 2 (push UI)** : ~ 2.5 jours.

DoD V1 : un admin peut visualiser, télécharger, copier, comparer
le container.json depuis `/admin/tracking/gtm` sans toucher au CLI.

## 13. Mise à jour `docs/tracking/05-ui-ux-design.md`

Ajout d'une **section 11 « GTM Export »** dans la console
Tracking (cf. wireframe ci-dessus). Pas de spec dédupliquée :
le doc principal est ce fichier `14-admin-export.md`.

## 14. Comportement charte

- **Pas d'urgence**, pas de bandeau "Push to production!".
- **Ton maison** : « Télécharger le conteneur », pas « Export
  now ».
- **Pas d'icône publicitaire** (rocket, fire). Une simple icône
  cloud download en encre.
- **Toaster** discret après actions, pas de confetti.
- **Couleurs** : sauge pour primaire, ciel pour info, champagne
  pour signal noble (sha256, version).

## 15. Lecture suivante

- [10 — Automatisation](10-automatisation.md) — générateur en CLI.
- [13 — Events chat](13-events-chat.md) — events à intégrer.
- `docs/tracking/05-ui-ux-design.md` — design system de la console
  Tracking.
