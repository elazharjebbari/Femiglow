# Form-Config Admin Integration — Runbook

> **Plan** : [40-form-config-admin-integration-plan.md](./40-form-config-admin-integration-plan.md)  
> **Mode** : exécution autonome, 8 phases avec validation gates.  
> **Pré-requis** : dev server clean (`.next` peut être rebuilt), DB accessible.

---

## Phase 0 — Prep

- [ ] `git status` — partir d'un état propre côté form-config.
- [ ] `rm -rf apps/web/.next` puis relancer `pnpm --filter @femiglow/web dev` (sur port 3000) en background — laisser le 3030 vivant.
- [ ] Vérifier `curl -fsS localhost:3000` retourne 200.

**Gate** : dev server répond, log "Ready in Xs".

---

## Phase 1 — Backend admin API

Créer **4 routes** sous `apps/web/src/app/api/admin/form-config/` :

| Fichier | Méthodes | Notes |
|---|---|---|
| `route.ts` | GET (liste) | `getAdminSession()` → 401 ; retourne `[{key, version, active, updatedAt, ...}]` pour `wizard_kit` + `wizard_commander` |
| `[key]/route.ts` | GET, PATCH | PATCH valide `If-Match` + Zod (`formConfigJsonSchema`) ; appelle `formConfigRepo.update({key, config, actorId})` ; `revalidateTag(formConfigTag(key))` ; `logAuditEvent('form-config.update')` |
| `[key]/history/route.ts` | GET | `formConfigRepo.listHistory(key)` |
| `[key]/rollback/route.ts` | POST | body `{ targetVersion: number }` + `If-Match` ; appelle `rollback` ; audit `form-config.rollback` |

Ajouter dans `form-config-repo.ts` :
```ts
export const formConfigTag = (key: string) => `form-config:${key}`;
```
et l'utiliser dans le public route (`route.ts:18` du GET) via `fetch(..., { next: { tags: [formConfigTag(key)] } })` — **ATTENTION** : le public route ne fait pas de fetch interne, il appelle direct le repo. Donc revalidateTag ne suffit pas pour la route handler. Solution : ajouter `export const revalidate = 60` ET utiliser `revalidatePath('/api/checkout/form-config/' + key)` après PATCH.

**Gate P1** :
- `pnpm tsc --noEmit` propre.
- `curl -X PATCH localhost:3000/api/admin/form-config/wizard_kit -H 'If-Match: 1' -H 'Content-Type: application/json' -d '{...}'` → 401 si pas loggé, 422 si schema invalide, 200 sinon.

---

## Phase 2 — Composants UI

Créer dans `apps/web/src/components/admin/settings/` :

### 2.1 `FormConfigCard.tsx`
Mirror du card delivery-cities inline (lignes 95-124 de `settings/page.tsx`) mais générique pour form-config.  
Props : `{ key, label, version, active, updatedAt, updatedBy? }`.  
Rendu : title (label humanisé), badge `Actif vN` ou `Inactif`, last modif relative time.

### 2.2 `FormConfigEditorShell.tsx`
Mirror exact de `SectionEditorShell.tsx` mais :
- pas de couplage `Section` type ; props `key: string` au lieu de `section`.
- pas de `SectionHistory` (admin-config) ; à la place, `FormConfigHistory` enfant.
- breadcrumb `Réglages / Form Config / <key>`.

### 2.3 `FormConfigEditor.tsx`
Client component, structuré en `<fieldset>` :

```tsx
<FormConfigEditorShell ...>
  <fieldset>steps + modes</fieldset>
  <fieldset>defaults</fieldset>
  <fieldset>copy</fieldset>
  <fieldset>validation</fieldset>
</FormConfigEditorShell>
```

Logique :
- useState par sous-section + dirty calc via `JSON.stringify`.
- `handleSave` : Zod parse → PATCH avec `If-Match: version` → handle 409/422/200.
- onReset → revert to initial.

