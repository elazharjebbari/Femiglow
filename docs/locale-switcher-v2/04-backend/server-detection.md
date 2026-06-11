# Server-side Detection — `resolveSuggestedLocale()`

> **Source de vérité** : [`../CONTRACT.md`](../CONTRACT.md) §2 (`resolveSuggestedLocale()` → `apps/web/src/lib/i18n/suggested-locale.ts`), §6 (invariants), dossier §8/§10.4 (nudge D4).
> **Précédent projet** : `apps/web/src/i18n.config.ts` (`LOCALES`, `coerceLocale`, `LOCALE_COOKIE_NAME = 'NEXT_LOCALE'`), `02-design-conception/locale-detection.md` (V1).
> Fixtures de test : [`../03-data/fixtures.json`](../03-data/fixtures.json) → `acceptLanguageFixtures`.

---

## 1. Rôle & garantie « no-flash »

Le nudge contextuel (CONTRACT §1) ne doit apparaître que si la **langue du navigateur ≠ langue servie**. Le calcul est fait **entièrement côté serveur** (RSC / layout), et le résultat est **passé en prop** au composant `LocaleNudge`. Aucune décision n'est prise côté client → **pas de flash** (le nudge est soit rendu dès le HTML, soit absent ; il n'apparaît jamais après coup).

> **Invariant no-flash** : la détection est résolue avant le premier paint. On ne lit jamais `navigator.language` côté client pour décider d'afficher le nudge (cela causerait un flash + hydration mismatch). Cf. dossier §10.4 « résolu **côté serveur**, pas de flash ».

```
RSC layout (app/[locale]/layout.tsx)
  ├─ const acceptLanguage = headers().get('accept-language')
  ├─ const cookieLocale   = cookies().get('NEXT_LOCALE')?.value ?? null
  ├─ const dismissed      = cookies().get('locale_nudge_dismissed') != null
  ├─ const cfg            = await getPublicLocaleConfig()   // enabledLocales
  ├─ const suggested = dismissed ? null : resolveSuggestedLocale({
  │       acceptLanguage, cookieLocale, servedLocale: locale,
  │       enabledLocales: cfg.payload.locales.filter(l => l.enabled).map(l => l.code),
  │     })
  └─ <LocaleNudge suggested={suggested} served={locale} />   // prop, pas de fetch client
```

---

## 2. Signature (pure, testable, sans réseau)

```ts
// apps/web/src/lib/i18n/suggested-locale.ts
import type { Locale } from '@/i18n.config';

export function resolveSuggestedLocale(input: {
  acceptLanguage: string | null;   // header brut "ar-MA,ar;q=0.9,fr;q=0.5"
  cookieLocale: Locale | null;     // NEXT_LOCALE — choix explicite mémorisé
  servedLocale: Locale;            // locale du segment URL courant
  enabledLocales: readonly Locale[]; // locales enabled en config (jamais suggérer une désactivée)
}): Locale | null;                 // null = pas de nudge
```

Fonction **pure** : aucune lecture de `headers()`/`cookies()` à l'intérieur (le caller les fournit) → triviale à tester unitairement avec `acceptLanguageFixtures`.

---

## 3. Règles de précédence (ordre d'évaluation)

Évaluées dans l'ordre ; la **première** qui tranche gagne :

