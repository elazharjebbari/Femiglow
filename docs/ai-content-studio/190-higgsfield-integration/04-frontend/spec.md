# Frontend Integration Specification -- Higgsfield AI Provider

**Date:** 2026-05-27
**Status:** No frontend code changes required
**Scope:** How the existing provider-agnostic UI surfaces Higgsfield data

---

## 1. Executive Summary

The AI Engine frontend (Config page, ModelSelector, API Keys tab) is fully
provider-agnostic. Every UI component renders from data returned by the
backend API. Adding Higgsfield to the backend automatically surfaces it in
the UI without modifying a single React file.

This document specifies *what the user will see* once the backend registers
Higgsfield, and which design tokens / layout rules apply.

---

## 2. Provider Card Grid (Fournisseurs Tab)

### 2.1 Where It Appears

`page.tsx` renders a responsive CSS Grid:

```
gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))'
```

Higgsfield will occupy one cell alongside the existing providers (OpenAI,
Anthropic, Google, ElevenLabs, Ollama). Ordering follows the array returned
by `GET /api/admin/ai-engine/config/providers`.

### 2.2 Card Anatomy

```
+------------------------------------------------------+
| === (3px health status bar: green/amber/red/grey) === |
|                                                      |
|  [CPU icon]  Higgsfield AI                           |
|              Priorite 15          [o Actif]           |
|                                                      |
|  [Image]  [Video]                                    |
|                                                      |
|  ------------------------------------------------    |
|  higgsfield-diffusion-v2               5c/u          |
|  ------------------------------------------------    |
|  higgsfield-video-v1                  20c/u          |
|  ------------------------------------------------    |
|                                                      |
|  Shield 0.20 MAD/j     Zap 60/min   [Editer] [Tester]|
+------------------------------------------------------+
```

### 2.3 Health Status Bar

The 3px colored bar at the top of the card is driven by `provider.healthStatus`:

| healthStatus | CSS variable       | Visual     |
|--------------|--------------------|------------|
| `healthy`    | `var(--cs-success)` | Green bar  |
| `degraded`   | `var(--cs-warning)` | Amber bar  |
| `unhealthy`  | `var(--cs-danger)`  | Red bar    |
| (unconfigured) | `var(--cs-border)` | Grey bar   |

When `configured === false`, the status dot next to the provider name is
grey (`var(--cs-fg-muted)`) and the badge reads "Inactif".

When `configured === true`, the dot is green (`var(--cs-success)`) and the
badge reads "Actif".

### 2.4 Capability Badges

Higgsfield declares `capabilities: ['image', 'video']`. The existing
`CAPABILITY_COLORS` and `CAPABILITY_LABELS` maps produce:

| Capability | Label  | Color token          | Rendered background               |
|------------|--------|----------------------|-----------------------------------|
| `image`    | Image  | `var(--cs-saffron)`  | `color-mix(in srgb, saffron 10%)` |
| `video`    | Video  | `var(--cs-violet)`   | `color-mix(in srgb, violet 10%)`  |

Both badges appear in the capabilities row, left-to-right.

### 2.5 Model List

The card shows up to 3 models. Higgsfield has exactly 2 models:

| Model name               | Display cost | Notes                  |
|--------------------------|-------------|------------------------|
| higgsfield-diffusion-v2  | `5c/u`      | costPerUnit = 500 cents / 100 |
| higgsfield-video-v1      | `20c/u`     | costPerUnit = 2000 cents / 100 |

Since model count (2) <= maxModels (3), no "plus N autres modeles" line
appears.

### 2.6 Footer Metadata

- Budget: `dailyBudgetCents / 100` formatted as `X.XX MAD/j`
  - Default: `Math.round(config.budget.dailyCents * 0.2) / 100`
- Rate limit: `rateLimitRpm` formatted as `60/min`
- Both are shown inline with Shield and Zap icons.

### 2.7 Card Opacity

`isEnabled: true` => opacity 1 (full)
`isEnabled: false` => opacity 0.55 (dimmed)

---

## 3. Inline Edit Form

Clicking "Editer" on the Higgsfield card opens the inline edit panel below
the card body. The form contains:

| Field              | Type     | Default     | Notes                    |
|--------------------|----------|-------------|--------------------------|
| Priorite           | number   | 15          | min 1, max 100           |
| Budget quotidien   | number   | (computed)  | In MAD, converted to cents |
| Rate limit (req/min) | number | 60          | min 1, max 10000         |
| Actif              | checkbox | true        |                          |
| Fallback           | checkbox | false       |                          |
| Modeles            | ModelSelector | (2 models) | See section 4        |

The "URL de base Ollama" field is NOT shown because
`provider.providerType !== 'ollama'`.

Save sends `POST /api/admin/ai-engine/config/providers` with the edited
fields. Success shows green feedback "Configuration sauvegardee" for 1.2s,
then closes the form. Error shows red feedback "Erreur lors de la
sauvegarde" and the form stays open.

