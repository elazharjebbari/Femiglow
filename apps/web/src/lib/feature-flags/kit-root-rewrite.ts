/**
 * Feature flag — rewrite interne de `/kit` vers `/{locale}/kit`.
 *
 * Kit CRO v2 §1 (vitesse) : chaque clic publicitaire FR arrivait sur `/kit`
 * et payait un 307 vers `/fr/kit` avant le moindre octet de HTML (et les
 * cookies d'attribution n'étaient écrits qu'au second passage). Avec le flag
 * actif, le middleware sert directement l'arbre localisé en gardant l'URL
 * `/kit` dans la barre d'adresse. Le canonical reste `/fr/kit`.
 *
 * Source : variable d'env serveur `KIT_ROOT_REWRITE`. **Actif par défaut** ;
 * seules les valeurs `off`, `false` ou `0` (insensibles à la casse, espaces
 * ignorés) le désactivent → retour au 307 historique sans redéploiement de
 * code.
 *
 * Référence : `docs/kit-cro-v2/DESIGN.md` §1.
 */

const KIT_ROOT_REWRITE_FALSY = new Set(['off', 'false', '0']);

/**
 * Calcule l'état du flag à partir de la valeur d'env brute.
 * Exporté pour les tests ; en runtime, utiliser `isKitRootRewriteEnabled()`.
 */
export function resolveKitRootRewrite(envValue: string | undefined): boolean {
  if (envValue === undefined) return true;
  return !KIT_ROOT_REWRITE_FALSY.has(envValue.trim().toLowerCase());
}

/** `true` si `/kit` doit être servi par rewrite interne plutôt que par 307. */
export function isKitRootRewriteEnabled(): boolean {
  return resolveKitRootRewrite(process.env.KIT_ROOT_REWRITE);
}
