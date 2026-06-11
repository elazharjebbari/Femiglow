/**
 * Custom matchers Vitest pour assertions métier réutilisables.
 *
 * Référence : `docs/test-strategy-2026-05/02-vision-strategy.md`
 *
 * Usage :
 * ```ts
 * import '@/test/matchers';
 *
 * expect(event).toMatchEventShape();
 * expect(parsed).toBeValidZod(schema);
 * expect(snapshot).toHaveAttribution('paid_social');
 * ```
 */
import { expect } from 'vitest';
import type { ZodTypeAny } from 'zod';

interface CustomMatchers<R = unknown> {
  toBeValidZod(schema: ZodTypeAny): R;
  toMatchEventShape(): R;
  toHaveAttribution(bucket: string): R;
  toBeOneOf<T>(allowed: T[]): R;
}

declare module 'vitest' {
  // NB: `<T>` sans default — doit matcher la signature canonique vitest
  // (cf. node_modules/vitest/dist/index.d.ts:84 `interface Assertion<T>`).
  interface Assertion<T> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

expect.extend({
  /**
   * Vérifie qu'une valeur est valide selon un Zod schema.
   *
   * @example expect(payload).toBeValidZod(orderSchema)
   */
  toBeValidZod(received: unknown, schema: ZodTypeAny) {
    const result = schema.safeParse(received);
    return {
      pass: result.success,
      message: () => {
        if (result.success) {
          return `Expected NOT to be valid Zod (but it was)`;
        }
        return `Zod validation failed:\n${JSON.stringify(result.error.issues, null, 2)}`;
      },
    };
  },

  /**
   * Vérifie qu'un object a la shape minimale d'un tracking event.
   * Évite la duplication d'expect.objectContaining({...}) verbeux.
   *
   * @example expect(row).toMatchEventShape()
   */
  toMatchEventShape(received: unknown) {
    const required = [
      'eventId',
      'eventName',
      'pageRoute',
      'anonymousId',
      'sessionId',
      'consentSnapshot',
      'receivedAt',
    ];
    if (typeof received !== 'object' || received === null) {
      return {
        pass: false,
        message: () => `Expected object, got ${typeof received}`,
      };
    }
    const missing = required.filter(
      (k) => !(k in (received as Record<string, unknown>)),
    );
    return {
      pass: missing.length === 0,
      message: () =>
        missing.length > 0
          ? `Event shape missing fields: ${missing.join(', ')}`
          : `Event shape OK`,
    };
  },

  /**
   * Vérifie qu'un snapshot d'attribution match un bucket attendu.
   *
   * @example expect(snapshot).toHaveAttribution('paid_social')
   */
  toHaveAttribution(received: unknown, bucket: string) {
    if (typeof received !== 'object' || received === null) {
      return {
        pass: false,
        message: () => `Expected object with trafficSource, got ${typeof received}`,
      };
    }
    const obj = received as Record<string, unknown>;
    const observed = obj.trafficSource;
    return {
      pass: observed === bucket,
      message: () =>
        `Expected trafficSource="${bucket}", got "${observed ?? 'null/undefined'}"`,
    };
  },

  /**
   * Vérifie qu'une valeur est dans un set autorisé.
   *
   * @example expect(status).toBeOneOf([200, 304])
   */
  toBeOneOf<T>(received: T, allowed: T[]) {
    return {
      pass: allowed.includes(received),
      message: () =>
        `Expected one of [${allowed.join(', ')}], got ${JSON.stringify(received)}`,
    };
  },
});
