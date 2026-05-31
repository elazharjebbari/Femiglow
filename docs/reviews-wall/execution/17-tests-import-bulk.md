# 17 — Tests : import et bulk management

Catalogue spécifique des tests pour le système d'import et la gestion bulk. Complète les catalogues `08-tests-jest.md`, `09-tests-msw.md`, `10-tests-playwright.md` en se concentrant sur les nouvelles fonctionnalités.

## 1. Vue d'ensemble

| Niveau | Périmètre | Fichiers |
| --- | --- | --- |
| Jest unit | Parsers, validators, mappers, sanitization import | 9 fichiers de test |
| Jest queries DB | Insert/list batches, rows, temp media | 1 fichier |
| MSW integration | Wizard import 6 étapes + bulk actions | 2 fichiers |
| Playwright E2E | Import complet CSV / ZIP + bulk workflow | 3 fichiers |

Cible : **~80 nouveaux tests** au total.

## 2. Tests Jest unitaires — parsers

### 2.1 `csv-parser.ts`

`apps/web/src/lib/rituals/import/parser/__tests__/csv-parser.test.ts` :

```ts
describe('parseCSV', () => {
  it('parse un CSV minimal avec headers', async () => {
    const csv = 'body;wouldRecommend\n"Trois mois...";oui';
    const rows = await parseCSV(csv, { separator: ';' });
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toBe('Trois mois...');
  });

  it('gère les sauts de ligne dans une cellule quotée', async () => {
    const csv = 'body;wouldRecommend\n"Ligne 1\nLigne 2";oui';
    const rows = await parseCSV(csv, { separator: ';' });
    expect(rows[0].body).toContain('\n');
  });

  it('gère les doubles guillemets dans une cellule', async () => {
    const csv = 'body;wouldRecommend\n"Il dit ""bonjour""";oui';
    const rows = await parseCSV(csv, { separator: ';' });
    expect(rows[0].body).toBe('Il dit "bonjour"');
  });

  it('accepte BOM UTF-8', async () => {
    const csv = '﻿body;wouldRecommend\n"a";oui';
    const rows = await parseCSV(csv, { separator: ';' });
    expect(rows[0].body).toBe('a');
  });

  it('rejette encodage Latin-1', async () => {
    const buffer = Buffer.from('body;wouldRecommend\né;oui', 'latin1');
    await expect(parseCSV(buffer, { separator: ';' })).rejects.toThrow(/UTF-8/);
  });

  it('lit en streaming pour gros fichiers', async () => {
    const rows = generateLargeCSV(500);
    const csv = ['body;wouldRecommend', ...rows].join('\n');
    const collected = [];
    await parseCSV(csv, { separator: ';', onRow: (row) => { collected.push(row); } });
    expect(collected).toHaveLength(500);
  });

  it('détecte automatiquement le séparateur', async () => {
    const csv = 'body,wouldRecommend\n"a",oui';
    const rows = await parseCSV(csv, { separator: 'auto' });
    expect(rows).toHaveLength(1);
  });

  it('rejette si > 500 rows', async () => {
    const csv = generateLargeCSV(501);
    await expect(parseCSV(csv, { separator: ';' })).rejects.toThrow(/maximum 500/);
  });
});
```

### 2.2 `json-parser.ts`

```ts
describe('parseJSON', () => {
  it('parse un array racine', async () => {
    const json = '[{"body":"a","wouldRecommend":"oui"}]';
    const rows = await parseJSON(json);
    expect(rows).toHaveLength(1);
  });

  it('parse un objet racine avec clé rituals', async () => {
    const json = '{"version":1,"rituals":[{"body":"a","wouldRecommend":"oui"}]}';
    const rows = await parseJSON(json);
    expect(rows).toHaveLength(1);
  });

  it('rejette JSON malformé', async () => {
    await expect(parseJSON('{invalid')).rejects.toThrow();
  });

  it('rejette si > 500 entries', async () => {
    const arr = Array(501).fill({ body: 'a'.repeat(50), wouldRecommend: 'oui' });
    await expect(parseJSON(JSON.stringify(arr))).rejects.toThrow(/maximum 500/);
  });
});

describe('parseJSONL', () => {
  it('parse ligne par ligne', async () => {
    const jsonl = '{"body":"a","wouldRecommend":"oui"}\n{"body":"b","wouldRecommend":"non"}';
    const rows = await parseJSONL(jsonl);
    expect(rows).toHaveLength(2);
  });

  it('ignore les lignes vides', async () => {
    const jsonl = '{"body":"a","wouldRecommend":"oui"}\n\n\n{"body":"b","wouldRecommend":"non"}\n';
    const rows = await parseJSONL(jsonl);
    expect(rows).toHaveLength(2);
  });

  it('marque les lignes malformées en erreur', async () => {
    const jsonl = '{"body":"a","wouldRecommend":"oui"}\n{invalid}\n{"body":"b","wouldRecommend":"non"}';
    const rows = await parseJSONL(jsonl);
    expect(rows).toHaveLength(3);
    expect(rows[1].parseError).toBeDefined();
  });
});
```

