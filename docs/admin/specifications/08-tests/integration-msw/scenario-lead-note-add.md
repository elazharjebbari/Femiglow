# scenario-lead-note-add

| Aspect | Valeur |
|---|---|
| Domaine | leads-detail |
| Composant | `NoteForm` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/NoteForm.integration.test.tsx` |
| Référence | F-LEADS-10 |

## Préconditions
- Lead `lead_001` chargé, panneau "Notes" ouvert.
- Le formulaire de note est rendu.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('*/api/admin/leads/lead_001/notes', async ({ request }) => {
    const body = (await request.json()) as { body: string };
    if (!body.body || body.body.length > 2000) {
      return HttpResponse.json(
        {
          error: 'validation_failed',
          issues: [{ path: ['body'], message: 'invalid_length' }],
        },
        { status: 400 },
      );
    }
    return HttpResponse.json(
      {
        id: 'evt_new_note',
        leadId: 'lead_001',
        type: 'note_added',
        actor: 'usr_admin',
        meta: {},
        body: body.body,
        createdAt: '2026-05-03T16:00:00Z',
      },
      { status: 201 },
    );
  }),
];
```

## Action utilisateur

1. Cliquer dans le champ "Ajouter une note".
2. Saisir « Relancée par e-mail, attente de retour. »
3. Cliquer "Ajouter" (ou `Cmd+Entrée`).

## Assertions

- Pendant la requête, le bouton "Ajouter" est désactivé + spinner visible.
- Après `201`, la timeline reçoit la nouvelle note en tête.
- Le champ est vidé.
- Un toast affiche « Note ajoutée ».
- Le focus retourne sur le champ pour permettre une nouvelle note.
- Soumettre vide affiche « La note ne peut pas être vide » (validation client).
- Soumettre > 2000 caractères affiche le compteur en rouge.

## Edge cases couverts ailleurs

- Lead 404 → `e2e/lead-detail-404.spec.ts`
- Détail complet → `scenario-lead-detail-load.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoteForm } from './NoteForm';

it('ajoute une note et vide le champ', async () => {
  const user = userEvent.setup();
  render(<NoteForm leadId="lead_001" />);
  const textarea = screen.getByLabelText(/ajouter une note/i);
  await user.type(textarea, 'Relancée par e-mail.');
  await user.click(screen.getByRole('button', { name: /ajouter/i }));
  expect(await screen.findByText(/note ajoutée/i)).toBeInTheDocument();
  expect(textarea).toHaveValue('');
});
```