1. **Cookie explicite gagne** — si `cookieLocale != null` (l'utilisateur a déjà choisi via `NEXT_LOCALE`) ⇒ **`null`** (on ne suggère rien : choix respecté). *Précédence cookie > Accept-Language.*
2. **Parse `Accept-Language`** — extraire les paires `(langTag, q)`, tri q décroissant, normaliser `ar-MA → ar` (langue primaire), ignorer `*` et q=0.
3. **Filtre supporté + enabled** — ne garder que les langues ∈ `enabledLocales`. Prendre la première (plus haut q). Si aucune ⇒ **`null`** (on ne pousse jamais une langue non demandée / non servable).
4. **No-op si == served** — si la candidate == `servedLocale` ⇒ **`null`** (déjà dans la bonne langue).
5. Sinon ⇒ retourner la **candidate** (déclenche le nudge `locale_nudge_shown`).

| Entrée | Sortie | Règle |
|---|---|---|
| cookie=`en`, served=`en`, AL=`ar` | `null` | (1) cookie explicite |
| cookie=∅, served=`fr`, AL=`ar-MA,ar;q=.9` | `ar` | (2→5) |
| cookie=∅, served=`fr`, AL=`de,es` | `null` | (3) aucune supportée |
| cookie=∅, served=`fr`, AL=`fr-FR,fr` | `null` | (4) == served |
| cookie=∅, served=`fr`, AL=`ar`, ar **disabled** | `null` | (3) non servable |
| cookie=∅, served=`fr`, AL=`""` / `*` | `null` | (2) aucune préférence |

---

## 4. Cookies impliqués

| Cookie | Rôle | Écrit par |
|---|---|---|
| `NEXT_LOCALE` | Choix explicite de langue (next-intl, 1 an, `SameSite=Lax`). Sa **présence** suffit à supprimer le nudge (précédence 1). | next-intl / `useLocaleTransition` au switch |
| `locale_nudge_dismissed` | **One-shot** du nudge. Posé au dismiss **ou** à l'acceptation. Sa présence ⇒ on ne calcule même pas `suggested` (court-circuit côté caller). `SameSite=Lax`, longue durée. | `LocaleNudge` (client) au dismiss/accept |

> Le `maxImpressionsPerVisitor` de la config borne le nombre d'affichages ; le cookie `locale_nudge_dismissed` **scelle** le one-shot de façon permanente (CONTRACT §3 nudge ; dossier §10.4 « dismiss permanent »).

---

## 5. Stance de confidentialité (privacy)

- **Aucune géolocalisation IP.** On ne lit jamais l'IP ni un header de géoloc (`x-vercel-ip-country`, `cf-ipcountry`, etc.) pour suggérer une langue. La détection repose **uniquement** sur la préférence déclarée du navigateur (`Accept-Language`) + le choix mémorisé (`NEXT_LOCALE`).
- **Rationale** : (a) éviter de présumer la langue depuis la nationalité (anti-pattern « drapeau = langue », dossier §6) ; (b) minimiser les données traitées (pas de PII de localisation) ; (c) `Accept-Language` est une préférence *exprimée*, pas une déduction.
- **Pas de PII dans la télémétrie** associée (cf. `events-telemetry.json` : `suggested`/`served`/`page` uniquement).

---

## 6. Interaction avec les invariants

- **No-flash** (cf. §1) : résolu serveur, prop client. Pas de lecture `navigator.language`.
- **INV-5** : jamais de nudge sur `/admin/*` ni pendant le wizard checkout (le caller ne monte pas `LocaleNudge` sur ces surfaces).
- **INV-12** : si `getPublicLocaleConfig()` retombe sur les defaults, `enabledLocales` reste cohérent (les 3 locales) → détection fonctionnelle même config DB invalide.

---

## 7. Éléments à VÉRIFIER / TESTER

### Fonctionnel
- [ ] Tous les `acceptLanguageFixtures` → `expectedSuggested` (table §3).
- [ ] Parsing q : tri correct, `ar-MA→ar`, `*` et q=0 ignorés.
- [ ] Cookie `NEXT_LOCALE` présent ⇒ toujours `null`.
- [ ] `locale_nudge_dismissed` présent ⇒ caller court-circuite (pas d'appel, pas de nudge).

### Intégrité / cohérence config
- [ ] Suggested ∈ `enabledLocales` toujours ; locale désactivée jamais suggérée.
- [ ] served == suggested ⇒ `null`.

### Sécurité / privacy
- [ ] La fonction ne lit **aucun** header IP/géoloc (revue de code + test : passer des headers géoloc ne change pas la sortie).
- [ ] Aucune PII émise ni journalisée.

### No-flash (E2E Playwright)
- [ ] FR servi + navigateur AR ⇒ le nudge est présent **dans le HTML initial** (pas d'apparition post-hydratation, pas de layout shift).
- [ ] Après dismiss + reload ⇒ nudge absent dès le HTML (cookie respecté).

### Modes de défaillance
- [ ] `acceptLanguage = null` / `""` / `*` ⇒ `null`, pas de throw.
- [ ] Header malformé (`ar;q=abc`) ⇒ ignoré proprement (pas de throw), sortie `null` ou candidate valide restante.
- [ ] Config DB invalide (defaults) ⇒ détection toujours opérationnelle (INV-12).