### 2.3 `zip-parser.ts`

```ts
describe('parseZIP', () => {
  it('extrait manifest CSV + photos', async () => {
    const zipBuffer = await createTestZip({
      'rituels.csv': 'body;wouldRecommend;photos\n"a";oui;p1.jpg',
      'photos/p1.jpg': await fs.readFile('fixtures/sample-hand.jpg'),
    });
    const result = await parseZIP(zipBuffer);
    expect(result.rows).toHaveLength(1);
    expect(result.media).toHaveLength(1);
    expect(result.media[0].filename).toBe('p1.jpg');
  });

  it('rejette path traversal (../../etc/passwd)', async () => {
    const zipBuffer = await createTestZip({ '../../etc/passwd': 'malicious' });
    await expect(parseZIP(zipBuffer)).rejects.toThrow(/invalid path/);
  });

  it('rejette filenames hors whitelist', async () => {
    const zipBuffer = await createTestZip({ 'photos/script.sh': 'evil' });
    const result = await parseZIP(zipBuffer);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'invalid_filename' }));
  });

  it('marque les photos orphelines', async () => {
    const zipBuffer = await createTestZip({
      'rituels.csv': 'body;wouldRecommend\n"a";oui',
      'photos/orphan.jpg': await fs.readFile('fixtures/sample-hand.jpg'),
    });
    const result = await parseZIP(zipBuffer);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'orphan_media', filename: 'orphan.jpg' }));
  });

  it('rejette ZIP > 50 Mo', async () => {
    const bigBuffer = await createTestZip({ 'big.bin': Buffer.alloc(51 * 1024 * 1024) });
    await expect(parseZIP(bigBuffer)).rejects.toThrow(/50 Mo/);
  });

  it('rejette > 1500 entries', async () => {
    const entries = {};
    for (let i = 0; i < 1501; i++) entries[`photos/p${i}.jpg`] = Buffer.alloc(100);
    await expect(parseZIP(await createTestZip(entries))).rejects.toThrow(/1500/);
  });
});
```

## 3. Tests Jest — mapper et validator

### 3.1 `mapper.ts`

```ts
describe('applyMapping', () => {
  it('applique mapping simple', () => {
    const row = { 'Témoignage': 'a', 'Recommandation': 'oui' };
    const mapping = { 'Témoignage': 'body', 'Recommandation': 'wouldRecommend' };
    const result = applyMapping(row, mapping);
    expect(result).toEqual({ body: 'a', wouldRecommend: 'oui' });
  });

  it('ignore les colonnes mappées sur null', () => {
    const row = { 'Note': 'ignore me', 'body': 'a' };
    const mapping = { 'Note': null, 'body': 'body' };
    const result = applyMapping(row, mapping);
    expect(result).toEqual({ body: 'a' });
  });

  it('applique synonymes wouldRecommend', () => {
    const row = { body: 'a', wouldRecommend: 'Oui, sans hésiter' };
    const result = applyMapping(row, identityMapping());
    expect(result.wouldRecommend).toBe('oui');
  });

  it('applique défauts', () => {
    const row = { body: 'a' };
    const result = applyMapping(row, identityMapping(), { defaults: { productKey: 'pack-femiglow' } });
    expect(result.productKey).toBe('pack-femiglow');
  });

  it('parse tags séparés par , ou ;', () => {
    expect(applyMapping({ ritualTags: 'a,b,c' }, identityMapping()).ritualTags).toEqual(['a', 'b', 'c']);
    expect(applyMapping({ ritualTags: 'a;b;c' }, identityMapping()).ritualTags).toEqual(['a', 'b', 'c']);
  });

  it('parse photos séparés par , ou ;', () => {
    expect(applyMapping({ photos: 'p1.jpg,p2.jpg' }, identityMapping()).photos).toEqual(['p1.jpg', 'p2.jpg']);
  });

  it('détecte auto-mapping si en-têtes canoniques', () => {
    const headers = ['body', 'wouldRecommend', 'authorFirstName'];
    const mapping = autoDetectMapping(headers);
    expect(mapping).toEqual({
      'body': 'body',
      'wouldRecommend': 'wouldRecommend',
      'authorFirstName': 'authorFirstName',
    });
  });

  it('reconnaît les en-têtes en français', () => {
    const headers = ['Prénom', 'Ville', 'Témoignage', 'Recommandation'];
    const mapping = autoDetectMapping(headers);
    expect(mapping['Prénom']).toBe('authorFirstName');
    expect(mapping['Ville']).toBe('authorCity');
    expect(mapping['Témoignage']).toBe('body');
    expect(mapping['Recommandation']).toBe('wouldRecommend');
  });
});
```