---

## 4. ModelSelector Popover

### 4.1 Discovery Flow

When the user opens the ModelSelector for the Higgsfield provider:

1. Component calls `GET /api/admin/ai-engine/config/providers/models?provider=higgsfield`
2. Backend calls `model-discovery.ts` `discoverModels('higgsfield')`
3. If live fetch succeeds: returns live models with `source: 'live'`
4. If live fetch fails: returns `FALLBACK_MODELS.higgsfield` with `source: 'fallback'`
5. Subsequent opens use the in-memory cache (`source: 'cache'`)

### 4.2 Model Entries

```
+--------------------------------------------------+
| Rechercher un modele...                          |
|--------------------------------------------------|
|  [ ] higgsfield-diffusion-v2          [IMAGE]    |
|  [x] higgsfield-video-v1             [VIDEO]    |
|--------------------------------------------------|
| o Live (2 modeles)                 [Refresh]     |
+--------------------------------------------------+
```

### 4.3 Role Badge Colors

The `ROLE_COLORS` map in `ModelSelector.tsx` currently has entries for
`chat`, `embedding`, `tts`, and `image`. Higgsfield models will use:

| role    | Existing entry? | Badge background                         | Badge foreground |
|---------|-----------------|------------------------------------------|-----------------|
| `image` | Yes             | `color-mix(in srgb, #8b5cf6 18%, transparent)` | `#8b5cf6`       |
| `video` | No (falls back) | `var(--cs-accent-bg)` (chat default)     | `var(--cs-accent)` |

**Recommended enhancement (optional):** Add a `video` entry to `ROLE_COLORS`:
```typescript
video: { bg: 'color-mix(in srgb, #a855f7 18%, transparent)', fg: '#a855f7' },
```

This would give video models a purple badge consistent with `--cs-violet`.

### 4.4 Source Indicator

| source     | Dot color | Label    |
|------------|-----------|----------|
| `live`     | #22c55e   | Live     |
| `cache`    | #3b82f6   | Cache    |
| `fallback` | #f59e0b   | Statique |

### 4.5 Custom Model Entry

If the user types a model name not in the discovered list, the "Ajouter"
option appears. This works identically for Higgsfield as for other providers.

---

## 5. API Keys Tab (Cles API)

### 5.1 Key Card

Once `api-key-manager.ts` includes Higgsfield, `GET /config/api-keys`
returns a Higgsfield entry. The card renders in the keys grid:

```
+------------------------------------------------------+
|  Higgsfield AI                    [Non configure]    |
|  Non configure                                       |
|                                                      |
|                                                      |
+------------------------------------------------------+
```

When configured via database:

```
+------------------------------------------------------+
|  Higgsfield AI                    [Base de donnees]  |
|  Production key                                      |
|  hf-****ab12                           [Valide]      |
|  Dernier test: 27 mai, 14:32                         |
|                                                      |
|  [Tester]                               [Supprimer]  |
+------------------------------------------------------+
```

When configured via environment variable:

```
+------------------------------------------------------+
|  Higgsfield AI                    [Env var]          |
|  Variable d'environnement                            |
|  hf-****cd34                                         |
|                                                      |
|  [Tester]                                            |
+------------------------------------------------------+
```

### 5.2 Badge Tones

| source     | Badge tone | Badge text        |
|------------|-----------|-------------------|
| `database` | `accent`  | Base de donnees   |
| `env`      | `sage`    | Env var           |
| `none`     | `neutral` | Non configure     |

### 5.3 Add Key Form

The "Ajouter une cle" form currently has a `<select>` with 5 options
(openai, anthropic, google, elevenlabs, ollama). After backend integration,
Higgsfield must be added as a 6th option:

```html
<option value="higgsfield">Higgsfield AI</option>
```

**Note:** This is the ONE optional UI change. The provider select in the
API key form is currently hardcoded. To make it fully dynamic, the form
should derive options from the `apiKeys` list (which already contains all
registered providers).

### 5.4 Test Key Flow

1. User clicks "Tester" on the Higgsfield card
2. UI sends `POST /config/api-keys/test` with `{ providerType: 'higgsfield' }`
3. Backend calls `testHiggsfield(apiKey, start)` in `api-key-validator.ts`
4. On success: toast "higgsfield -- Cle valide (120ms)"
5. On failure: toast "higgsfield -- Invalid API key"
6. On 429: toast "Trop de tentatives. Reessayez dans 1 minute."

---

## 6. Stat Cards

The 5 stat cards at the top of the Configuration page are computed from
the providers/workflows/prompts/apiKeys state:

| Stat                  | Impact of Higgsfield                                    |
|-----------------------|---------------------------------------------------------|
| Fournisseurs actifs   | Count increments: e.g. `4/7` becomes `5/8` (if configured) |
| Workflows actifs      | No change (workflow count is independent of providers)  |
| Prompts versionnes    | No change                                               |
| Budget quotidien total | Adds Higgsfield dailyBudgetCents to the sum            |
| Cles configurees      | Increments if Higgsfield key source !== 'none'          |

---

## 7. ASCII Mockup -- Full Provider Card

```
+-----------------------------------------------------------------+
|=== [#22c55e 3px solid - healthy] ===============================|
|                                                                 |
|  +------+  Higgsfield AI                                        |
|  | [Cpu]|  Priorite 15                     ( o ) Actif          |
|  +------+                                                       |
|                                                                 |
|  +--------+  +--------+                                         |
|  | Image  |  | Video  |                                         |
|  +--------+  +--------+                                         |
|  (saffron)   (violet)                                           |
|                                                                 |
|  -----------------------------------------------------------    |
|  higgsfield-diffusion-v2                            5c/u        |
|  -----------------------------------------------------------    |
|  higgsfield-video-v1                               20c/u        |
|  -----------------------------------------------------------    |
|                                                                 |
|  [Shield] 0.20 MAD/j   [Zap] 60/min    [Editer]  [Tester]     |
+-----------------------------------------------------------------+
```

---

## 8. ASCII Mockup -- ModelSelector with Higgsfield Models

```
+---------------------------------------------------+
| [Search icon] Rechercher un modele...             |
|---------------------------------------------------|
|  [x] higgsfield-diffusion-v2         [IMAGE]      |
|                                      (#8b5cf6)    |
|                                                   |
|  [x] higgsfield-video-v1            [VIDEO]       |
|                                      (--cs-accent)|
|                                                   |
|---------------------------------------------------|
| (o) Live  (2 modeles)               [Refresh]     |
+---------------------------------------------------+
```

---

## 9. Design Tokens Reference

| Token                  | Usage in Higgsfield context                |
|------------------------|--------------------------------------------|
| `--cs-saffron`         | Image capability badge foreground           |
| `--cs-violet`          | Video capability badge foreground            |
| `--cs-success`         | Healthy status bar, configured dot          |
| `--cs-warning`         | Degraded status bar                         |
| `--cs-danger`          | Unhealthy status bar, delete buttons        |
| `--cs-border`          | Unconfigured status bar                     |
| `--cs-accent`          | Active tab highlight, accent badge tone     |
| `--cs-accent-bg`       | Provider icon background (configured)       |
| `--cs-bg-elevated`     | Card background                             |
| `--cs-bg-sunken`       | Code mask background, inactive icon bg      |
| `--cs-font-display`    | Provider name, section headings             |
| `--cs-font-mono`       | Model names, masked key display             |
| `--cs-text-xs`         | Capability badges, metadata, role badges    |
| `--cs-text-sm`         | Provider name, form labels                  |
| `--cs-radius-md`       | Card border radius                          |
| `--cs-radius-sm`       | Badge border radius, input border radius    |
| `--cs-shadow-sm`       | Card box shadow                             |

---

## 10. Responsive Behavior

The provider card grid uses `repeat(auto-fill, minmax(320px, 1fr))`.
On viewports narrower than ~680px, cards stack into a single column.
Higgsfield's card follows the same responsive rules as all other providers.

The API key grid uses `repeat(auto-fill, minmax(340px, 1fr))` -- identical
behavior applies.

---

## 11. Dark Mode

All colors reference CSS custom properties (--cs-*), which are theme-aware.
The dark mode palette is defined in the design system's theme layer. Since
Higgsfield uses only existing tokens, dark mode rendering requires no
additional work.

---

## 12. Accessibility

- Provider cards have semantic heading structure (provider name in a div
  with `fontWeight: 500`, read as implicit heading by screen readers)
- Capability badges use `color-mix` backgrounds with sufficient contrast
  ratios against both light and dark backgrounds
- Edit form inputs have associated labels (via the `Input` component's
  `label` prop)
- Toggle switches use `role="switch"` and `aria-checked`
- ModelSelector trigger uses `aria-haspopup="listbox"` and `aria-expanded`
- Delete confirmation uses visible text rather than `window.confirm` for
  API keys (inline banner pattern)

---

## 13. Optional UI Enhancement

**Provider select in API key form (line ~1956 of page.tsx):**

The `<select>` for choosing a provider when adding an API key is currently
hardcoded to 5 options. For Higgsfield to appear, either:

1. Add a `<option value="higgsfield">Higgsfield AI</option>` entry, or
2. Refactor to derive options from the `apiKeys` array:

```tsx
{apiKeys
  .filter((k, i, arr) => arr.findIndex(a => a.providerType === k.providerType) === i)
  .map((k) => (
    <option key={k.providerType} value={k.providerType}>
      {k.providerName}
    </option>
  ))}
```

Approach (2) is recommended for future-proofing (any new provider
auto-appears).
