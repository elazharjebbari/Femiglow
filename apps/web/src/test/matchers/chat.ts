/**
 * Custom matchers chat-specific pour vitest.
 *
 * Référence : `docs/chat-test-strategy-2026-05/01-architecture-test/04-matchers-custom.md`
 *
 * Liste (8 matchers prioritaires) :
 *  - toBeFromLanguage(lang)
 *  - toBeStreamedEventOf(type)
 *  - toRespectBudget(name)
 *  - toBeRedacted(label)
 *  - toHaveOfferedLeadFormWithReason(reason)
 *  - toFallbackToProvider(provider)
 *  - toMatchIntent(intent, source?)
 *  - toServeFromCanned()
 */
import { expect } from 'vitest';

interface ChatCustomMatchers<R = unknown> {
  toBeFromLanguage(lang: string): R;
  toBeStreamedEventOf(type: string): R;
  toRespectBudget(
    name: 'first-chunk' | 'full-reply' | 'session-create' | 'feedback-submit' | 'lead-submit',
  ): R;
  toBeRedacted(label: 'phone' | 'email' | 'iban' | 'cni' | 'carte'): R;
  toHaveOfferedLeadFormWithReason(reason: string): R;
  toFallbackToProvider(provider: string): R;
  toMatchIntent(intent: string, source?: 'regex' | 'vector' | 'llm' | 'fallback'): R;
  toServeFromCanned(): R;
}

declare module 'vitest' {
  // NB: `<T>` sans default — doit matcher la signature canonique vitest
  // (cf. node_modules/vitest/dist/index.d.ts:84 `interface Assertion<T>`).
  // Un default `= unknown` ici déclencherait :
  // "All declarations of 'Assertion' must have identical type parameters".
  interface Assertion<T> extends ChatCustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends ChatCustomMatchers {}
}

const BUDGETS_MS: Record<string, number> = {
  'first-chunk': 800,
  'full-reply': 3_000,
  'session-create': 100,
  'feedback-submit': 100,
  'lead-submit': 200,
};

const REDACTION_PATTERNS: Record<string, RegExp> = {
  phone: /\[t[ée]l[ée]phone\]/i,
  email: /\[email\]/i,
  iban: /\[iban\]/i,
  cni: /\[cni\]/i,
  carte: /\[carte\]/i,
};