### 3.2 `row-validator.ts`

```ts
describe('validateRow', () => {
  it('VALID si tous les champs OK', async () => {
    const row = { body: 'a'.repeat(60), wouldRecommend: 'oui' };
    const result = await validateRow(row);
    expect(result.status).toBe('VALID');
    expect(result.errors).toEqual([]);
  });

  it('ERROR si body trop court', async () => {
    const row = { body: 'court', wouldRecommend: 'oui' };
    const result = await validateRow(row);
    expect(result.status).toBe('ERROR');
    expect(result.errors).toContainEqual(expect.objectContaining({ code: 'body_too_short' }));
  });

  it('ERROR si wouldRecommend manquant', async () => {
    const row = { body: 'a'.repeat(60) };
    const result = await validateRow(row);
    expect(result.errors).toContainEqual(expect.objectContaining({ field: 'wouldRecommend' }));
  });

  it('WARNING si tag inconnu', async () => {
    const row = { body: 'a'.repeat(60), wouldRecommend: 'oui', ritualTags: ['unknown-tag'] };
    const result = await validateRow(row);
    expect(result.status).toBe('WARNING');
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'tag_unknown' }));
  });

  it('WARNING si ville inconnue (mappée Autre)', async () => {
    const row = { body: 'a'.repeat(60), wouldRecommend: 'oui', authorCity: 'Bordeaux' };
    const result = await validateRow(row);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'city_unknown' }));
  });

  it('WARNING si initiatedSince mal formé', async () => {
    const row = { body: 'a'.repeat(60), wouldRecommend: 'oui', initiatedSince: '2026/02' };
    const result = await validateRow(row);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'date_normalized' }));
  });

  it('ERROR si > 3 tags', async () => {
    const row = { body: 'a'.repeat(60), wouldRecommend: 'oui', ritualTags: ['a', 'b', 'c', 'd'] };
    const result = await validateRow(row);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'tags_truncated' }));
  });

  it('applique sanitization au body', async () => {
    const row = { body: 'Super 😊 test ' + 'a'.repeat(80), wouldRecommend: 'oui' };
    const result = await validateRow(row);
    expect(result.normalizedRow.body).not.toContain('😊');
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'emoji_stripped' }));
  });

  it('détecte auto-flags', async () => {
    const row = { body: 'Visitez https://spam.fr ' + 'a'.repeat(80), wouldRecommend: 'oui' };
    const result = await validateRow(row);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'link_external' }));
  });
});
```

## 4. Tests Jest — duplicate detector

```ts
describe('detectDuplicates', () => {
  it('marque les rows identiques (intra-batch)', () => {
    const rows = [
      { body: 'a'.repeat(60), wouldRecommend: 'oui' },
      { body: 'a'.repeat(60), wouldRecommend: 'oui' },
      { body: 'b'.repeat(60), wouldRecommend: 'oui' },
    ];
    const result = detectDuplicatesIntraBatch(rows);
    expect(result[0].isDuplicate).toBe(false);
    expect(result[1].isDuplicate).toBe(true);
    expect(result[2].isDuplicate).toBe(false);
  });

  it('détecte doublons inter-batch via row_hash', async () => {
    await insertRitual({ body: 'a'.repeat(60), wouldRecommend: 'oui', rowHash: 'hash-abc' });
    const newRow = { body: 'a'.repeat(60), wouldRecommend: 'oui' };
    const result = await detectDuplicatesAgainstExisting([newRow]);
    expect(result[0].isDuplicate).toBe(true);
    expect(result[0].duplicateOfTestimonialId).toBeDefined();
  });

  it('row_hash insensible aux espaces et casse du body', () => {
    expect(computeRowHash({ body: 'Trois Mois Et', wouldRecommend: 'oui' }))
      .toBe(computeRowHash({ body: 'trois mois et', wouldRecommend: 'oui' }));
  });
});
```

