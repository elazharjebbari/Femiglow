/**
 * CHANTIER E — PHASE 8 DURCISSEMENT — couverture trou schemas.ts (0 % → cible).
 *
 * Oracle métier : les schémas Zod des templates custom protègent l'API admin
 * (create/save-version/preview/test-send). Chaque borne est LOAD-BEARING — un
 * slug hors kebab-case casse l'URL/le lookup ; un `htmlSource` < 20 chars est
 * presque sûrement un brouillon corrompu ; un email invalide en `recipient`
 * enverrait dans le vide. On prouve que CHAQUE garde rejette ce qu'elle doit
 * rejeter ET accepte un payload nominal (le schéma discrimine, il n'est pas
 * permissif par accident).
 *
 * Pas de DB, pas de MSW : validation pure → batterie `unit`.
 *
 * IDs : TPL-CUS-SCHEMA-001..016 (volet « templates custom » de la matrice,
 * module 06-templates — surface d'entrée API).
 */
import { describe, expect, it } from 'vitest';
import {
  CreateTemplateSchema,
  SaveVersionSchema,
  PreviewTemplateSchema,
  TestSendSchema,
} from '../schemas';

const VALID_HTML = '<html><body>Bonjour {{firstName}}</body></html>'; // > 20 chars

const validCreate = {
  slug: 'promo-rentree',
  name: 'Promo rentrée',
  subjectTmpl: 'Votre offre {{firstName}}',
  htmlSource: VALID_HTML,
};

describe('CreateTemplateSchema — bornes API create (Module 06)', () => {
  // TPL-CUS-SCHEMA-001
  it('accepte un payload nominal minimal', () => {
    expect(CreateTemplateSchema.safeParse(validCreate).success).toBe(true);
  });

  // TPL-CUS-SCHEMA-002 — slug kebab-case obligatoire (URL/lookup)
  it('rejette un slug qui ne commence pas par une lettre', () => {
    const r = CreateTemplateSchema.safeParse({ ...validCreate, slug: '1promo' });
    expect(r.success).toBe(false);
  });

  // TPL-CUS-SCHEMA-003 — pas de majuscules/underscore (kebab strict)
  it('rejette un slug avec majuscule ou underscore', () => {
    expect(CreateTemplateSchema.safeParse({ ...validCreate, slug: 'Promo_Rentree' }).success).toBe(
      false,
    );
    expect(CreateTemplateSchema.safeParse({ ...validCreate, slug: 'promo_rentree' }).success).toBe(
      false,
    );
  });

  // TPL-CUS-SCHEMA-004 — slug accepte chiffres et tirets après la 1re lettre
  it('accepte un slug kebab-case avec chiffres et tirets', () => {
    expect(CreateTemplateSchema.safeParse({ ...validCreate, slug: 'promo-2026-v2' }).success).toBe(
      true,
    );
  });

  // TPL-CUS-SCHEMA-005 — htmlSource trop court rejeté (anti-brouillon vide)
  it('rejette un htmlSource < 20 caractères', () => {
    const r = CreateTemplateSchema.safeParse({ ...validCreate, htmlSource: '<p>x</p>' });
    expect(r.success).toBe(false);
  });

  // TPL-CUS-SCHEMA-006 — subjectTmpl vide rejeté (min 1)
  it('rejette un subjectTmpl vide', () => {
    expect(CreateTemplateSchema.safeParse({ ...validCreate, subjectTmpl: '' }).success).toBe(false);
  });

  // TPL-CUS-SCHEMA-007 — name trop court rejeté (min 2)
  it('rejette un name < 2 caractères', () => {
    expect(CreateTemplateSchema.safeParse({ ...validCreate, name: 'x' }).success).toBe(false);
  });

  // TPL-CUS-SCHEMA-008 — customVars optionnel et typé record
  it('accepte customVars record et préserve les clés', () => {
    const r = CreateTemplateSchema.safeParse({
      ...validCreate,
      customVars: { code: 'BIENVENUE', discount: 15 },
      description: 'desc',
      preheaderTmpl: 'aperçu',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.customVars).toEqual({ code: 'BIENVENUE', discount: 15 });
  });
});

describe('SaveVersionSchema — bornes API save-version (Module 06)', () => {
  // TPL-CUS-SCHEMA-009 — pas de slug/name (on versionne un template existant)
  it('accepte sans slug ni name (versioning d un template existant)', () => {
    const r = SaveVersionSchema.safeParse({
      subjectTmpl: 'Sujet v2',
      htmlSource: VALID_HTML,
      commitMessage: 'fix preheader',
    });
    expect(r.success).toBe(true);
  });

  // TPL-CUS-SCHEMA-010 — même garde htmlSource min 20 que create
  it('rejette un htmlSource trop court', () => {
    expect(
      SaveVersionSchema.safeParse({ subjectTmpl: 'S', htmlSource: 'court' }).success,
    ).toBe(false);
  });
});

describe('PreviewTemplateSchema — bornes API preview (Module 06)', () => {
  // TPL-CUS-SCHEMA-011 — preview tolère htmlSource min 1 (brouillon en cours)
  it('accepte un htmlSource de 1 caractère (preview live d un brouillon)', () => {
    expect(PreviewTemplateSchema.safeParse({ htmlSource: 'x' }).success).toBe(true);
  });

  // TPL-CUS-SCHEMA-012 — htmlSource vide rejeté même en preview
  it('rejette un htmlSource vide', () => {
    expect(PreviewTemplateSchema.safeParse({ htmlSource: '' }).success).toBe(false);
  });

  // TPL-CUS-SCHEMA-013 — contextEmail si fourni doit être un email valide
  it('rejette un contextEmail mal formé', () => {
    const r = PreviewTemplateSchema.safeParse({ htmlSource: 'x', contextEmail: 'pas-un-email' });
    expect(r.success).toBe(false);
  });

  // TPL-CUS-SCHEMA-014 — contextEmail valide accepté
  it('accepte un contextEmail bien formé', () => {
    expect(
      PreviewTemplateSchema.safeParse({ htmlSource: 'x', contextEmail: 'c@exemple.test' }).success,
    ).toBe(true);
  });
});

describe('TestSendSchema — bornes API test-send (Module 06)', () => {
  // TPL-CUS-SCHEMA-015 — recipient obligatoire et email valide (anti-envoi dans le vide)
  it('rejette un recipient absent ou mal formé', () => {
    expect(TestSendSchema.safeParse({}).success).toBe(false);
    expect(TestSendSchema.safeParse({ recipient: 'nope' }).success).toBe(false);
  });

  // TPL-CUS-SCHEMA-016 — recipient valide accepté, contextEmail optionnel
  it('accepte un recipient valide avec ou sans contextEmail', () => {
    expect(TestSendSchema.safeParse({ recipient: 'qa@exemple.test' }).success).toBe(true);
    expect(
      TestSendSchema.safeParse({ recipient: 'qa@exemple.test', contextEmail: 'ctx@exemple.test' })
        .success,
    ).toBe(true);
  });
});
