// @vitest-environment node
/**
 * Module 06 — CRUD templates custom + versioning + garde-fou de suppression
 * (template référencé par une automation) + route starters.
 *
 * TPL-STA-001 (starters), versioning DB, garde-fou DELETE (A-DEL-1, bug corrigé
 * cette vague : DELETE supprimait silencieusement un template encore câblé).
 *
 * Vraie-DB : `describeEmailsDb` pour le skip honnête (run global sans DB), init
 * lazy de `emailsTestDb()` dans les hooks, `truncateEmailTables()` en beforeEach.
 *
 * Le code applicatif (`queries.ts`, route DELETE) lit `db()` de @/lib/db/client
 * → `DATABASE_URL` (positionné par le lanceur sur femiglow_test_m06templates).
 * On lit/seed via `emailsTestDb()` (même DB) pour les oracles.
 *
 * Lancement :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_m06templates#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *       src/lib/mail/templates/custom/__qa__/templates-crud.integration.test.ts
 */
import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import {
  closeTestDb,
  describeEmailsDb,
  emailsTestDb,
  truncateEmailTables,
} from '@/test/db/emails-db';
import {
  emailAutomation,
  emailTemplateCustom,
  emailTemplateCustomVersion,
} from '@/lib/db/schema-emails';
import { makeEmailAutomation } from '@/test/factories/emails.factory';
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  findAutomationsUsingTemplate,
  getTemplateById,
  listVersions,
  saveTemplateVersion,
} from '@/lib/mail/templates/custom/queries';

// requireAdmin lit un cookie de session — on le mocke pour exercer la route
// DELETE hors d'un vrai contexte Next.
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(async () => ({ email: 'imane@femiglow-maroc.com', role: 'admin' })),
  getAdminSession: vi.fn(async () => ({ email: 'imane@femiglow-maroc.com', role: 'admin' })),
}));

const ACTOR = 'imane@femiglow-maroc.com';

async function seedTemplate(slug: string) {
  return createTemplate(
    {
      slug,
      name: `Template ${slug}`,
      subjectTmpl: 'Bonjour {{firstName}}',
      htmlSource: '<!doctype html><html><body><p>Bonjour {{firstName}}</p></body></html>',
    },
    ACTOR,
  );
}

beforeEach(async () => {
  await truncateEmailTables();
});

afterAll(async () => {
  await closeTestDb();
});

// ── Création + versioning ────────────────────────────────────────────────
describeEmailsDb('Module 06 — CRUD & versioning templates (vraie DB)', () => {
  it('TPL-DB-CREATE : createTemplate crée le template + version initiale v1', async () => {
    const row = await seedTemplate('promo-aid');
    expect(row.slug).toBe('promo-aid');

    const db = emailsTestDb();
    const versions = await db
      .select()
      .from(emailTemplateCustomVersion)
      .where(eq(emailTemplateCustomVersion.templateId, row.id));
    expect(versions).toHaveLength(1);
    expect(versions[0]!.versionNumber).toBe(1);
    expect(versions[0]!.commitMessage).toBe('Initial version');
  });

  it('TPL-DB-VERSION : saveTemplateVersion incrémente, miroite le parent, fixe activeVersionId', async () => {
    const tpl = await seedTemplate('promo-aid');

    const v2 = await saveTemplateVersion(
      tpl.id,
      {
        subjectTmpl: 'Offre Aïd -30% {{firstName}}',
        htmlSource: '<!doctype html><html><body><strong>-30%</strong></body></html>',
        commitMessage: 'Aïd',
      },
      ACTOR,
    );
    expect(v2.versionNumber).toBe(2);

    // Le parent reflète la dernière version + pointe dessus.
    const parent = await getTemplateById(tpl.id);
    expect(parent!.subjectTmpl).toBe('Offre Aïd -30% {{firstName}}');
    expect(parent!.activeVersionId).toBe(v2.id);

    // listVersions est trié desc (v2 avant v1).
    const versions = await listVersions(tpl.id);
    expect(versions.map((v) => v.versionNumber)).toEqual([2, 1]);
  });

  it('TPL-DB-ROLLBACK : restaurer = recréer une version à partir du contenu d’une ancienne', async () => {
    const tpl = await seedTemplate('promo-aid');
    const original = tpl.htmlSource;
    // v2 modifie.
    await saveTemplateVersion(
      tpl.id,
      { subjectTmpl: 'v2', htmlSource: '<!doctype html><html><body><p>v2</p></body></html>' },
      ACTOR,
    );
    // Rollback applicatif = sauver une v3 avec le contenu de v1.
    const v3 = await saveTemplateVersion(
      tpl.id,
      { subjectTmpl: 'Bonjour {{firstName}}', htmlSource: original, commitMessage: 'rollback v1' },
      ACTOR,
    );
    expect(v3.versionNumber).toBe(3);
    const parent = await getTemplateById(tpl.id);
    // Le parent est revenu au contenu d'origine, sans perdre l'historique.
    expect(parent!.htmlSource).toBe(original);
    expect((await listVersions(tpl.id)).map((v) => v.versionNumber)).toEqual([3, 2, 1]);
  });

  it('TPL-DB-DELETE-SOFT : suppression d’un template NON utilisé → soft-delete, invisible', async () => {
    const tpl = await seedTemplate('orphelin');
    const ok = await deleteTemplate(tpl.id);
    expect(ok).toBe(true);
    // getTemplateById filtre deletedAt → introuvable.
    expect(await getTemplateById(tpl.id)).toBeNull();
  });
});

