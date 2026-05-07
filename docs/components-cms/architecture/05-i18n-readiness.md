# A5 — i18n readiness

## Position en v1

**Une seule locale active : `'fr'`.** Toute l'UI admin et tout le
rendu public sont en français. Aucune sélection de langue n'est
exposée à l'éditeur.

**Mais le modèle, l'API, la cascade et les éditeurs sont déjà
locale-aware.** Cf. D3 dans A1 : ajouter `locale` plus tard sur 5 000
lignes serait coûteux et risqué. On paie la colonne dès le jour 1
(coût zéro, on insère toujours `'fr'`).

## Ce qui est déjà prêt

| Couche | État |
|---|---|
| Schéma DB | `locale` NOT NULL DEFAULT `'fr'` sur `componentFieldBindings` |
| Index | unique partial sur `(componentId, fieldKey, locale, status)` |
| Résolveur | `resolveComponentFields(componentKey, locale)` |
| Cache | tag `components:fields:<key>:<locale>` (locale incluse) |
| API REST | `GET /api/admin/components/[key]/fields?locale=fr` (param accepté) |
| Type | `ResolvedField.meta.locale` |
| Cron promote | filtre par `locale` sur les bindings scheduled |
| Sanitization rich-text | indépendante de la locale (HTML/markdown) |

## Ce qui n'est PAS fait en v1

| Sujet | Statut |
|---|---|
| Sélecteur de langue dans l'admin | Non exposé |
| Multi-locale dans l'éditeur | Un seul champ à la fois (FR) |
| Détection de la locale au runtime public | URL toujours en FR |
| Fallback configurable | Hardcodé `defaultLocale = 'fr'` |
| Pluralisation, formatage de dates par locale | Non |
| RTL (`dir='rtl'`) pour `'ar'` | Layout pas testé |
| Traduction des labels admin | Tous en FR |

## Plan d'évolution v2 (multilingue)

### v2.0 — Lecture multi-locale

1. Ajouter `defaultLocale` et `supportedLocales` à la config site
   (env ou `siteConfig`).
2. Le résolveur tente `locale` demandée → `defaultLocale` → `defaultValue`.
3. Le rendu public reçoit la locale via le segment URL (`/fr/...`,
   `/en/...`).
4. **Aucune migration DB.** Les bindings `'fr'` restent. On commence
   à pouvoir **lire** des bindings `'en'` quand ils existent.

### v2.1 — Édition multi-locale

1. UI admin : sélecteur de langue dans le bandeau du formulaire.
2. Chaque éditeur reçoit `(value, locale)` et le state du form devient
   `Map<{ fieldKey, locale }, FieldDirtyState>`.
3. Bouton **« Copier de FR »** par champ (one-shot, l'admin édite ensuite).
4. Status badge par locale dans la liste des champs.

### v2.2 — Workflow de traduction

1. Statut intermédiaire `'translation-pending'` (sub-état de `draft`).
2. Webhook vers un service de traduction (DeepL / Lokalise) au choix.
3. Notification admin quand la traduction est prête.

Aucune de ces évolutions ne casse le contrat de la v1.

## Conventions de code

### Locales BCP-47

```ts
type Locale = 'fr' | 'en' | 'ar';   // future
const DEFAULT_LOCALE: Locale = 'fr';
const SUPPORTED_LOCALES: Locale[] = ['fr'];   // v1
```

### Fallback explicite

```ts
function resolveLocale(requested: string): Locale {
  if (SUPPORTED_LOCALES.includes(requested as Locale)) return requested as Locale;
  return DEFAULT_LOCALE;
}
```

### Logging

Quand un fallback de locale se produit en lecture publique, on logue
`field.locale.fallback` { componentKey, fieldKey, requested, fallback }.
Permet de mesurer l'urgence d'une traduction quand v2 sera ouverte.

## Tests qui anticipent v2

Même en v1, on écrit des tests qui passent une autre locale pour
vérifier que la cascade tombe correctement sur `defaultValue` :

```ts
it('falls back to defaultValue when locale is not yet translated', async () => {
  const fields = await resolveComponentFields('home-hero', 'en');
  expect(fields.title.meta.source).toBe('default');
});
```

Ces tests garantissent que la migration v2 sera détectable
(cassante uniquement si on change les défauts).

## Coût direct de cette readiness

| Sujet | Coût v1 | Coût ajout en v2 |
|---|---|---|
| Colonne `locale` | +0 (NOT NULL DEFAULT 'fr') | n/a |
| Cache tag | +0 (1 niveau de granularité) | n/a |
| Param API | +0 (param ignoré sauf 'fr') | n/a |
| UI multi-locale | n/a | ~5 j homme (sélecteur + copy-from-fr) |
| Cron filter locale | +0 (clause WHERE déjà présente) | n/a |

Total v1 : **0 jour homme additionnel**. ROI v2 : **~10 j homme
économisés** sur la migration DB et la rétro-fitting des bindings
existants.

## Cas particulier des `kicker` et `quote`

Certains kickers (« Notre rituel ») ou quotes peuvent être imbriqués
dans un layout très dépendant de la longueur (ex : sticker rotatif,
diagonale). Le typage doit autoriser un overflow contrôlé via le
`config.maxLength` du registre. Les locales avec textes plus longs
(allemand, arabe en orientation) seront contraints par ce cap.
