import { describe, expect, it } from 'vitest';
import { validateCustomCode, customAdapter } from './custom';
import type { TrackingProvider } from '@/lib/db/types';

function fakeProvider(overrides: Partial<TrackingProvider> = {}): TrackingProvider {
  return {
    id: 'tpr_test',
    kind: 'custom',
    status: 'enabled',
    pixelId: null,
    capiToken: null,
    capiTokenIv: null,
    capiTokenTag: null,
    testEventCode: null,
    customHead: null,
    customBody: null,
    config: {},
    enabledEvents: [],
    lastEventAt: null,
    errorCount24h: 0,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('validateCustomCode', () => {
  it('rejette un code vide', () => {
    expect(validateCustomCode('').ok).toBe(false);
  });

  it("rejette eval()", () => {
    const res = validateCustomCode('eval("alert(1)")');
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.startsWith('forbidden'))).toBe(true);
  });

  it('rejette document.cookie', () => {
    const res = validateCustomCode('var c = document.cookie;');
    expect(res.ok).toBe(false);
  });

  it('rejette javascript:', () => {
    const res = validateCustomCode('var u = "javascript:alert(1)";');
    expect(res.ok).toBe(false);
  });

  it('accepte un script simple sans patterns interdits', () => {
    const code = `(function(){var s=document.createElement('script');s.src='https://cdn.example.com/lib.js';document.head.appendChild(s);})();`;
    const res = validateCustomCode(code);
    expect(res.ok).toBe(true);
  });

  it('rejette les URL non-https', () => {
    const code = `var s=document.createElement('script');s.src='http://insecure.example.com/x.js';`;
    const res = validateCustomCode(code);
    expect(res.ok).toBe(false);
  });
});

describe('customAdapter.clientSnippet', () => {
  it('renvoie null si disabled', () => {
    const out = customAdapter.clientSnippet?.(fakeProvider({ status: 'disabled' }));
    expect(out).toBeNull();
  });

  it('renvoie null si head/body vides', () => {
    const out = customAdapter.clientSnippet?.(fakeProvider());
    expect(out).toBeNull();
  });

  it('renvoie null si validation échoue', () => {
    const out = customAdapter.clientSnippet?.(
      fakeProvider({ customHead: 'eval("x")' }),
    );
    expect(out).toBeNull();
  });

  it('combine head + body si valides', () => {
    const out = customAdapter.clientSnippet?.(
      fakeProvider({
        customHead: `var s=document.createElement('script');s.src='https://cdn.example.com/a.js';`,
        customBody: `var t=document.createElement('script');t.src='https://cdn.example.com/b.js';`,
      }),
    );
    expect(out).toContain('cdn.example.com/a.js');
    expect(out).toContain('cdn.example.com/b.js');
  });
});