### 2.4 `FormConfigHistory.tsx`
Fetch `/api/admin/form-config/[key]/history` au mount.  
Rendu : table `version | date | actor | action | description | [Voir diff] [Rollback]`.  
Click rollback → confirm dialog → POST → reload current.

**Gate P2** :
- Tous les fichiers compilent.
- `import { FormConfigEditor } from '@/components/admin/settings/FormConfigEditor'` résolu.

---

## Phase 3 — Pages admin

### 3.1 `apps/web/src/app/admin/settings/form-config/page.tsx`
```tsx
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { formConfigRepo } from '@/lib/checkout/repos/form-config-repo';
import { FormConfigCard } from '@/components/admin/settings/FormConfigCard';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await requireAdmin('/admin/settings/form-config');
  const [kit, commander] = await Promise.all([
    formConfigRepo.getByKey('wizard_kit'),
    formConfigRepo.getByKey('wizard_commander'),
  ]);
  return (
    <AdminShell adminEmail={session.email} active="settings">
      <header>...breadcrumb + h1...</header>
      <section className="grid gap-4 sm:grid-cols-2">
        {kit && <FormConfigCard ... />}
        {commander && <FormConfigCard ... />}
      </section>
    </AdminShell>
  );
}
```

### 3.2 `apps/web/src/app/admin/settings/form-config/[key]/page.tsx`
```tsx
export default async function Page({ params }: { params: { key: string } }) {
  const session = await requireAdmin(`/admin/settings/form-config/${params.key}`);
  const row = await formConfigRepo.getByKey(params.key);
  if (!row) notFound();
  return (
    <AdminShell adminEmail={session.email} active="settings">
      <FormConfigEditor
        initialKey={row.key}
        initialConfig={row.config}
        initialVersion={row.version}
        initialActive={row.active}
        updatedAt={row.updatedAt.toISOString()}
      />
    </AdminShell>
  );
}
```

**Gate P3** : navigate `/admin/settings/form-config` → 200 OK avec 2 cards.

---

## Phase 4 — Wire dans `/admin/settings`

Éditer `apps/web/src/app/admin/settings/page.tsx` :

1. Importer `formConfigRepo` + Link.
2. Dans le `Promise.all`, ajouter :
   ```ts
   formConfigRepo.getByKey('wizard_kit'),
   formConfigRepo.getByKey('wizard_commander'),
   ```
3. Ajouter une 6ᵉ card (Link inline, mirror du delivery-cities pattern) :
   ```tsx
   <Link href="/admin/settings/form-config" className="...">
     <h2>Configuration des formulaires</h2>
     <span className="badge">{activeWizardCount} actifs</span>
     <p>Steps, copy et validation des wizards de commande.</p>
     <span className="2xl">{totalVersions}</span>
     <p>{`Dernière édition ${relativeTime(latestUpdate)}`}</p>
   </Link>
   ```

**Gate P4** : `/admin/settings` affiche 6 cards (incluant Form Config).

---

## Phase 5 — Seed initial

```bash
# Vérifier en DB
psql $DATABASE_URL -c "SELECT key, version, active FROM form_config;"
```

Si vide :
1. Créer `apps/web/drizzle/migrations/0024_seed_form_config_defaults.sql` :
   ```sql
   INSERT INTO form_config (id, key, version, active, config, description, created_at, updated_at, created_by, updated_by)
   VALUES
     ('fc_kit_seed', 'wizard_kit', 1, true, '{...defaults wizard_kit...}', 'Seed initial', NOW(), NOW(), 'system', 'system'),
     ('fc_cmd_seed', 'wizard_commander', 1, true, '{...defaults wizard_commander...}', 'Seed initial', NOW(), NOW(), 'system', 'system')
   ON CONFLICT (key) DO NOTHING;
   ```
2. Exécuter `pnpm drizzle-kit migrate`.

Defaults JSONB par wizard (à coller dans le SQL) :
- `wizard_kit` : modes `['wizard_embed']`, paymentMethods `['cod']`, copy en FR, validation phone 9-13.
- `wizard_commander` : modes `['wizard_cart']`, autres similaires.

