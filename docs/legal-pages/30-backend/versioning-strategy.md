# 30.5 — Stratégie de versioning

## Concept

Toute publication d'une page légale crée une nouvelle **version** immutable.
L'historique est traçable en DB ET en git.

## Niveau 1 — Versioning DB

### Sur publish

```typescript
async function publishPage(slug, adminId, confirm) {
  if (confirm !== 'PUBLIER') throw new Error('Confirm mismatch');

  return await db.transaction(async (tx) => {
    // 1. Lock the row
    const current = await tx.legalPages.findBySlugForUpdate(slug);
    if (!current) throw new NotFoundError();

    // 2. Validate template vars (no missing)
    const missing = await detectMissingVars(current.body_md, tx);
    if (missing.length > 0) {
      throw new ValidationError('missing_required_vars', missing);
    }

    // 3. Increment version + transition status
    const newVersion = current.version + 1;
    const now = new Date();
    await tx.legalPages.update(slug, {
      status: 'published',
      version: newVersion,
      published_at: now,
      published_by: adminId,
      updated_at: now,
      updated_by: adminId,
    });

    // 4. Snapshot in history (IMMUTABLE)
    await tx.legalPagesHistory.insert({
      id: createId('lph'),
      page_id: current.id,
      slug: current.slug,
      version: newVersion,
      title: current.title,
      description: current.description,
      body_md: current.body_md,
      metadata_json: {
        canonical_url: current.canonical_url,
        include_in_search: current.include_in_search,
      },
      status_at_snapshot: 'published',
      published_at: now,
      published_by: adminId,
    });

    // 5. Audit log
    await tx.auditEvents.insert({
      action: 'legal.published',
      actor_id: adminId,
      resource_type: 'legal_page',
      resource_id: current.id,
      meta: { slug, version: newVersion },
    });

    // 6. Enqueue git commit (async, non-blocking)
    void enqueueGitCommit(slug, newVersion);

    return { slug, version: newVersion, published_at: now };
  });
}
```

### Restore d'une version

```typescript
async function restoreVersion(slug, version, adminId) {
  const historyEntry = await db.legalPagesHistory.findOne({ slug, version });
  if (!historyEntry) throw new NotFoundError();

  // Restore = create new draft from historical content
  await db.legalPages.update(slug, {
    body_md: historyEntry.body_md,
    title: historyEntry.title,
    description: historyEntry.description,
    status: 'draft',  // restore = revert to draft, l'admin re-publie
    updated_at: new Date(),
    updated_by: adminId,
  });

  await db.auditEvents.insert({
    action: 'legal.restored',
    actor_id: adminId,
    meta: { slug, restored_version: version },
  });
}
```

## Niveau 2 — Versioning git (sync auto)

### Branche dédiée

Branche `legal-versions` créée manuellement au démarrage. JAMAIS mergée
dans `master`.

```bash
git checkout -b legal-versions
git push -u origin legal-versions
git checkout master  # back to dev
```

### Job background

```typescript
// lib/legal/git-sync.ts
import { simpleGit } from 'simple-git';

const TMP_DIR = '/tmp/femiglow-legal-versions';

async function enqueueGitCommit(slug: string, version: number) {
  // Run async in background — don't block API response
  setImmediate(async () => {
    try {
      await commitToLegalVersionsBranch(slug, version);
    } catch (err) {
      console.error('git-sync failed', err);
      await alertGitSyncFailure(slug, version, err);
    }
  });
}

async function commitToLegalVersionsBranch(slug: string, version: number) {
  const page = await db.legalPages.findBySlug(slug);
  if (!page) throw new Error('page not found');

  const repo = await ensureCloneFresh();
  const filePath = `${repo}/content/legal/${slug}.v${version}.md`;
  await fs.writeFile(filePath, formatMdWithFrontMatter(page));

  const git = simpleGit(repo);
  await git.add(filePath);
  await git.commit(
    `[legal] publish ${slug} v${version}\n\n` +
    `Slug:    ${slug}\n` +
    `Version: ${version} (previous: ${version - 1})\n` +
    `Status:  → published\n` +
    `Date:    ${new Date().toISOString()}\n`,
  );
  await git.push('origin', 'legal-versions');

  // Update history with commit sha
  const sha = await git.revparse(['HEAD']);
  await db.legalPagesHistory.update(
    { slug, version },
    { git_commit_sha: sha, git_commit_at: new Date() },
  );
}

async function ensureCloneFresh() {
  // Lazy clone or fetch latest
  if (!await fs.exists(TMP_DIR)) {
    await simpleGit().clone(REPO_URL, TMP_DIR, ['--branch', 'legal-versions']);
  } else {
    const git = simpleGit(TMP_DIR);
    await git.fetch();
    await git.checkout('legal-versions');
    await git.pull();
  }
  return TMP_DIR;
}

function formatMdWithFrontMatter(page: LegalPage): string {
  return `---