## 5. Tests Jest — queries DB import

`apps/web/src/lib/db/queries/__tests__/rituals-import.test.ts` :

```ts
describe('createBatch', () => {
  it('crée un batch en status UPLOADING', async () => {
    const batch = await createBatch({ actorId: 'admin-1', filename: 'test.csv', format: 'csv_semicolon' });
    expect(batch.status).toBe('UPLOADING');
  });
});

describe('commitBatch', () => {
  beforeEach(() => truncateTables([...]));

  it('insère N testimonials en PENDING', async () => {
    const batch = await createBatch({ /* ... */ });
    await insertRows(batch.id, rowFixtures(10).map(r => ({ ...r, validationStatus: 'VALID', isIncluded: true })));
    const result = await commitBatch(batch.id, 'admin-1');
    expect(result.totalCommitted).toBe(10);
    const rituals = await db.select().from(ritualTestimonials).where(eq(ritualTestimonials.importBatchId, batch.id));
    expect(rituals).toHaveLength(10);
    expect(rituals.every(r => r.status === 'PENDING')).toBe(true);
  });

  it('skip les rows ERROR', async () => {
    const batch = await createBatch({ /* ... */ });
    await insertRows(batch.id, [
      ...rowFixtures(8, { validationStatus: 'VALID', isIncluded: true }),
      ...rowFixtures(2, { validationStatus: 'ERROR', isIncluded: false }),
    ]);
    const result = await commitBatch(batch.id, 'admin-1');
    expect(result.totalCommitted).toBe(8);
  });

  it('crée audit log par testimonial', async () => {
    const batch = await createBatch({ /* ... */ });
    await insertRows(batch.id, rowFixtures(3, { validationStatus: 'VALID', isIncluded: true }));
    await commitBatch(batch.id, 'admin-1');
    const logs = await db.select().from(ritualAuditLog).where(sql`(payload->>'batch_id')::uuid = ${batch.id}`);
    expect(logs.filter(l => l.action === 'imported')).toHaveLength(3);
  });

  it('rollback complet si erreur transactionnelle', async () => {
    const batch = await createBatch({ /* ... */ });
    // Mock une erreur sur le 5e insert
    vi.spyOn(db, 'insert').mockImplementationOnce(() => { throw new Error('DB error'); });
    await expect(commitBatch(batch.id, 'admin-1')).rejects.toThrow();
    const rituals = await db.select().from(ritualTestimonials).where(eq(ritualTestimonials.importBatchId, batch.id));
    expect(rituals).toHaveLength(0); // tout rollback
  });
});

describe('rollbackBatch', () => {
  it('passe les testimonials en HIDDEN', async () => {
    const batch = await createCommittedBatch(5);
    await rollbackBatch(batch.id, 'admin-1', 'test reason');
    const rituals = await db.select().from(ritualTestimonials).where(eq(ritualTestimonials.importBatchId, batch.id));
    expect(rituals.every(r => r.status === 'HIDDEN')).toBe(true);
  });

  it('rejette si > 24 h depuis commit', async () => {
    const batch = await createCommittedBatch(5, { committedAt: new Date(Date.now() - 25 * 3600 * 1000) });
    await expect(rollbackBatch(batch.id, 'admin-1')).rejects.toThrow(/expired/);
  });

  it('rejette si testimonials du batch ont été modifiés depuis', async () => {
    const batch = await createCommittedBatch(5);
    const rituals = await db.select().from(ritualTestimonials).where(eq(ritualTestimonials.importBatchId, batch.id));
    await db.update(ritualTestimonials).set({ status: 'APPROVED' }).where(eq(ritualTestimonials.id, rituals[0].id));
    await expect(rollbackBatch(batch.id, 'admin-1')).rejects.toThrow(/modified/);
  });
});
```

## 6. Tests MSW — wizard import

`apps/web/src/test/msw/handlers/rituals-import.ts` :

