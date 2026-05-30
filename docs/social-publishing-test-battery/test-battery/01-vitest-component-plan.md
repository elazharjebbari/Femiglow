# Vitest Component plan

## Composants × tests estimés

| Composant | Tests | Fichier |
|-----------|-------|---------|
| PublishActionGroup | 18 | `create/PublishActionGroup.test.tsx` |
| JobQueue | 16 | `plan/JobQueue.test.tsx` (NEW) |
| QuickEditDrawer | 12 | `plan/QuickEditDrawer.test.tsx` (NEW) |
| Calendar | 14 | `plan/Calendar.test.tsx` (NEW) |
| CalendarCard | 10 | `plan/CalendarCard.test.tsx` (NEW) |
| AccountHealthCard | 8 | `home/AccountHealthCard.test.tsx` (NEW) |
| LibraryClient | 12 | `library/LibraryClient.test.tsx` (extend) |
| MockModeBadge | 4 | existant |
| ConfirmPreview (intégré dans PublishActionGroup) | 4 | inclus dans PAG.test |
| **Total** | **98 tests** | |

## Conventions

```ts
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('JobQueue', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async (url) => {
      // mock per route
    }) as unknown as typeof fetch;
  });

  it('renders 5 jobs from fixture', () => { ... });
});
```

## A11y intégré
Chaque test composant inclut au minimum un assert sur :
- aria-label
- role
- focus visible
- keyboard navigation (Tab/Esc)

## Coverage minimum
Voir `09-coverage-targets.md` (référencé).

## Commande
```bash
pnpm vitest run src/components/admin/content-studio-v2 --reporter=verbose
```