slug: ${page.slug}
version: ${page.version}
title: ${JSON.stringify(page.title)}
description: ${JSON.stringify(page.description ?? '')}
include_in_search: ${page.include_in_search}
canonical_url: ${page.canonical_url ?? ''}
published_at: ${page.published_at?.toISOString()}
published_by: ${page.published_by}
---

${page.body_md}
`;
}
```

### Authentication git

Option A — SSH key dédié :
- Generate key `femiglow-legal-sync` (no passphrase)
- Deploy key sur GitHub (write access only to `legal-versions` branch via branch protection)
- Path : `/etc/femiglow/.ssh/legal-sync_id_rsa`

Option B — Personal Access Token (PAT) :
- Token scope `repo` mais limité via Branch Protection Rules
- Stocké en env `LEGAL_GIT_TOKEN`

Option C — GitHub App :
- App dédiée avec permissions précises
- Plus complexe, mais le plus sûr en multi-admin

Recommandation MVP : **Option A** (simple, suffisant pour la phase actuelle).

### Recovery depuis git

Si DB est perdue :

```bash
git clone <repo> --branch legal-versions /tmp/recovery
pnpm tsx scripts/restore-legal-from-git.ts /tmp/recovery
```

Le script :
1. Lit `/tmp/recovery/content/legal/*.md`
2. Pour chaque slug, prend la **version la plus haute**
3. Reconstruit `legal_pages` (status='published') + `legal_pages_history`

## Niveau 3 — Audit trail

Toutes les actions sont loggées dans `audit_events` :
- `legal.created` : nouvelle page créée
- `legal.updated` : draft modifié
- `legal.review.submitted` : passé en review
- `legal.published` : publié
- `legal.archived` : archivé
- `legal.restored` : restore d'une ancienne version
- `legal.git.committed` : commit git auto réussi
- `legal.git.failed` : commit git échoué (alerte)

Format :
```json
{
  "id": "ae_xxx",
  "action": "legal.published",
  "actor_id": "u_admin1",
  "resource_type": "legal_page",
  "resource_id": "lp_xxx",
  "meta": {
    "slug": "cgv",
    "version": 3,
    "previous_version": 2
  },
  "created_at": "2026-05-13T14:32:00.000Z"
}
```

## Tests

```typescript
describe('publishPage', () => {
  it('increments version and creates history snapshot', async () => {
    const initial = await db.legalPages.findBySlug('cgv');
    expect(initial.version).toBe(1);

    await publishPage('cgv', adminId, 'PUBLIER');

    const after = await db.legalPages.findBySlug('cgv');
    expect(after.version).toBe(2);

    const history = await db.legalPagesHistory.findAll({ slug: 'cgv' });
    expect(history).toHaveLength(1);
    expect(history[0].version).toBe(2);
  });

  it('rejects publish with missing required vars', async () => {
    await db.legalPages.update('cgv', {
      body_md: 'Hello {{MISSING_VAR}}',
    });

    await expect(publishPage('cgv', adminId, 'PUBLIER')).rejects.toThrow(
      'missing_required_vars',
    );
  });

  it('rejects publish without confirm text', async () => {
    await expect(publishPage('cgv', adminId, 'wrong')).rejects.toThrow(
      'Confirm mismatch',
    );
  });
});
```