```ts
export const importHandlers = {
  templateDownload: [
    http.get('/api/admin/rituals/import/template', ({ request }) => {
      const url = new URL(request.url);
      const format = url.searchParams.get('format');
      return new HttpResponse(
        getTemplateContent(format),
        { headers: { 'Content-Type': mimeFor(format), 'Content-Disposition': `attachment; filename="modele.${format}"` } }
      );
    }),
  ],

  uploadSuccess: [
    http.post('/api/admin/rituals/import/upload', () => {
      return HttpResponse.json({ data: { batchId: 'batch-test-1', status: 'PARSING' } }, { status: 202 });
    }),
  ],

  uploadTooBig: [
    http.post('/api/admin/rituals/import/upload', () => {
      return HttpResponse.json({ error: { code: 'FILE_TOO_BIG', message: 'Le fichier dépasse 5 Mo' } }, { status: 413 });
    }),
  ],

  batchPreviewReady: [
    http.get('/api/admin/rituals/import/:batchId', ({ params }) => {
      return HttpResponse.json({
        data: {
          batch: { id: params.batchId, status: 'PARSED', totalRowsValid: 87, totalRowsWarning: 28, totalRowsError: 8 },
          rows: importRowFixtures(50),
          totalRows: 123,
          page: 1,
        },
      });
    }),
  ],

  commitSuccess: [
    http.post('/api/admin/rituals/import/:batchId/commit', () => {
      return HttpResponse.json({
        data: { batchId: 'batch-test-1', status: 'COMMITTED', totalCommitted: 113, redirectUrl: '/admin/rituals/queue?import_batch_id=...' },
      });
    }),
  ],

  rollbackSuccess: [
    http.post('/api/admin/rituals/import/:batchId/rollback', () => {
      return HttpResponse.json({ data: { rolledBack: 113 } });
    }),
  ],

  bulkRows: [
    http.post('/api/admin/rituals/import/:batchId/bulk-rows', async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({ data: { rowsAffected: body.rowIds?.length ?? 0 } });
    }),
  ],
};
```

### 6.1 Scénarios d'intégration

```ts
describe('Import wizard step 1', () => {
  it('télécharge un modèle CSV', async () => {
    server.use(...importHandlers.templateDownload);
    const { user } = render(<ImportWizard />);
    await user.click(screen.getByText('Télécharger un modèle CSV →'));
    // Vérifier qu'un blob a été déclenché
    // (mock fetch + assert sur l'URL appelée)
    expect(serverHandlerInvocations.GET).toHaveBeenCalledWith(expect.stringContaining('/template?format=csv'));
  });

  it('upload CSV → bascule étape 2', async () => {
    server.use(...importHandlers.uploadSuccess);
    const { user } = render(<ImportWizard />);
    await user.click(screen.getByText('CSV'));
    await user.click(screen.getByText('Continuer'));
    const file = new File(['body;wouldRecommend\n"a";oui'], 'test.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText(/Glisser un fichier/), file);
    await waitFor(() => expect(screen.getByText(/Parsing en cours/)).toBeInTheDocument());
  });

  it('upload trop gros → message d’erreur', async () => {
    server.use(...importHandlers.uploadTooBig);
    const { user } = render(<ImportWizard />);
    await user.click(screen.getByText('CSV'));
    await user.click(screen.getByText('Continuer'));
    const file = new File([new Uint8Array(6 * 1024 * 1024)], 'big.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText(/Glisser un fichier/), file);
    expect(await screen.findByText(/dépasse 5 Mo/)).toBeInTheDocument();
  });
});

describe('Import wizard step 4 preview', () => {
  it('affiche les 4 catégories de rows', async () => {
    server.use(...importHandlers.batchPreviewReady);
    render(<ImportWizardStep4 batchId="batch-test-1" />);
    await waitFor(() => {
      expect(screen.getByText('87 valides')).toBeInTheDocument();
      expect(screen.getByText('28 avertissements')).toBeInTheDocument();
      expect(screen.getByText('8 erreurs')).toBeInTheDocument();
    });
  });

  it('filtre par status Erreurs', async () => {
    server.use(...importHandlers.batchPreviewReady);
    const { user } = render(<ImportWizardStep4 batchId="batch-test-1" />);
    await user.click(screen.getByRole('button', { name: /Erreurs/ }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(8));
  });

  it('bulk exclure toutes les erreurs', async () => {
    server.use(...importHandlers.batchPreviewReady, ...importHandlers.bulkRows);
    const { user } = render(<ImportWizardStep4 batchId="batch-test-1" />);
    await user.click(screen.getByRole('button', { name: /Erreurs/ }));
    await user.click(screen.getByLabelText(/Tout sélectionner/));
    await user.click(screen.getByRole('button', { name: /Exclure/ }));
    await user.click(screen.getByRole('button', { name: /Confirmer/ }));
    await waitFor(() => expect(screen.getByText(/8 rows exclues/)).toBeInTheDocument());
  });

  it('édition inline d’une row → revalidation', async () => {
    server.use(...importHandlers.batchPreviewReady);
    const { user } = render(<ImportWizardStep4 batchId="batch-test-1" />);
    await user.click(screen.getAllByText('Modifier')[0]);
    const bodyTextarea = screen.getByLabelText(/body/);
    await user.clear(bodyTextarea);
    await user.type(bodyTextarea, 'Texte corrigé suffisamment long pour valider, voilà.');
    await user.click(screen.getByText('Sauvegarder'));
    // Vérifier que le statut row passe à VALID
  });
});

describe('Import wizard step 5 commit', () => {
  it('confirmer → status COMMITTED + rapport', async () => {
    server.use(...importHandlers.commitSuccess);
    const { user } = render(<ImportWizardStep5 batchId="batch-test-1" summary={{ totalValid: 113 }} />);
    await user.click(screen.getByLabelText(/Je comprends/));
    await user.click(screen.getByText('Confirmer le commit'));
    expect(await screen.findByText(/Import réussi/)).toBeInTheDocument();
    expect(screen.getByText(/113 rituels/)).toBeInTheDocument();
  });
});

describe('Import wizard step 6 rollback', () => {
  it('rollback double confirmation', async () => {
    server.use(...importHandlers.rollbackSuccess);
    const { user } = render(<ImportWizardStep6 batchId="batch-test-1" />);
    await user.click(screen.getByText('Rollback l’import'));
    await user.fill(screen.getByLabelText(/Raison/), 'Erreur de mapping');
    await user.click(screen.getByLabelText(/Je confirme/));
    await user.click(screen.getByText('Rollback définitif'));
    expect(await screen.findByText(/rolled back/)).toBeInTheDocument();
  });
});
```

