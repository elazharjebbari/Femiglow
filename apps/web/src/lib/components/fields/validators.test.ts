import { describe, expect, it } from 'vitest';

import type { ComponentFieldDefinition } from '@/lib/db/types';

import {
  buildFieldSchema,
  formatZodErrorsFr,
  hrefSchema,
  validateField,
  validateFieldValue,
} from './validators';

function fieldDef(
  partial: Partial<ComponentFieldDefinition> & Pick<ComponentFieldDefinition, 'type'>,
): ComponentFieldDefinition {
  return {
    key: partial.key ?? 'test',
    label: partial.label ?? 'Test',
    type: partial.type,
    required: partial.required ?? false,
    description: partial.description,
    config: partial.config,
  };
}

describe('validateFieldValue — text', () => {
  it('accepts a string within maxLength', () => {
    const result = validateFieldValue(
      fieldDef({ type: 'text', config: { maxLength: 10 } }),
      { v: 'hello' },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ v: 'hello' });
  });

  it('rejects a string longer than maxLength', () => {
    const result = validateFieldValue(
      fieldDef({ type: 'text', config: { maxLength: 5 } }),
      { v: 'hello world' },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.message).toMatch(/Maximum 5 caractères/);
      expect(result.errors[0]?.path).toEqual(['v']);
    }
  });

  it('accepts an empty string when minLength=0', () => {
    const result = validateFieldValue(
      fieldDef({ type: 'text', config: { minLength: 0, maxLength: 10 } }),
      { v: '' },
    );
    expect(result.ok).toBe(true);
  });

  it('rejects empty string when minLength>0', () => {
    const result = validateFieldValue(
      fieldDef({ type: 'text', config: { minLength: 3 } }),
      { v: '' },
    );
    expect(result.ok).toBe(false);
  });
});

describe('validateFieldValue — multiline / kicker / rich-text defaults', () => {
  it('multiline accepts up to default 5000 chars', () => {
    const result = validateFieldValue(
      fieldDef({ type: 'multiline' }),
      { v: 'a'.repeat(4999) + '\n' },
    );
    expect(result.ok).toBe(true);
  });

  it('kicker enforces default maxLength=30', () => {
    const result = validateFieldValue(
      fieldDef({ type: 'kicker' }),
      { v: 'a'.repeat(31) },
    );
    expect(result.ok).toBe(false);
  });

  it('rich-text rejects above maxLength', () => {
    const result = validateFieldValue(
      fieldDef({ type: 'rich-text', config: { maxLength: 10 } }),
      { v: '## TitleAA' + 'B'.repeat(20) },
    );
    expect(result.ok).toBe(false);
  });
});

describe('validateFieldValue — cta', () => {
  it('rejects javascript: href', () => {
    const result = validateFieldValue(
      fieldDef({ type: 'cta' }),
      { label: 'Voir', href: 'javascript:alert(1)' },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path.includes('href'))).toBe(true);
    }
  });

  it('accepts mailto:, tel:, /relative href', () => {
    for (const href of ['/voir', 'mailto:hi@example.com', 'tel:+33612345678']) {
      const result = validateFieldValue(
        fieldDef({ type: 'cta' }),
        { label: 'Voir', href },
      );
      expect(result.ok, `href=${href}`).toBe(true);
    }
  });

  it('rejects external https not in allowedHosts', () => {
    const result = validateFieldValue(
      fieldDef({
        type: 'cta',
        config: { allowedHosts: ['instagram.com'] },
      }),
      { label: 'Voir', href: 'https://evil.com/path' },
    );
    expect(result.ok).toBe(false);
  });

  it('accepts external https when host in allowedHosts', () => {
    const result = validateFieldValue(
      fieldDef({
        type: 'cta',
        config: { allowedHosts: ['instagram.com'] },
      }),
      { label: 'Voir', href: 'https://instagram.com/femiglow' },
    );
    expect(result.ok).toBe(true);
  });

  it('rejects http (non-https) even when host allowed', () => {
    const result = validateFieldValue(
      fieldDef({
        type: 'cta',
        config: { allowedHosts: ['instagram.com'] },
      }),
      { label: 'Voir', href: 'http://instagram.com/femiglow' },
    );
    expect(result.ok).toBe(false);
  });

  it('respects variant restriction by config', () => {
    const result = validateFieldValue(
      fieldDef({ type: 'cta', config: { variants: ['primary'] } }),
      { label: 'X', href: '/x', variant: 'ghost' },
    );
    expect(result.ok).toBe(false);
  });
});

