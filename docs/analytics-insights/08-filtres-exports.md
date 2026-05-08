# 08 — Filtres & exports

> *Filtres globaux, exports CSV/PNG, partage URL*

---

## 1. Filtres globaux

Définis dans `<InsightsFilters>`, persistés dans l'URL via
`useInsightsFilters()`.

| Filtre              | Valeurs                                                   | Default |
| ------------------- | --------------------------------------------------------- | ------- |
| `window`            | today / yesterday / 7d / 30d / 90d / custom / all         | 7d      |
| `customFrom` / `customTo` | YYYY-MM-DD (si window = custom)                       | —       |
| `env`               | production / stage / preview / dev / all                  | all     |
| `device`            | mobile / desktop / tablet / unknown / all                 | all     |
| `locale`            | fr-MA / ar-MA / fr-FR / unknown / all                     | all     |
| `trafficSource`     | direct / google / facebook / instagram / … / all          | all     |

## 2. Période

Calculée serveur-side dans `lib/analytics/insights/filters.ts` :

```ts
export function resolveWindow(filters: InsightsFilters): { from: Date; to: Date } {
  const now = new Date();
  switch (filters.window) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday':
      return { from: startOfDay(addDays(now, -1)), to: endOfDay(addDays(now, -1)) };
    case '7d':
      return { from: startOfDay(addDays(now, -7)), to: endOfDay(now) };
    case '30d':
      return { from: startOfDay(addDays(now, -30)), to: endOfDay(now) };
    case '90d':
      return { from: startOfDay(addDays(now, -90)), to: endOfDay(now) };
    case 'all':
      return { from: new Date('2024-01-01'), to: endOfDay(now) };
    case 'custom':
      if (!filters.customFrom || !filters.customTo) {
        throw new HttpError('invalid_input', 'customFrom et customTo requis');
      }
      const from = startOfDay(new Date(filters.customFrom));
      const to = endOfDay(new Date(filters.customTo));
      const days = (to.getTime() - from.getTime()) / 86400000;
      if (days > 365) throw new HttpError('invalid_input', 'Window > 365j non supporté');
      return { from, to };
  }
}
```

## 3. Persistence URL

```
/admin/analytics/insights?window=30d&env=production&device=mobile
/admin/analytics/insights?window=custom&customFrom=2026-01-01&customTo=2026-03-31
```

URL = source de vérité. Hook `useInsightsFilters` parse + sérialise.
Partage par lien direct.

## 4. UI panneau de filtres

```
┌────────────────────────────────────────────────────────────────┐
│ [Période ▾] [Env ▾] [Device ▾] [Locale ▾] [Source ▾]  [Reset]  │
└────────────────────────────────────────────────────────────────┘
```

- Tous les selects ont un libellé visible
- Reset = tous les filtres à leur default
- Update = navigation immédiate vers la nouvelle URL (router.replace)
- Debounce 300 ms si custom range tapé

## 5. Période précédente

Pour calculer les variations (KPIs `+14 % vs 7 jours préc.`), on
compare la fenêtre actuelle à la **fenêtre précédente de même durée**.

Ex : `window=7d` → période actuelle [today-7, today], période
précédente [today-14, today-7].

## 6. Export CSV

Bouton dans chaque panneau (`<ExportButton>`).

```
GET /api/admin/analytics/insights/export?view=pages&window=30d&env=production
```

Réponse :

```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="insights-pages-2026-05-07.csv"

route,page_views,sessions,scroll_75_count,conversions,bounce_rate
/,8240,5100,2142,12,0.38
/kit,3410,2800,2284,31,0.22
```

**BOM UTF-8** en début pour Excel/Numbers compatibility.

**Limites** :
- 100 000 lignes max par export
- Tableaux normalisés (pas de JSON imbriqué)
- Filtres URL respectés

**Vues exportables** :
- `overview` (KPIs + timeseries)
- `events` (top events)
- `pages` (top pages)
- `components` (top composants)
- `dead_components`
- `sections` (top sections)
- `funnel` (étapes + drop-offs)

## 7. Export PNG (V2)

Capture côté client via `canvas` :

```ts
async function exportSvgAsPng(svgEl: SVGSVGElement): Promise<Blob> {
  const xml = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([xml], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = svgEl.clientWidth * 2; // retina
  canvas.height = svgEl.clientHeight * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FBF8F1';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej()), 'image/png'));
}
```

## 8. Audit log exports

Chaque export trace :

```jsonc
{
  "action": "export_download",
  "resource": "tracking_inventory",
  "actorId": "adm_xxx",
  "meta": {
    "domain": "insights",
    "view": "pages",
    "window": "30d",
    "env": "production",
    "rows": 1240
  }
}
```

## 9. Sécurité

- Tous les filtres validés Zod côté serveur
- Window > 365j refusée (422)
- Export > 100k lignes refusé (422)
- BOM UTF-8 forcé pour éviter mojibake Excel
- `Content-Disposition: attachment` pour empêcher l'inline render

## 10. Tests

Cf. [09-tests.md](09-tests.md). Quelques scénarios clés :

- Filtres persistés après reload (URL = state)
- Reset remet tous les filtres à default
- Custom range > 365j → erreur 422 sans crash
- Export CSV produit du UTF-8 valide ouvert dans Excel
- Period comparison pour les variations KPI fonctionne

## 11. Lecture suivante

- [09 — Tests](09-tests.md) pour les scénarios.
- [05 — UI / UX](05-ui-ux-design.md) pour le rendu visuel.
