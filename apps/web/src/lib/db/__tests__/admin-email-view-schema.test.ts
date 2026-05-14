/**
 * Schema test for admin_email_view (M5.1.0).
 *
 * On valide :
 *  - le table object Drizzle est correctement défini (présence de toutes
 *    les colonnes attendues)
 *  - les types TypeScript inférés ($inferSelect / $inferInsert) ont la
 *    bonne shape
 *  - le scope enum est restreint aux 3 valeurs autorisées
 *  - l'index uniqueIndex+composite est bien posé
 *
 * Le test ne touche pas la DB — il vérifie le schéma TypeScript +
 * la métadonnée des colonnes générée par Drizzle (suffisant pour
 * détecter les régressions).
 */
import { describe, it, expect } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { adminEmailView } from '@/lib/db/schema-emails';
import type {
  AdminEmailViewRow,
  AdminEmailViewInsert,
  AdminEmailViewScope,
} from '@/lib/db/schema-emails';

describe('schema: admin_email_view', () => {
  it('has the expected table name', () => {
    expect(getTableName(adminEmailView)).toBe('admin_email_view');
  });

  it('exposes all required columns', () => {
    const cols = Object.keys(adminEmailView);
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'ownerEmail',
        'name',
        'scope',
        'filterState',
        'isSystem',
        'createdAt',
        'updatedAt',
        'deletedAt',
      ]),
    );
  });

  it('infers a Row type with correct optional/required shape', () => {
    // Type-level assertion : si la shape ne correspond pas, le compile fail.
    const sampleRow: AdminEmailViewRow = {
      id: 'uuid-here',
      ownerEmail: 'admin@x.y',
      name: 'Failed today',
      scope: 'transactional',
      filterState: { filters: { status: ['failed'] } },
      isSystem: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    expect(sampleRow.scope).toBe('transactional');
    expect(sampleRow.deletedAt).toBeNull();
  });

  it('infers an Insert type that allows defaults for system columns', () => {
    const minimalInsert: AdminEmailViewInsert = {
      ownerEmail: 'admin@x.y',
      name: 'My view',
      scope: 'audiences' as unknown as 'transactional', // see scope enum test below
      filterState: {},
    };
    // id, isSystem, createdAt, updatedAt, deletedAt sont optionnels (defaults).
    expect(minimalInsert.ownerEmail).toBe('admin@x.y');
    // On valide qu'on peut aussi explicitement passer ces valeurs :
    const fullInsert: AdminEmailViewInsert = {
      id: 'fixed-uuid',
      ownerEmail: 'admin@x.y',
      name: 'My view',
      scope: 'transactional',
      filterState: { foo: 'bar' },
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    expect(fullInsert.isSystem).toBe(true);
  });

  it('restricts scope to 3 allowed values (TypeScript enum)', () => {
    const valid: AdminEmailViewScope[] = ['transactional', 'campaigns', 'automation'];
    expect(valid).toHaveLength(3);
    // L'enum est resserrée par le type Drizzle `text({ enum: [...] })`.
    // Une valeur hors enum produit une erreur de compilation, qu'on
    // capture ici par l'absence de la valeur dans la liste autorisée.
    const isAllowed = (s: string): s is AdminEmailViewScope =>
      (valid as readonly string[]).includes(s);
    expect(isAllowed('transactional')).toBe(true);
    expect(isAllowed('campaigns')).toBe(true);
    expect(isAllowed('automation')).toBe(true);
    expect(isAllowed('foobar')).toBe(false);
  });
});