// ── Garde-fou de suppression : template référencé par une automation ──────
describeEmailsDb('Module 06 — garde-fou DELETE template référencé (A-DEL-1)', () => {
  async function seedAutomationSending(slug: string, opts: { active: boolean; branch?: boolean }) {
    const db = emailsTestDb();
    const steps = opts.branch
      ? [
          {
            kind: 'branch',
            condition: { op: 'and', rules: [] },
            ifTrue: [{ kind: 'send', template: slug }],
            ifFalse: [],
          },
        ]
      : [{ kind: 'send', template: slug }];
    const auto = makeEmailAutomation({
      slug: `auto-${slug}`,
      name: `Automation ${slug}`,
      active: opts.active,
      steps,
    });
    await db.insert(emailAutomation).values(auto);
    return auto;
  }

  it('TPL-DEL-GUARD-detect : findAutomationsUsingTemplate repère un step send direct', async () => {
    await seedTemplate('promo-aid');
    await seedAutomationSending('promo-aid', { active: true });
    const refs = await findAutomationsUsingTemplate('promo-aid');
    expect(refs).toHaveLength(1);
    expect(refs[0]!.slug).toBe('auto-promo-aid');
    expect(refs[0]!.active).toBe(true);
  });

  it('TPL-DEL-GUARD-branch : référence imbriquée dans une branche est détectée', async () => {
    await seedTemplate('promo-aid');
    await seedAutomationSending('promo-aid', { active: false, branch: true });
    const refs = await findAutomationsUsingTemplate('promo-aid');
    expect(refs).toHaveLength(1);
  });

  it('TPL-DEL-GUARD-none : un template non référencé n’est bloqué par aucune automation', async () => {
    await seedTemplate('promo-aid');
    // Automation qui envoie un AUTRE template.
    await seedAutomationSending('autre-template', { active: true });
    expect(await findAutomationsUsingTemplate('promo-aid')).toHaveLength(0);
  });

  it('TPL-DEL-GUARD-route : DELETE refuse (409) un template encore câblé, ne soft-delete PAS', async () => {
    const { DELETE } = await import('@/app/api/admin/emails/templates/[id]/route');
    const tpl = await seedTemplate('promo-aid');
    await seedAutomationSending('promo-aid', { active: true });

    const res = await DELETE(new Request('http://t/x', { method: 'DELETE' }), {
      params: { id: tpl.id },
    });
    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: string; automations: Array<{ slug: string }> };
    expect(json.error).toMatch(/utilisé par/i);
    expect(json.automations.map((a) => a.slug)).toContain('auto-promo-aid');

    // ORACLE FORT : le template n'a PAS été supprimé (toujours visible).
    expect(await getTemplateById(tpl.id)).not.toBeNull();
  });

  it('TPL-DEL-GUARD-route-ok : DELETE autorise (200) un template non référencé', async () => {
    const { DELETE } = await import('@/app/api/admin/emails/templates/[id]/route');
    const tpl = await seedTemplate('promo-aid');
    await seedAutomationSending('autre-template', { active: true });

    const res = await DELETE(new Request('http://t/x', { method: 'DELETE' }), {
      params: { id: tpl.id },
    });
    expect(res.status).toBe(200);
    expect(await getTemplateById(tpl.id)).toBeNull();
  });
});

