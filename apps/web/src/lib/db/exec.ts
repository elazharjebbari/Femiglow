/**
 * Helpers de normalisation pour le retour de `db.execute()` en mode
 * dual-driver.
 *
 * Pourquoi ce module existe ?
 *  - `db()` (cf. `client.ts`) retourne une union
 *    `DrizzleNeon | DrizzlePg`. Quand on appelle `.execute<T>(sql)`,
 *    le retour est un union :
 *      • Neon HTTP : `{ rows: T[] }` (objet enveloppant)
 *      • postgres-js : `RowList<T[]>` (un array directement, pas
 *        d'enveloppe `.rows`)
 *  - TypeScript voit l'intersection des deux types et **refuse**
 *    l'accès à `.rows` (qui n'existe pas sur la branche array). Les
 *    contournements éparpillés dans la codebase sont :
 *      (a) `rows.rows ?? (rows as unknown as T[])` → casse TS strict
 *      (b) `(rows as { rows?: unknown[] }).rows` → fragile, perd le
 *          typage
 *      (c) `rows as unknown as T[]` → bug latent en prod sur Neon
 *          (l'array attendu serait en réalité `{ rows: [...] }`)
 *
 * `rowsOf` unifie les deux shapes runtime-correctement, sans cast
 * unsafe. C'est le **seul** point de la codebase qui doit connaître
 * la structure du retour de `db.execute()`.
 *
 * Si Neon ou postgres-js changent de shape (peu probable mais
 * possible — drizzle a déjà migré entre v0.29 et v0.30), on patche
 * ici, pas dans 20 call-sites.
 */

/**
 * Extrait les lignes d'un retour `db.execute()`, qu'il soit en
 * shape Neon (`{ rows: T[] }`) ou postgres-js (`T[]` directement).
 *
 * @param result Le retour brut de `await db.execute<T>(sql\`…\`)`.
 * @returns Le tableau de lignes typé `T[]`.
 *
 * @example
 *   const rows = await db.execute<UserRow>(sql`SELECT * FROM users`);
 *   const list = rowsOf(rows);  // UserRow[] — fonctionne sur les deux drivers.
 */
export function rowsOf<T>(result: { rows: T[] } | T[]): T[] {
  // `Array.isArray` discrimine de façon **runtime-safe**. Pas de cast
  // unsafe — on lit la propriété `.rows` uniquement quand on sait que
  // l'objet n'est pas un array.
  return Array.isArray(result) ? result : result.rows;
}