expect.extend({
  toBeFromLanguage(
    received: unknown,
    expected: string,
  ) {
    const r = received as { language?: string } | null;
    if (!r || typeof r !== 'object') {
      return {
        pass: false,
        message: () => `expected object with language field, got ${typeof received}`,
      };
    }
    const lang = r.language;
    return {
      pass: lang === expected,
      message: () =>
        lang === expected
          ? `expected language NOT to be "${expected}"`
          : `expected language to be "${expected}", got "${String(lang)}"`,
    };
  },

  toBeStreamedEventOf(received: unknown, expected: string) {
    let event: string | undefined;
    if (typeof received === 'string') {
      const m = received.match(/event:\s*(\S+)/);
      event = m?.[1];
    } else if (received && typeof received === 'object' && 'event' in received) {
      event = (received as { event?: string }).event;
    }
    return {
      pass: event === expected,
      message: () =>
        event === expected
          ? `expected SSE event NOT to be "${expected}"`
          : `expected SSE event "${expected}", got "${String(event)}"`,
    };
  },

  toRespectBudget(received: number, name: keyof typeof BUDGETS_MS) {
    const budget = BUDGETS_MS[name];
    if (budget === undefined) {
      return {
        pass: false,
        message: () =>
          `unknown budget "${name}". Known: ${Object.keys(BUDGETS_MS).join(', ')}`,
      };
    }
    return {
      pass: received <= budget,
      message: () =>
        received <= budget
          ? `expected ${received}ms NOT to respect budget "${name}" (${budget}ms)`
          : `latency ${received}ms exceeded budget "${name}" (${budget}ms)`,
    };
  },

  toBeRedacted(received: unknown, label: keyof typeof REDACTION_PATTERNS) {
    if (typeof received !== 'string') {
      return {
        pass: false,
        message: () => `expected string, got ${typeof received}`,
      };
    }
    const pattern = REDACTION_PATTERNS[label];
    if (!pattern) {
      return {
        pass: false,
        message: () =>
          `unknown redaction label "${label}". Known: ${Object.keys(REDACTION_PATTERNS).join(', ')}`,
      };
    }
    return {
      pass: pattern.test(received),
      message: () =>
        pattern.test(received)
          ? `expected text NOT to contain redacted "[${label}]"`
          : `expected text to contain redacted "[${label}]" placeholder, got: "${received.slice(0, 120)}"`,
    };
  },

  toHaveOfferedLeadFormWithReason(received: unknown, expectedReason: string) {
    const r = received as
      | { leadFormOffered?: boolean; leadFormReason?: string }
      | null;
    if (!r || typeof r !== 'object') {
      return {
        pass: false,
        message: () => `expected object, got ${typeof received}`,
      };
    }
    if (!r.leadFormOffered) {
      return {
        pass: false,
        message: () =>
          `expected lead form offered with reason "${expectedReason}", but no offer found`,
      };
    }
    return {
      pass: r.leadFormReason === expectedReason,
      message: () =>
        r.leadFormReason === expectedReason
          ? `expected NOT to offer lead form with reason "${expectedReason}"`
          : `expected lead form reason "${expectedReason}", got "${String(r.leadFormReason)}"`,
    };
  },

  toFallbackToProvider(received: unknown, expected: string) {
    const r = received as
      | { provider?: string; failedProviders?: string[] }
      | null;
    if (!r || typeof r !== 'object') {
      return {
        pass: false,
        message: () => `expected object, got ${typeof received}`,
      };
    }
    if (r.provider !== expected) {
      return {
        pass: false,
        message: () =>
          `expected fallback provider "${expected}", got "${String(r.provider)}" (failed: [${(r.failedProviders ?? []).join(', ')}])`,
      };
    }
    if (!r.failedProviders?.length) {
      return {
        pass: false,
        message: () =>
          `expected at least one failed provider before fallback to "${expected}"`,
      };
    }
    return {
      pass: true,
      message: () => `expected NOT to fallback to "${expected}"`,
    };
  },

  toMatchIntent(
    received: unknown,
    expectedIntent: string,
    expectedSource?: 'regex' | 'vector' | 'llm' | 'fallback',
  ) {
    const r = received as
      | { intent?: string; intentSource?: string }
      | null;
    if (!r || typeof r !== 'object') {
      return {
        pass: false,
        message: () => `expected object, got ${typeof received}`,
      };
    }
    if (r.intent !== expectedIntent) {
      return {
        pass: false,
        message: () =>
          `expected intent "${expectedIntent}", got "${String(r.intent)}"`,
      };
    }
    if (expectedSource && r.intentSource !== expectedSource) {
      return {
        pass: false,
        message: () =>
          `expected intent source "${expectedSource}", got "${String(r.intentSource)}"`,
      };
    }
    return {
      pass: true,
      message: () =>
        `expected NOT to match intent "${expectedIntent}"${expectedSource ? ` from "${expectedSource}"` : ''}`,
    };
  },

  toServeFromCanned(received: unknown) {
    const r = received as
      | { servedFrom?: 'canned' | 'faq' | 'llm'; cannedKey?: string }
      | null;
    if (!r || typeof r !== 'object') {
      return {
        pass: false,
        message: () => `expected object, got ${typeof received}`,
      };
    }
    return {
      pass: r.servedFrom === 'canned',
      message: () =>
        r.servedFrom === 'canned'
          ? `expected NOT to be served from canned (got cannedKey="${String(r.cannedKey)}")`
          : `expected to be served from canned, got servedFrom="${String(r.servedFrom)}"`,
    };
  },
});
