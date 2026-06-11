/**
 * Seed faker globalement pour rendre toutes les factories déterministes.
 *
 * Référence : `docs/chat-test-strategy-2026-05/00-foundation/02-test-conventions.md`
 *             §3.1 — règle Faker sans seed = flaky.
 */
import { faker } from '@faker-js/faker';
import { beforeAll } from 'vitest';

beforeAll(() => {
  faker.seed(42);
});
