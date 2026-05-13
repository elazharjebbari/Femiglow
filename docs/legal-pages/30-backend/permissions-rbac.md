# 30.6 — RBAC : permissions

## Modèle

FemiGlow a un système RBAC simple basé sur `admin_users.role`. Pour les
pages légales, on étend avec des permissions fines :

| Permission | Description | Default role |
|---|---|---|
| `legal.read` | Voir les pages (admin) | admin, manager, viewer |
| `legal.write` | Créer / modifier draft | admin, manager |
| `legal.submit_review` | Soumettre à revue | admin, manager |
| `legal.publish` | Publier (status='published') | admin |
| `legal.archive` | Archiver (soft delete) | admin |
| `legal.delete_hard` | Hard delete (jamais utilisé) | superadmin (réservé) |
| `legal.template_vars.write` | Modifier les variables (RC, ICE) | admin |
| `legal.placements.write` | Modifier la matrice page × zone | admin, manager |
| `legal.health.read` | Voir le dashboard santé | admin, manager, viewer |
| `legal.git.recovery` | Restore depuis git | admin |

## Application au niveau API

```typescript
// app/api/admin/legal/[slug]/publish/route.ts
import { requirePermission } from '@/lib/auth/permissions';

export async function POST(req, { params }) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  await requirePermission(session, 'legal.publish');

  // Logic...
}
```

## Workflow contraintes

### Submit review

```typescript
async function submitReview(slug, adminId) {
  await requirePermission(adminId, 'legal.submit_review');
  const page = await db.legalPages.findBySlug(slug);
  if (page.status !== 'draft' && page.status !== 'published') {
    throw new InvalidStateError(`Cannot submit from status '${page.status}'`);
  }
  // Update status to 'review' + audit
}
```

### Publish

```typescript
async function publish(slug, adminId, confirm) {
  await requirePermission(adminId, 'legal.publish');

  const page = await db.legalPages.findBySlug(slug);
  if (page.status !== 'review' && page.status !== 'draft') {
    throw new InvalidStateError();
  }

  // Optional rule : reviewer != submitter (4-eyes principle)
  // V1 : pas appliqué (single admin OK)
  // V2 : if (page.submitted_by === adminId) throw new SameReviewerError();

  // ...
}
```

## UI feedback

L'UI affiche/masque les boutons selon les permissions :

```tsx
const { permissions } = useAdminSession();

return (
  <div>
    {permissions.has('legal.write') && <button>Modifier</button>}
    {permissions.has('legal.submit_review') && page.status === 'draft' && (
      <button>Soumettre à revue</button>
    )}
    {permissions.has('legal.publish') && page.status === 'review' && (
      <button>Publier</button>
    )}
    {!permissions.has('legal.publish') && page.status === 'review' && (
      <p className="text-amber-700">En attente de publication par un admin</p>
    )}
  </div>
);
```

## Audit

Toutes les actions privilégiées sont auditées (cf. versioning-strategy.md).

## Tests

```typescript
test('viewer cannot publish a page', async () => {
  const viewerSession = await loginAs('viewer');
  const res = await fetch('/api/admin/legal/cgv/publish', {
    method: 'POST',
    body: JSON.stringify({ confirm: 'PUBLIER' }),
    headers: { Cookie: viewerSession },
  });
  expect(res.status).toBe(403);
});

test('admin can publish a page', async () => {
  const adminSession = await loginAs('admin');
  // ...
});
```

## Évolution V2

- Workflow 4-eyes : reviewer ≠ submitter obligatoire
- Notifications email aux co-admins lors d'un submit review
- Lock optimiste : `If-Match` ETag pour éviter race conditions sur édition
  concurrente