## 7. Tests MSW — bulk actions

### 7.1 Handlers bulk

```ts
export const bulkHandlers = {
  approveSuccess: [
    http.post('/api/admin/rituals/bulk-action', async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({
        data: {
          totalProcessed: body.ids.length,
          totalSucceeded: body.ids.length,
          totalFailed: 0,
          skipped: [],
          errors: [],
        },
      });
    }),
  ],

  approveWithSkip: [
    http.post('/api/admin/rituals/bulk-action', async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({
        data: {
          totalProcessed: body.ids.length,
          totalSucceeded: body.ids.length - 2,
          totalFailed: 0,
          totalSkipped: 2,
          skipped: [
            { id: body.ids[0], reason: 'auto_flag_critical' },
            { id: body.ids[1], reason: 'auto_flag_critical' },
          ],
          errors: [],
        },
      });
    }),
  ],

  forbidden: [
    http.post('/api/admin/rituals/bulk-action', () => {
      return HttpResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
    }),
  ],

  limitExceeded: [
    http.post('/api/admin/rituals/bulk-action', () => {
      return HttpResponse.json({ error: { code: 'LIMIT_EXCEEDED', message: 'Maximum 1000 rituals' } }, { status: 400 });
    }),
  ],
};
```

### 7.2 Scénarios bulk

```ts
describe('Bulk action bar', () => {
  it('apparaît dès la première sélection', async () => {
    const { user } = render(<AdminQueuePage />);
    await waitFor(() => expect(screen.queryByText(/sélectionnés/)).not.toBeInTheDocument());
    await user.click(screen.getAllByRole('checkbox')[1]); // skip header checkbox
    expect(screen.getByText('1 rituel sélectionné')).toBeInTheDocument();
  });

  it('shift-click sélectionne un range', async () => {
    const { user } = render(<AdminQueuePage />);
    const checkboxes = screen.getAllByRole('checkbox').slice(1);
    await user.click(checkboxes[0]);
    await user.click(checkboxes[4], { shiftKey: true });
    expect(screen.getByText('5 rituels sélectionnés')).toBeInTheDocument();
  });

  it('bulk approve sans flag critique', async () => {
    server.use(...bulkHandlers.approveSuccess);
    const { user } = render(<AdminQueuePage />);
    await user.click(screen.getAllByRole('checkbox')[1]);
    await user.click(screen.getAllByRole('checkbox')[2]);
    await user.click(screen.getByText('Approuver'));
    await user.click(screen.getByText('Confirmer l’approbation'));
    expect(await screen.findByText(/2 rituels approuvés/)).toBeInTheDocument();
  });

  it('bulk approve avec flag critique → option skip proposée', async () => {
    server.use(...bulkHandlers.approveWithSkip);
    const { user } = render(<AdminQueuePage />, { fixtures: { withCriticalFlags: 2 } });
    await user.click(screen.getByLabelText(/Tout sélectionner/));
    await user.click(screen.getByText('Approuver'));
    expect(screen.getByText(/auto-flags critiques/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Appliquer uniquement aux/)).toBeInTheDocument();
  });

  it('bulk delete RGPD demande tapage explicite', async () => {
    const { user } = render(<AdminArchivedPage />);
    await user.click(screen.getAllByRole('checkbox')[1]);
    await user.click(screen.getByText('Supprimer'));
    const input = screen.getByLabelText(/Saisir/);
    await user.type(input, 'SUPPRIMER 0 RITUEL');
    expect(screen.getByText('Supprimer définitivement')).toBeDisabled();
    await user.clear(input);
    await user.type(input, 'SUPPRIMER 1 RITUEL');
    expect(screen.getByText('Supprimer définitivement')).toBeEnabled();
  });

  it('moderator refusé sur delete_rgpd', async () => {
    server.use(...bulkHandlers.forbidden);
    const { user } = render(<AdminArchivedPage />, { session: { role: 'moderator' } });
    // Le bouton ne doit même pas être visible
    expect(screen.queryByText('Supprimer')).not.toBeInTheDocument();
  });

  it('bulk > 1000 affiche message d’erreur', async () => {
    server.use(...bulkHandlers.limitExceeded);
    const { user } = render(<AdminQueuePage />);
    // sélection globale 1234
    await user.click(screen.getByText(/Tout sélectionner sur les/));
    await user.click(screen.getByText('Approuver'));
    expect(await screen.findByText(/splitter en lots/)).toBeInTheDocument();
  });
});
```