**Gate P5** : `SELECT * FROM form_config` retourne 2 rows actives.

---

## Phase 6 — Tests

### 6.1 Vitest
Créer :
- `apps/web/src/app/api/admin/form-config/[key]/route.test.ts` (4 routes : 401 / 422 / 409 / 200 + audit).
- `apps/web/src/components/admin/settings/FormConfigEditor.test.tsx` (render, dirty, save, error 409).
- `apps/web/src/components/admin/settings/FormConfigCard.test.tsx` (rendu actif vs inactif).

### 6.2 Playwright
Créer `apps/web/e2e/admin-form-config.spec.ts` :
- pre-set admin session via `auth.setup.ts` (déjà existant).
- 8 steps du plan §5.2.
- axe-core scan sur 2 pages.

### 6.3 Lancer
```bash
pnpm vitest run src/app/api/admin/form-config src/components/admin/settings/FormConfig
pnpm playwright test e2e/admin-form-config.spec.ts --project=chromium-desktop
```

**Gate P6** : tous les tests passent.

---

## Phase 7 — Régression

```bash
# Chat regression (CHA-230 v6)
pnpm vitest run src/lib/chat src/components/chat

# Typecheck (filtré pour ignorer .next stale)
pnpm tsc --noEmit 2>&1 | grep -v "TS6053"

# Lint
pnpm lint
```

**Gate P7** :
- 0 test cassé sur le périmètre touché.
- 0 erreur TS sur les fichiers source.
- 0 erreur lint.

---

## Phase 8 — Prod build + feed preview

```bash
# Kill dev server
ps -ef | grep "next dev" | grep -v grep | awk '{print $2}' | xargs kill -TERM

# Build prod
pnpm --filter @femiglow/web build

# Start prod
pnpm --filter @femiglow/web start &

# Wait ready
until curl -fsS localhost:3000/api/health 2>/dev/null; do sleep 2; done
```

Lister les URLs de tous les feeds + pages paramètres :

| Catégorie | URL prod |
|---|---|
| Feed RSS journal | `http://localhost:3000/feed.xml` |
| Feed produit Merchant (Google) | `http://localhost:3000/api/products/feed` ou `/feed/merchant.xml` |
| Sitemap | `http://localhost:3000/sitemap.xml` |
| Form-config public | `http://localhost:3000/api/checkout/form-config/wizard_kit` + `/wizard_commander` |
| Delivery cities | `http://localhost:3000/api/delivery-cities` |
| Admin settings hub | `http://localhost:3000/admin/settings` |
| Admin form-config liste | `http://localhost:3000/admin/settings/form-config` |
| Admin form-config détail | `http://localhost:3000/admin/settings/form-config/wizard_kit` |
| Admin flags | `http://localhost:3000/admin/settings/flags` |
| Admin RBAC | `http://localhost:3000/admin/settings/rbac` |
| Admin Branding | `http://localhost:3000/admin/settings/branding` |
| Admin Navigation | `http://localhost:3000/admin/settings/navigation` |
| Admin Delivery Cities | `http://localhost:3000/admin/settings/delivery-cities` |
| Admin Components (CMS) | `http://localhost:3000/admin/components` |

Output au user un tableau récapitulatif + status HTTP de chaque endpoint (curl quick check).

**Gate P8** : build prod réussi, server up, tous les endpoints listés répondent (200 pour public, 302/200 pour admin).

---

## Rollback strategy

Si un gate échoue :
- P1-P4 : fichiers sont indépendants, supprimer les nouveaux fichiers + revert `/admin/settings/page.tsx`.
- P5 : la migration est idempotente, pas de rollback nécessaire.
- P8 : si build prod échoue, dump l'erreur et revenir en dev.

Toute mutation DB est **versionnée et auditée** ; un rollback explicite via l'UI nouvelle = 1 click.
