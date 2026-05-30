/**
 * Setup MSW pour vitest — VOLONTAIREMENT vide (no-op).
 *
 * Le lifecycle MSW (`listen` / `resetHandlers` / `close`) est géré
 * **par fichier de test**, et non globalement. Raison : la politique
 * `onUnhandledRequest` diffère d'une suite à l'autre
 * (`'error'` strict pour les contrats « aucun appel externe », `'bypass'`
 * pour les suites qui émettent des requêtes volontairement non mockées,
 * `'warn'` ailleurs). Un `server.listen()` global à politique unique :
 *   1. entre en collision avec le `server.listen()` de chaque fichier
 *      (`network.enable()` appelé 2× → « Invariant: network already enabled »), et
 *   2. écraserait la politique propre à chaque suite (un global `'error'`
 *      fait échouer les suites `'bypass'` : « Cannot bypass a request when
 *      using the "error" strategy »).
 * De plus un `afterEach(resetHandlers)` global effacerait les handlers que
 * certaines suites enregistrent une seule fois en `beforeAll`.
 *
 * → Chaque suite appelle donc elle-même :
 *     beforeAll(() => server.listen({ onUnhandledRequest: '<policy>' }));
 *     afterEach(() => server.resetHandlers());
 *     afterAll(() => server.close());
 *   (cf. l'en-tête de `src/test/msw/server.ts`).
 */
export {};