## 8. Tests Playwright — import E2E

`apps/web/e2e/rituals-import-csv.spec.ts` :

```ts
test.describe('Import CSV complet', () => {
  test('parcours wizard 6 étapes avec succès', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/rituals/import');

    // Étape 1
    await page.click('text=CSV');
    await page.click('button:has-text("Continuer")');

    // Étape 2 — upload
    await page.setInputFiles('input[type="file"]', 'e2e/fixtures/sample-rituels.csv');
    await expect(page.getByText(/Parsing en cours/)).toBeVisible();
    await expect(page.getByText(/4 rows parsées/)).toBeVisible({ timeout: 10_000 });

    // Étape 3 ou 4 selon auto-mapping
    if (await page.getByText(/Mappage des colonnes/).isVisible()) {
      await page.click('button:has-text("Continuer")');
    }

    // Étape 4
    await expect(page.getByText(/valides/)).toBeVisible();
    await page.click('button:has-text("Continuer vers le commit")');

    // Étape 5
    await page.fill('textarea[name="note"]', 'Test import E2E');
    await page.check('input[name="confirm"]');
    await page.click('button:has-text("Confirmer le commit")');

    // Étape 6 — rapport
    await expect(page.getByText(/Import réussi/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/4 rituels créés/)).toBeVisible();

    // Vérifier en BDD via API
    const queueResponse = await page.request.get('/api/admin/rituals/queue?import_batch_id=...');
    expect(queueResponse.ok()).toBe(true);
  });

  test('fichier > 5 Mo rejeté', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/rituals/import');
    await page.click('text=CSV');
    await page.click('button:has-text("Continuer")');
    await page.setInputFiles('input[type="file"]', 'e2e/fixtures/big-rituels.csv');
    await expect(page.getByText(/dépasse 5 Mo/)).toBeVisible();
  });

  test('CSV mal formé → erreur détaillée', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/rituals/import');
    await page.click('text=CSV');
    await page.click('button:has-text("Continuer")');
    await page.setInputFiles('input[type="file"]', 'e2e/fixtures/malformed.csv');
    await expect(page.getByText(/format CSV invalide/i)).toBeVisible();
  });
});
```

`apps/web/e2e/rituals-import-zip.spec.ts` :

