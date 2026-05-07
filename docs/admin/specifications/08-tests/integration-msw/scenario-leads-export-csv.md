# scenario-leads-export-csv

| Aspect | Valeur |
|---|---|
| Domaine | leads |
| Composant | `ExportButton` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/ExportButton.integration.test.tsx` |
| Référence | F-LEADS-06 |

## Préconditions
- L'utilisateur est sur `/admin/leads` avec d'éventuels filtres actifs.
- Le bouton "Exporter CSV" est visible.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('*/api/admin/leads', ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.get('format') !== 'csv') {
      return HttpResponse.json({ items: [], nextCursor: null, total: 0 });
    }
    const csv = [
      'id,type,status,fullName,email,createdAt',
      'lead_001,contact,new,"Leïla Bennani",leila@example.ma,2026-05-03T14:32:00Z',
      'lead_002,order,won,"Yassine Kaddouri",y@example.ma,2026-05-02T10:00:00Z',
    ].join('\n');
    return new HttpResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="leads-2026-05-03.csv"',
      },
    });
  }),
];
```

## Action utilisateur

1. Cliquer "Exporter CSV".
2. Attendre la résolution de la requête.

## Assertions

- La requête contient `?format=csv` plus les filtres en cours.
- Le `Content-Type` reçu est `text/csv; charset=utf-8`.
- Le `Content-Disposition` contient `attachment` et un nom de fichier.
- Un `<a>` invisible avec `download` est créé via `URL.createObjectURL(blob)` puis cliqué.
- `URL.revokeObjectURL` est appelé après le clic (cleanup).
- Le bouton "Exporter CSV" passe en état désactivé pendant la requête puis redevient actif.
- Aucune navigation `router.push` n'est faite.

## Edge cases couverts ailleurs

- Liste vide (export quand même valide) → variante du même test.
- Erreur 500 sur export → toast d'erreur (non couvert ici).

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ExportButton } from './ExportButton';

it('télécharge un CSV avec le bon header', async () => {
  const user = userEvent.setup();
  const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
  const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  render(<ExportButton />);
  await user.click(screen.getByRole('button', { name: /exporter csv/i }));
  await vi.waitFor(() => {
    expect(createUrl).toHaveBeenCalled();
    expect(revokeUrl).toHaveBeenCalled();
  });
});
```