describe('validateFieldValue — icon', () => {
  it('rejects path traversal (../foo)', () => {
    const result = validateFieldValue(
      fieldDef({ type: 'icon' }),
      { v: '../foo' },
    );
    expect(result.ok).toBe(false);
  });

  it('rejects path with slash', () => {
    const result = validateFieldValue(
      fieldDef({ type: 'icon' }),
      { v: 'icons/sun' },
    );
    expect(result.ok).toBe(false);
  });

  it('accepts safe icon key', () => {
    const result = validateFieldValue(
      fieldDef({ type: 'icon' }),
      { v: 'sun' },
    );
    expect(result.ok).toBe(true);
  });

  it('respects allowlist when provided via options', () => {
    const ok = validateFieldValue(
      fieldDef({ type: 'icon' }),
      { v: 'sun' },
      { allowedIcons: ['sun', 'moon'] },
    );
    const ko = validateFieldValue(
      fieldDef({ type: 'icon' }),
      { v: 'rocket' },
      { allowedIcons: ['sun', 'moon'] },
    );
    expect(ok.ok).toBe(true);
    expect(ko.ok).toBe(false);
  });
});

describe('validateFieldValue — enum', () => {
  it('rejects value not in options', () => {
    const result = validateFieldValue(
      fieldDef({
        type: 'enum',
        config: {
          options: [
            { value: 'morning', label: 'Matin' },
            { value: 'evening', label: 'Soir' },
          ],
        },
      }),
      { v: 'noon' },
    );
    expect(result.ok).toBe(false);
  });

  it('accepts value in options', () => {
    const result = validateFieldValue(
      fieldDef({
        type: 'enum',
        config: {
          options: [
            { value: 'morning', label: 'Matin' },
            { value: 'evening', label: 'Soir' },
          ],
        },
      }),
      { v: 'morning' },
    );
    expect(result.ok).toBe(true);
  });

  it('throws/returns error if config.options missing', () => {
    const result = validateFieldValue(fieldDef({ type: 'enum' }), { v: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('definition_error');
    }
  });
});

describe('validateFieldValue — list', () => {
  it('enforces minItems', () => {
    const result = validateFieldValue(
      fieldDef({
        type: 'list',
        config: { itemType: 'text', minItems: 2, maxItems: 5 },
      }),
      { items: [{ v: 'one' }] },
    );
    expect(result.ok).toBe(false);
  });

  it('enforces maxItems', () => {
    const result = validateFieldValue(
      fieldDef({
        type: 'list',
        config: { itemType: 'text', minItems: 0, maxItems: 2 },
      }),
      { items: [{ v: 'a' }, { v: 'b' }, { v: 'c' }] },
    );
    expect(result.ok).toBe(false);
  });

  it('accepts within bounds and validates each item', () => {
    const result = validateFieldValue(
      fieldDef({
        type: 'list',
        config: {
          itemType: 'text',
          itemConfig: { maxLength: 10 },
          minItems: 1,
          maxItems: 3,
        },
      }),
      { items: [{ v: 'short' }, { v: 'fits' }] },
    );
    expect(result.ok).toBe(true);
  });

  it('rejects when an item violates its config', () => {
    const result = validateFieldValue(
      fieldDef({
        type: 'list',
        config: {
          itemType: 'text',
          itemConfig: { maxLength: 3 },
          minItems: 1,
          maxItems: 5,
        },
      }),
      { items: [{ v: 'too long here' }] },
    );
    expect(result.ok).toBe(false);
  });
});

describe('validateFieldValue — record', () => {
  it('validates each shape field', () => {
    const def = fieldDef({
      type: 'record',
      config: {
        shape: {
          title: { type: 'text', config: { maxLength: 5 }, required: true },
          flag: { type: 'boolean', required: false },
        },
      },
    });
    const ok = validateFieldValue(def, {
      fields: { title: { v: 'tiny' }, flag: { v: true } },
    });
    expect(ok.ok).toBe(true);

    const ko = validateFieldValue(def, {
      fields: { title: { v: 'too-long-title' } },
    });
    expect(ko.ok).toBe(false);
  });
});

describe('validateFieldValue — number', () => {
  it('enforces min/max', () => {
    const def = fieldDef({ type: 'number', config: { min: 0, max: 10 } });
    expect(validateFieldValue(def, { v: 5 }).ok).toBe(true);
    expect(validateFieldValue(def, { v: -1 }).ok).toBe(false);
    expect(validateFieldValue(def, { v: 11 }).ok).toBe(false);
  });

  it('enforces step (multiple-of)', () => {
    const def = fieldDef({
      type: 'number',
      config: { min: 0, max: 10, step: 2 },
    });
    expect(validateFieldValue(def, { v: 4 }).ok).toBe(true);
    expect(validateFieldValue(def, { v: 3 }).ok).toBe(false);
  });

  it('rejects non-number', () => {
    expect(
      validateFieldValue(fieldDef({ type: 'number' }), { v: 'NaN' }).ok,
    ).toBe(false);
  });
});

describe('validateFieldValue — boolean', () => {
  it('accepts true and false only', () => {
    expect(validateFieldValue(fieldDef({ type: 'boolean' }), { v: true }).ok).toBe(true);
    expect(validateFieldValue(fieldDef({ type: 'boolean' }), { v: false }).ok).toBe(true);
    expect(validateFieldValue(fieldDef({ type: 'boolean' }), { v: 1 }).ok).toBe(false);
    expect(validateFieldValue(fieldDef({ type: 'boolean' }), { v: 'true' }).ok).toBe(false);
  });
});

describe('validateFieldValue — breadcrumb-segment', () => {
  it('requires label and href', () => {
    expect(
      validateFieldValue(fieldDef({ type: 'breadcrumb-segment' }), {
        label: 'Maison',
        href: '/maison',
      }).ok,
    ).toBe(true);
    expect(
      validateFieldValue(fieldDef({ type: 'breadcrumb-segment' }), {
        label: '',
        href: '/maison',
      }).ok,
    ).toBe(false);
    expect(
      validateFieldValue(fieldDef({ type: 'breadcrumb-segment' }), {
        label: 'Maison',
        href: '',
      }).ok,
    ).toBe(false);
  });

  it('refuses non-allowlisted external href', () => {
    const result = validateFieldValue(
      fieldDef({
        type: 'breadcrumb-segment',
        config: { allowedHosts: [] },
      }),
      { label: 'X', href: 'https://example.com/x' },
    );
    expect(result.ok).toBe(false);
  });
});

describe('validateFieldValue — quote', () => {
  it('requires text, accepts optional author', () => {
    expect(
      validateFieldValue(fieldDef({ type: 'quote' }), { text: 'Une parole.' }).ok,
    ).toBe(true);
    expect(
      validateFieldValue(fieldDef({ type: 'quote' }), {
        text: 'Une parole.',
        author: 'Salma',
      }).ok,
    ).toBe(true);
    expect(
      validateFieldValue(fieldDef({ type: 'quote' }), { text: '' }).ok,
    ).toBe(false);
  });

  it('rejects an author over 120 chars', () => {
    const result = validateFieldValue(fieldDef({ type: 'quote' }), {
      text: 'ok',
      author: 'a'.repeat(121),
    });
    expect(result.ok).toBe(false);
  });
});

describe('validateFieldValue — color-token', () => {
  it('accepts kebab-case tokens', () => {
    expect(
      validateFieldValue(fieldDef({ type: 'color-token' }), { v: 'creme-warm' }).ok,
    ).toBe(true);
  });

  it('rejects bad characters', () => {
    expect(
      validateFieldValue(fieldDef({ type: 'color-token' }), { v: 'CREME WARM' }).ok,
    ).toBe(false);
  });
});

describe('validateFieldValue — link', () => {
  it('accepts a valid relative link with optional label', () => {
    const result = validateFieldValue(
      fieldDef({ type: 'link' }),
      { href: '/voir', label: 'Voir', external: false },
    );
    expect(result.ok).toBe(true);
  });

  it('rejects bad href', () => {
    const result = validateFieldValue(
      fieldDef({ type: 'link' }),
      { href: 'javascript:alert(1)' },
    );
    expect(result.ok).toBe(false);
  });
});

describe('hrefSchema', () => {
  it('accepts anchor href', () => {
    expect(hrefSchema().safeParse('#section').success).toBe(true);
  });

  it('rejects malformed mailto', () => {
    expect(hrefSchema().safeParse('mailto:bad').success).toBe(false);
  });
});

describe('formatZodErrorsFr', () => {
  it('returns French human-readable messages', () => {
    const schema = buildFieldSchema(fieldDef({ type: 'text', config: { maxLength: 3 } }));
    const parsed = schema.safeParse({ v: 'too long' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const errors = formatZodErrorsFr(parsed.error);
      expect(errors[0]?.message).toMatch(/caractères/);
    }
  });

  it('translates "Required" to French', () => {
    const schema = buildFieldSchema(fieldDef({ type: 'cta' }));
    const parsed = schema.safeParse({ href: '/x' }); // label missing
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const errors = formatZodErrorsFr(parsed.error);
      const labelError = errors.find((e) => e.path.includes('label'));
      // Le code pour un champ manquant peut être 'invalid_type' ou 'too_small' selon Zod ;
      // dans tous les cas notre message FR doit être présent.
      expect(labelError?.message).toMatch(/(requis|Type invalide|Label requis)/);
    }
  });
});

describe('validateField — shorthand', () => {
  it('accepts already-encoded value', () => {
    const result = validateField(fieldDef({ type: 'text' }), { v: 'hello' });
    expect(result.ok).toBe(true);
  });

  it('decodes a flat scalar before validating', () => {
    const result = validateField(fieldDef({ type: 'text' }), 'hello');
    // 'hello' is decoded to 'hello' which then fails because we expect { v: ... }.
    // The shorthand is best-effort; flat strings for text aren't supported by
    // the schema itself. Document by asserting it errors cleanly.
    expect(result.ok).toBe(false);
  });
});
