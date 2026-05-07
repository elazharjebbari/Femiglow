# Architecture — Cascade défaut → DB

## Principe

Chaque section (`nav`, `flags`, `rbac`, `branding`) a une valeur défaut
codée. La DB n'apporte que des **overrides partiels** par section.

```
defaultConfig (TS, source de vérité initiale)
    ↓ deep-merge (DB wins champ par champ)
DB row payload (jsonb, peut être partiel)
    ↓ Zod re-validation
resolvedConfig
```

## Failsafe

À chaque lecture, **3 niveaux de protection** :

1. **Pas de ligne DB** → renvoie `defaultConfig[section]`. Pas un
   fail, c'est l'état initial normal.
2. **Ligne DB existante mais Zod fail** → log `warn` structuré +
   renvoie `defaultConfig[section]`. L'app continue.
3. **Ligne DB existante, Zod OK** → `deepMerge(defaults, payload)`.

→ Impossible de planter le rendu admin avec une config corrompue.
   Une corruption est seulement « silencieusement ignorée ».

```ts
export async function getAppConfig<S extends Section>(
  section: S,
): Promise<AppConfigBySection[S]> {
  const row = await db.query.appConfig.findFirst({ where: eq(appConfig.section, section) });
  const fallback = defaultConfig[section];

  if (!row) return fallback;

  const parsed = appConfigSchema[section].safeParse(row.payload);
  if (!parsed.success) {
    logger.warn('[admin-config] zod fail', {
      section,
      issues: parsed.error.issues,
      version: row.version,
    });
    return fallback;
  }
  return deepMerge(fallback, parsed.data);
}
```

## Deep-merge

Algorithme :

- Pour les objets : merge récursif, DB wins par clé
- Pour les arrays : DB **remplace totalement** (pas de merge)
- Pour les valeurs primitives : DB wins

→ Un array `nav.items` modifié par l'admin remplace **toute** la
liste. Pas de merge ligne par ligne (sinon ré-ordonnancement
ambigu).

## Pas de circular dep

Le module **édite** la config qu'il consomme partiellement, mais
les éditeurs eux-mêmes utilisent des **constantes codées** pour
décider qui peut éditer :

| Section éditée | Permission lue depuis            |
|----------------|----------------------------------|
| `nav`          | constante `EDIT_NAV_ROLE = 'admin'` |
| `flags`        | constante `EDIT_FLAGS_ROLE = 'superadmin'` |
| `rbac`         | constante `EDIT_RBAC_ROLE = 'superadmin'` |
| `branding`     | constante `EDIT_BRANDING_ROLE = 'admin'` |

→ Si la matrice RBAC en DB est cassée, l'éditeur RBAC reste
accessible aux superadmins (constante codée).

## Cache & invalidation

```ts
const _resolveAppConfig = unstable_cache(
  getAppConfig,
  ['app-config', 'resolve'],
  {
    tags: ['app-config'],
    revalidate: 3600,
  },
);

export const getAppConfigCached = <S extends Section>(section: S) =>
  unstable_cache(
    () => getAppConfig(section),
    ['app-config', 'resolve', section],
    {
      tags: ['app-config', `app-config:${section}`],
      revalidate: 3600,
    },
  )();
```

Invalidation après PATCH :

```ts
revalidateTag('app-config');
revalidateTag(`app-config:${section}`);
```

→ Les autres sections restent en cache, propre.

## Détection « isDefault »

Côté API et UI, on veut savoir si une section est en **défaut codé**
ou en **valeur DB** (pour afficher des badges).

```ts
function computeIsDefault<S extends Section>(
  section: S,
  payload: AppConfigBySection[S],
): boolean {
  return JSON.stringify(payload) === JSON.stringify(defaultConfig[section]);
}
```

Calcul stable car `JSON.stringify` ordonne les clés en deepMerge
(via une normalize-keys fonction maison).

→ Optimisation possible : flag `is_default` matérialisé en DB.
   V1 : on calcule à chaque lecture (≤ 4 sections, négligeable).

## Migration entre schémas

Si on renomme un champ Zod (ex: `colors.primary` → `colors.brand`) :

- Le snapshot legacy a `colors.primary`
- Au load : Zod fail → fallback default → log warn
- Pour migrer proprement : ajouter une fonction
  `migratePayload(section, raw)` appelée **avant** Zod, qui patche
  les anciens shapes vers le nouveau

```ts
const migrators: Record<Section, (raw: unknown) => unknown> = {
  branding: (raw) => {
    if (typeof raw === 'object' && raw && 'colors' in raw) {
      const c = (raw as any).colors;
      if (c.primary && !c.brand) {
        return { ...raw, colors: { ...c, brand: c.primary } };
      }
    }
    return raw;
  },
  nav: (raw) => raw,
  flags: (raw) => raw,
  rbac: (raw) => raw,
};
```

Au PATCH suivant, le payload migré est ré-écrit en DB en version
courante.

## Tests cascade

Fixtures dans `__fixtures__/cascade.ts` :

| Cas                                | DB                | Résultat |
|------------------------------------|-------------------|----------|
| Pas de ligne                       | -                 | default codé |
| Ligne identique au default         | `default`         | default (rien à merge) |
| Ligne avec 1 champ override        | `{ siteName: 'X' }` | default + siteName='X' |
| Ligne corrompue                    | `{ items: 'pas-un-array' }` | default + warn |
| Ligne avec champ inconnu           | `{ ..., extraField: 1 }` | default merge (Zod strip extras) |
| Ligne avec migration nécessaire    | legacy shape      | migrator → default + champs migrés |

100% des branches couvertes.
