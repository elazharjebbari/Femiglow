# Lighthouse — audit perf & a11y du module Insights

> *Procédure pour vérifier les cibles de performance et d'accessibilité
> définies dans le cahier des charges (`perf ≥ 90`, `a11y ≥ 95`).*

---

## 1. Cible

| Métrique          | Seuil V1 | Seuil V1.3 |
| ----------------- | -------- | ---------- |
| Performance       | ≥ 80     | ≥ 90       |
| Accessibility     | ≥ 90     | ≥ 95       |
| Best Practices    | ≥ 90     | ≥ 95       |
| SEO (admin = N/A) | —        | —          |

## 2. Local — `npx lighthouse`

```bash
# Pré-requis : serveur dev tourne sur http://localhost:3000
pnpm --filter @femiglow/web dev

# Dans un autre shell :
npx lighthouse \
  http://localhost:3000/admin/analytics/insights \
  --view \
  --preset=desktop \
  --only-categories=performance,accessibility,best-practices \
  --output=html \
  --output-path=./lighthouse-insights.html
```

> **Auth** : la page `/admin/analytics/insights` redirige vers `/login`
> sans cookie. Pour un audit signed-in, utiliser le mode "headful" et
> se connecter manuellement avant de lancer Lighthouse.

## 3. Sur preview Vercel

```bash
# Une fois que la PR a une preview URL :
PREVIEW_URL="https://<branch>.femiglow.vercel.app"
npx lighthouse \
  "$PREVIEW_URL/admin/analytics/insights" \
  --output=json \
  --output-path=./lighthouse-preview.json
```

Vérifier les seuils :

```bash
node -e "
const r = require('./lighthouse-preview.json');
const cats = r.categories;
console.log('perf:', Math.round(cats.performance.score * 100));
console.log('a11y:', Math.round(cats.accessibility.score * 100));
console.log('bp:', Math.round(cats['best-practices'].score * 100));
"
```

## 4. Optimisations connues si seuils non atteints

### 4.1 Performance < 90

| Symptôme                                  | Action                                              |
| ----------------------------------------- | --------------------------------------------------- |
| LCP > 2.5s                                 | Activer `loading="lazy"` sur les images (admin)      |
| TBT > 200ms                                | Lazy-load `<InsightsView>` via `next/dynamic`        |
| Bundle > 80 kB gzip                        | Audit avec `pnpm bundle:analyze`                    |
| First refresh lent                         | Pré-warm refresh dans `requireAdmin()` ?            |

### 4.2 Accessibility < 95

| Règle qui rate                            | Solution                                            |
| ----------------------------------------- | --------------------------------------------------- |
| `color-contrast` sur `<h2>` panels         | Vérifier ratio ≥ 4.5 en mode sombre                  |
| `aria-valid-attr-value`                    | Ne pas mettre `:` dans les `id` (utiliser `useId()` + replace) |
| `tablist` direct child                     | Ne pas wrapper les tabs avec `<ul>/<li>`             |

Cf. tests automatisés `__a11y__.test.tsx` qui couvrent déjà les
composants individuels.

## 5. CI (V2)

À ajouter dans `.github/workflows/lighthouse.yml` :

```yaml
- name: Lighthouse CI
  uses: treosh/lighthouse-ci-action@v10
  with:
    urls: |
      https://femiglow.vercel.app/admin/analytics/insights
    uploadArtifacts: true
    temporaryPublicStorage: true
    runs: 3
    configPath: ./.lighthouserc.json
```

Avec `.lighthouserc.json` :

```json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }]
      }
    }
  }
}
```

## 6. Troubleshooting

| Problème                                          | Solution                                                |
| ------------------------------------------------- | ------------------------------------------------------- |
| `lighthouse` introuvable                           | `npx lighthouse` (pas besoin d'install global)           |
| Erreur "Chromium not found"                        | `npx lighthouse --chrome-flags="--no-sandbox"`           |
| Page redirige vers /login                          | Audit en mode headful + login manuel                     |
| Score perf = 0 (Cloudflare 403)                    | Use `--throttling-method=devtools` au lieu de `simulate` |

## 7. Date du dernier audit

À remplir lors du go-live preview :

| Date       | Perf | A11y | BP | Auteur |
| ---------- | ---- | ---- | -- | ------ |
| 2026-05-08 | TBD  | TBD  | TBD | (preview à lancer) |
