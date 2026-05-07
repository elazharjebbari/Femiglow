/**
 * Next.js instrumentation — no-op.
 *
 * Le boot-seed a été déplacé dans `src/lib/boot/seed-on-boot.ts`, appelé
 * depuis le root layout (RSC). Cela évite que webpack tente de bundler
 * `node:crypto` (transitive de `src/lib/ids.ts`) pour le runtime edge,
 * ce qui faisait échouer le build avec UnhandledSchemeError.
 *
 * On conserve ce fichier vide pour que `experimental.instrumentationHook`
 * reste activable sans erreur, et pour servir de point d'extension futur
 * (OpenTelemetry, Sentry, etc.).
 */

export async function register(): Promise<void> {
  // intentionnellement vide — voir docstring
}
