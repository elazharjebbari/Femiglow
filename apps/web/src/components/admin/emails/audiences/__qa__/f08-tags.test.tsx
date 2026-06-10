/**
 * F08 étape 1 — neutralisation des tags, surfaces UI (AUD-01) :
 *  - menu d'ajout grisé (C-026/027) + 13 autres types fonctionnels (C-028) ;
 *  - règle tag LEGACY : bannière role=alert (C-029), blocage étape 2 (C-030),
 *    retrait qui débloque (C-031).
 *
 * Le compilateur (3e surface) est verrouillé par F08-U-001..004 + I-095.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { server, http, HttpResponse } from '@/test/msw/server';
import { AudienceRulesBuilder } from '../AudienceRulesBuilder';
import { AudienceWizard } from '../AudienceWizard';
import { RULE_CATEGORIES } from '../rule-defaults';
import { TAG_RULE_BANNER, TAG_RULE_STEP2_ERROR } from '@/lib/mail/audiences/tags-flag';
import type { Rule, RulesGroup } from '@/lib/mail/audiences/rules-types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Les sous-éditeurs montés par C-028 (produit, template) fetchnt leurs
// autocompletes au montage — réponses vides suffisantes.
beforeEach(() => {
  server.use(
    http.get('/api/admin/catalog/products/autocomplete', () =>
      HttpResponse.json({ products: [] }),
    ),
    http.get('/api/admin/emails/templates/autocomplete', () =>
      HttpResponse.json({ templates: [] }),
    ),
  );
});

/** Routes touchées par l'étape 2 du wizard (preview + autocompletes). */
function mockStep2Routes() {
  server.use(
    http.post('/api/admin/emails/audiences/preview-size', () =>
      HttpResponse.json({ size: 42, durationMs: 10 }),
    ),
    http.post('/api/admin/emails/audiences/preview-breakdown', () =>
      HttpResponse.json({ matched: 50, excluded: 8, deliverable: 42, durationMs: 10 }),
    ),
    http.get('/api/admin/leads/tags/autocomplete', () => HttpResponse.json({ tags: [] })),
  );
}

function Controlled({
  initial,
  spy,
}: {
  initial: RulesGroup;
  spy?: (v: RulesGroup) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <AudienceRulesBuilder
      value={value}
      onChange={(v) => {
        setValue(v);
        spy?.(v);
      }}
    />
  );
}

const LEGACY_TAG_INITIAL = {
  slug: 'vip-legacy',
  name: 'VIP legacy',
  rules: {
    kind: 'all',
    conditions: [
      { kind: 'has_tag', tag: 'vip' },
      { kind: 'consent_marketing', value: true },
    ] as Array<Rule>,
  } as RulesGroup,
};

async function gotoStep2() {
  await act(async () => {
    fireEvent.click(screen.getByTestId('next-btn'));
  });
  await waitFor(() =>
    expect(screen.getByTestId('exclusion-flags-fieldset')).toBeInTheDocument(),
  );
}

describe('F08 — menu tags grisé (AUD-01)', () => {
  it("F08-C-026 — les items tag sont aria-disabled et suffixés '(bientôt — M5.5)'", () => {
    render(<Controlled initial={{ kind: 'all', conditions: [] }} />);
    fireEvent.click(screen.getByTestId('add-rule-btn'));
    for (const kind of ['has_tag', 'not_has_tag'] as const) {
      const item = screen.getByTestId(`add-rule-${kind}`);
      expect(item).toBeDisabled();
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item.textContent).toContain('(bientôt — M5.5)');
    }
  });

  it("F08-C-027 — cliquer 'A le tag X' n'ajoute aucune règle au groupe", () => {
    const spy = vi.fn();
    render(<Controlled initial={{ kind: 'all', conditions: [] }} spy={spy} />);
    fireEvent.click(screen.getByTestId('add-rule-btn'));
    fireEvent.click(screen.getByTestId('add-rule-has_tag'));
    fireEvent.click(screen.getByTestId('add-rule-not_has_tag'));
    expect(spy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('rule-editor-has_tag')).not.toBeInTheDocument();
  });

  it('F08-C-028 — chaque type non-tag du menu ajoute bien une règle (13 types)', () => {
    const enabledKinds = RULE_CATEGORIES.flatMap((c) => c.items)
      .filter((i) => !i.disabled)
      .map((i) => i.kind);
    expect(enabledKinds).toHaveLength(13);
    for (const kind of enabledKinds) {
      const spy = vi.fn();
      const { unmount } = render(
        <Controlled initial={{ kind: 'all', conditions: [] }} spy={spy} />,
      );
      fireEvent.click(screen.getByTestId('add-rule-btn'));
      fireEvent.click(screen.getByTestId(`add-rule-${kind}`));
      expect(spy, `le type ${kind} doit s'ajouter`).toHaveBeenCalledTimes(1);
      const next = spy.mock.calls[0]![0] as RulesGroup;
      expect((next.conditions[0] as Rule).kind).toBe(kind);
      unmount();
    }
  });
});

describe('F08 — règle tag legacy dans le wizard (AUD-01)', () => {
  it('F08-C-029 — une audience legacy avec has_tag affiche la bannière rouge role=alert', async () => {
    mockStep2Routes();
    render(<AudienceWizard mode="edit" audienceId="a1" initial={LEGACY_TAG_INITIAL} />);
    await gotoStep2();
    const banner = screen.getByTestId('tag-rule-banner');
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner.textContent).toBe(TAG_RULE_BANNER);
  });

  it("F08-C-030 — Continuer affiche l'erreur « règle tag inactive » et reste à l'étape 2", async () => {
    mockStep2Routes();
    render(<AudienceWizard mode="edit" audienceId="a1" initial={LEGACY_TAG_INITIAL} />);
    await gotoStep2();
    await act(async () => {
      fireEvent.click(screen.getByTestId('next-btn'));
    });
    const err = screen.getByTestId('rules-error');
    expect(err).toHaveAttribute('role', 'alert');
    expect(err.textContent).toContain(TAG_RULE_STEP2_ERROR);
    // Toujours à l'étape 2 : le builder est encore là, pas de Récapitulatif.
    expect(screen.getByTestId('exclusion-flags-fieldset')).toBeInTheDocument();
    expect(screen.queryByText('Récapitulatif')).not.toBeInTheDocument();
  });

  it('F08-C-031 — ✕ sur la règle tag retire la bannière et autorise Continuer', async () => {
    mockStep2Routes();
    render(<AudienceWizard mode="edit" audienceId="a1" initial={LEGACY_TAG_INITIAL} />);
    await gotoStep2();
    // Retire le critère tag (✕ de SON éditeur).
    const tagEditor = screen.getByTestId('rule-editor-has_tag');
    await act(async () => {
      fireEvent.click(within(tagEditor).getByTestId('remove-rule'));
    });
    expect(screen.queryByTestId('tag-rule-banner')).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId('next-btn'));
    });
    // Étape 3 atteinte (la règle consent_marketing restante est valide).
    expect(screen.getByText('Récapitulatif')).toBeInTheDocument();
  });
});