```ts
test.describe('Import ZIP avec photos', () => {
  test('upload ZIP, vision ML, commit', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/rituals/import');

    await page.click('text=ZIP avec photos');
    await page.click('button:has-text("Continuer")');
    await page.setInputFiles('input[type="file"]', 'e2e/fixtures/sample-bundle.zip');

    // Parsing
    await expect(page.getByText(/Parsing en cours/)).toBeVisible();
    // Vision ML
    await expect(page.getByText(/Vision ML en cours/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/valides/)).toBeVisible({ timeout: 30_000 });

    // Vérifier face_detected sur une photo
    await expect(page.getByText(/Visage détecté/)).toBeVisible();

    // Exclure la row avec face detected
    await page.click('button:has-text("Erreurs")');
    await page.click('input[type="checkbox"][value="all"]');
    await page.click('button:has-text("Exclure")');
    await page.click('button:has-text("Confirmer")');

    // Continuer
    await page.click('button:has-text("Tous")');
    await page.click('button:has-text("Continuer vers le commit")');
    await page.check('input[name="confirm"]');
    await page.click('button:has-text("Confirmer le commit")');

    await expect(page.getByText(/Import réussi/)).toBeVisible({ timeout: 15_000 });
  });

  test('ZIP avec path traversal rejeté', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/rituals/import');
    await page.click('text=ZIP avec photos');
    await page.click('button:has-text("Continuer")');
    await page.setInputFiles('input[type="file"]', 'e2e/fixtures/malicious-zip.zip');
    await expect(page.getByText(/chemin invalide/i)).toBeVisible();
  });
});
```

`apps/web/e2e/rituals-bulk.spec.ts` :

```ts
test.describe('Bulk admin', () => {
  test('bulk approve 5 rituals', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/rituals/queue');
    for (let i = 0; i < 5; i++) {
      await page.click(`[data-testid="row-${i}"] input[type="checkbox"]`);
    }
    await expect(page.getByText('5 rituels sélectionnés')).toBeVisible();
    await page.click('button:has-text("Approuver")');
    await page.click('button:has-text("Confirmer l\'approbation")');
    await expect(page.getByText(/5 rituels approuvés/)).toBeVisible();
  });

  test('bulk reject avec template e-mail face_detected', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/rituals/queue?filter=face_detected');
    await page.click('input[name="select-all-page"]');
    await page.click('button:has-text("Rejeter")');
    await page.fill('textarea[name="internalNote"]', 'Visages frontaux');
    await page.click('button:has-text("Confirmer le rejet")');
    await expect(page.getByText(/rejetés/)).toBeVisible();
  });

  test('bulk delete RGPD avec tapage explicite', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/rituals/archived');
    await page.click('[data-testid="row-0"] input[type="checkbox"]');
    await page.click('button:has-text("Supprimer")');
    const confirmInput = page.getByLabel(/Saisir.*SUPPRIMER/);
    await confirmInput.fill('SUPPRIMER 1 RITUEL');
    await page.click('button:has-text("Supprimer définitivement")');
    await expect(page.getByText(/1 rituel supprimé/)).toBeVisible();
  });

  test('a11y bulk bar', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/rituals/queue');
    await page.click('[data-testid="row-0"] input[type="checkbox"]');
    await injectAxe(page);
    await checkA11y(page);
  });
});
```

## 9. Fixtures de test

Ajouter à `apps/web/src/test/fixtures/` :

- `rituals-import.ts` — fixtures de rows import (valid, warning, error, duplicate).
- `import-csv-samples/` — CSVs de test (minimal, complet, malformé, gros).
- `import-zip-samples/` — ZIPs de test (avec photos, malicieux).

## 10. Récapitulatif

| Catégorie | Nb tests ajoutés | Type |
| --- | --- | --- |
| Parsers (CSV/JSON/JSONL/ZIP) | 25 | Jest unit |
| Mapper + validator | 17 | Jest unit |
| Duplicate detector | 4 | Jest unit |
| Queries DB import | 9 | Jest integration (test DB) |
| Wizard MSW integration | 8 | Vitest + MSW |
| Bulk MSW integration | 7 | Vitest + MSW |
| E2E Playwright import | 5 | E2E |
| E2E Playwright bulk | 4 | E2E |
| **Total** | **~80 tests** | |

## 11. Synthèse — règles d'or tests import + bulk

1. **Parsers testés isolément** sans DB.
2. **Validators couvrent tous les codes** (`body_too_short`, `tag_unknown`, `link_external`, etc.).
3. **Queries DB testées avec test DB réelle** (pas pg-mem pour matérialized view + transactions).
4. **MSW handlers groupés** dans `importHandlers` et `bulkHandlers`.
5. **E2E couvre les 3 formats principaux** : CSV (simple), ZIP (avec photos), bulk admin.
6. **Tests de sécurité** : ZIP malicieux, path traversal, encodage non UTF-8.
7. **Tests d'accessibilité** sur barre bulk et modales destructives.
8. **Fixtures de fichiers** dans `e2e/fixtures/` et `test/fixtures/`.
9. **Aucun test E2E qui dépend de Vercel Blob réel** ; tout mocké en local.
10. **Cible suite import+bulk < 90 sec** en CI (largement parallélisable).