// ── Duplication (F07 P3.4-l, Lot 6) ──────────────────────────────────────
describeEmailsDb('Module 06 — duplication de template (vraie DB)', () => {
  it('TPL-DUP-content : copie le contenu courant, slug dérivé libre, nom « (copie) »', async () => {
    const src = await seedTemplate('bienvenue');
    const copy = await duplicateTemplate(src.id, ACTOR);
    expect(copy).not.toBeNull();
    expect(copy!.slug).toBe('bienvenue-copie');
    expect(copy!.name).toBe('Template bienvenue (copie)');
    expect(copy!.subjectTmpl).toBe(src.subjectTmpl);
    expect(copy!.htmlSource).toBe(src.htmlSource);
    // Identité distincte (ce n'est pas un alias).
    expect(copy!.id).not.toBe(src.id);
  });

  it('TPL-DUP-history : la copie repart d’un historique propre (v1 « Initial version »)', async () => {
    const src = await seedTemplate('bienvenue');
    // La source gagne une v2 — la copie NE doit PAS l'hériter.
    await saveTemplateVersion(src.id, { subjectTmpl: 'v2', htmlSource: '<p>v2</p>' }, ACTOR);
    const copy = await duplicateTemplate(src.id, ACTOR);
    const versions = await listVersions(copy!.id);
    expect(versions.map((v) => v.versionNumber)).toEqual([1]);
    expect(versions[0]!.commitMessage).toBe('Initial version');
  });

  it('TPL-DUP-dedup : dupliquer 2× incrémente le suffixe sans collision', async () => {
    const src = await seedTemplate('bienvenue');
    const c1 = await duplicateTemplate(src.id, ACTOR);
    const c2 = await duplicateTemplate(src.id, ACTOR);
    expect(c1!.slug).toBe('bienvenue-copie');
    expect(c2!.slug).toBe('bienvenue-copie-2');
  });

  it('TPL-DUP-deleted : un slug SOFT-DELETED occupe quand même la dédup (unicité globale)', async () => {
    const src = await seedTemplate('bienvenue');
    const c1 = await duplicateTemplate(src.id, ACTOR);
    await deleteTemplate(c1!.id); // soft-delete de bienvenue-copie
    // La 2e copie NE réutilise PAS le slug supprimé (contrainte unique globale).
    const c2 = await duplicateTemplate(src.id, ACTOR);
    expect(c2!.slug).toBe('bienvenue-copie-2');
  });

  it('TPL-DUP-404 : dupliquer un id inconnu → null', async () => {
    expect(await duplicateTemplate('00000000-0000-0000-0000-000000000000', ACTOR)).toBeNull();
  });

  it('TPL-DUP-route : POST /duplicate renvoie 201 + la copie ; 404 si introuvable', async () => {
    const { POST } = await import('@/app/api/admin/emails/templates/[id]/duplicate/route');
    const src = await seedTemplate('bienvenue');

    const ok = await POST(new Request('http://t/x', { method: 'POST' }), {
      params: { id: src.id },
    });
    expect(ok.status).toBe(201);
    const created = (await ok.json()) as { id: string; slug: string };
    expect(created.slug).toBe('bienvenue-copie');
    expect(await getTemplateById(created.id)).not.toBeNull();

    const ko = await POST(new Request('http://t/x', { method: 'POST' }), {
      params: { id: '00000000-0000-0000-0000-000000000000' },
    });
    expect(ko.status).toBe(404);
  });
});

// ── Route starters (TPL-STA-001) ─────────────────────────────────────────
// Guardé `describeEmailsDb` car le `beforeEach(truncateEmailTables)` du fichier
// s'applique aussi ici : sans DB de test, le run global doit SKIP, pas crasher.
describeEmailsDb('Module 06 — route starters (TPL-STA-001)', () => {
  it('TPL-STA-001 : GET /starters renvoie default-femiglow avec un htmlSource non vide', async () => {
    const { GET } = await import('@/app/api/admin/emails/templates/starters/route');
    const res = await GET();
    const list = (await res.json()) as Array<{ id: string; htmlSource: string }>;
    const def = list.find((s) => s.id === 'default-femiglow');
    expect(def).toBeDefined();
    expect(def!.htmlSource.length).toBeGreaterThan(100);
    expect(def!.htmlSource).toMatch(/FemiGlow/i);
  });
});
