/**
 * F08 — builder récursif (AUD-F03 / AUD-08) :
 *  - les 15 kinds rendent leur sous-éditeur (C-032) ;
 *  - groupes : ajout niveau 1, imbrication 3 niveaux, suppression (C-033/034/035) ;
 *  - pédagogie combinateur : mention dès 1 règle, toggle à 2 (C-036/037) ;
 *  - a11y : fieldset/legend par groupe + axe (C-055/056).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { server, http, HttpResponse } from '@/test/msw/server';
import { expectNoAxeViolations } from '@/test/axe';
import { AudienceRulesBuilder } from '../AudienceRulesBuilder';
import { RuleEditor } from '../RuleEditor';
import { RULE_CATEGORIES, defaultRule } from '../rule-defaults';
import type { Rule, RuleKind, RulesGroup } from '@/lib/mail/audiences/rules-types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Les éditeurs montés (produit/template/tag) fetchnt leurs autocompletes.
beforeEach(() => {
  server.use(
    http.get('/api/admin/catalog/products/autocomplete', () =>
      HttpResponse.json({ products: [] }),
    ),
    http.get('/api/admin/emails/templates/autocomplete', () =>
      HttpResponse.json({ templates: [] }),
    ),
    http.get('/api/admin/leads/tags/autocomplete', () => HttpResponse.json({ tags: [] })),
  );
});

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

const RULE: Rule = { kind: 'consent_marketing', value: true };

describe('F08 — RuleEditor factory (AUD-F03)', () => {
  it('F08-C-032 — chaque kind rendu via RuleEditor affiche son sous-éditeur sans crash', () => {
    const kinds = RULE_CATEGORIES.flatMap((c) => c.items.map((i) => i.kind));
    expect(kinds).toHaveLength(15);
    for (const kind of kinds) {
      const { unmount } = render(
        <RuleEditor rule={defaultRule(kind as RuleKind)} onChange={() => {}} />,
      );
      expect(
        screen.getByTestId(`rule-editor-${kind}`),
        `éditeur ${kind} doit se rendre`,
      ).toBeInTheDocument();
      unmount();
    }
  });
});

describe('F08 — groupes imbriqués (AUD-08)', () => {
  it("F08-C-033 — '+ Ajouter un groupe OU' crée un rules-group-1 de combinateur inverse", () => {
    const spy = vi.fn();
    render(<Controlled initial={{ kind: 'all', conditions: [] }} spy={spy} />);
    fireEvent.click(screen.getByTestId('add-group-btn'));
    const group1 = screen.getByTestId('rules-group-1');
    expect(group1).toBeInTheDocument();
    const next = spy.mock.calls[0]![0] as RulesGroup;
    expect((next.conditions[0] as RulesGroup).kind).toBe('any'); // inverse de all
  });

  it('F08-C-034 — imbrication 0>1>2>3 ; le bouton groupe disparaît au niveau max', () => {
    const nested: RulesGroup = {
      kind: 'all',
      conditions: [
        {
          kind: 'any',
          conditions: [
            { kind: 'all', conditions: [{ kind: 'any', conditions: [RULE] }] },
          ],
        },
      ],
    };
    render(<Controlled initial={nested} />);
    for (const d of [0, 1, 2, 3]) {
      expect(screen.getByTestId(`rules-group-${d}`)).toBeInTheDocument();
    }
    // maxDepth=3 : le groupe de niveau 3 ne propose plus d'imbrication.
    const deepest = screen.getByTestId('rules-group-3');
    expect(within(deepest).queryByTestId('add-group-btn')).not.toBeInTheDocument();
    // …mais les niveaux au-dessus, si.
    expect(screen.getAllByTestId('add-group-btn').length).toBeGreaterThan(0);
  });

  it("F08-C-035 — ✕ 'Supprimer ce sous-groupe' retire le groupe et ses règles", () => {
    const nested: RulesGroup = {
      kind: 'all',
      conditions: [RULE, { kind: 'any', conditions: [{ kind: 'inactive_since', days: 30 }] }],
    };
    render(<Controlled initial={nested} />);
    expect(screen.getByTestId('rules-group-1')).toBeInTheDocument();
    expect(screen.getByTestId('rule-editor-inactive_since')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Supprimer ce sous-groupe'));
    expect(screen.queryByTestId('rules-group-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rule-editor-inactive_since')).not.toBeInTheDocument();
    expect(screen.getByTestId('rule-editor-consent_marketing')).toBeInTheDocument();
  });
});

describe('F08 — pédagogie combinateur (AUD-08)', () => {
  it('F08-C-036 — avec 1 règle, la mention combinateur pédagogique est visible', () => {
    render(<Controlled initial={{ kind: 'all', conditions: [RULE] }} />);
    const hint = screen.getByTestId('combinator-hint');
    expect(hint.textContent).toContain(
      "Une seule condition pour l'instant — ajoutez-en d'autres pour les combiner (ET/OU).",
    );
    // Pas encore de toggle (il apparaît à 2 règles).
    expect(screen.queryByTestId('toggle-combinator')).not.toBeInTheDocument();
  });

  it('F08-C-037 — le toggle ET/OU apparaît à 2 règles et bascule all↔any', () => {
    const spy = vi.fn();
    render(
      <Controlled
        initial={{ kind: 'all', conditions: [RULE, { kind: 'inactive_since', days: 30 }] }}
        spy={spy}
      />,
    );
    expect(screen.queryByTestId('combinator-hint')).not.toBeInTheDocument();
    const toggle = screen.getByTestId('toggle-combinator');
    expect(toggle.textContent).toBe('ET (toutes)');
    fireEvent.click(toggle);
    expect(screen.getByTestId('toggle-combinator').textContent).toBe('OU (au moins une)');
    expect((spy.mock.calls[0]![0] as RulesGroup).kind).toBe('any');
    fireEvent.click(screen.getByTestId('toggle-combinator'));
    expect(screen.getByTestId('toggle-combinator').textContent).toBe('ET (toutes)');
  });
});

describe('F08 — a11y builder (AUD-F03)', () => {
  const THREE_LEVELS: RulesGroup = {
    kind: 'all',
    conditions: [
      RULE,
      {
        kind: 'any',
        conditions: [
          { kind: 'inactive_since', days: 30 },
          { kind: 'all', conditions: [{ kind: 'order_count', operator: 'gte', value: 1 }] },
        ],
      },
    ],
  };

  it('F08-C-055 — chaque groupe est un fieldset avec legend annonçant le combinateur', () => {
    render(<Controlled initial={THREE_LEVELS} />);
    const g0 = screen.getByTestId('rules-group-0');
    const g1 = screen.getByTestId('rules-group-1');
    const g2 = screen.getByTestId('rules-group-2');
    expect(g0.tagName).toBe('FIELDSET');
    expect(g1.tagName).toBe('FIELDSET');
    expect(g2.tagName).toBe('FIELDSET');
    expect(g0.querySelector('legend')?.textContent).toContain('ET (toutes les conditions)');
    expect(g1.querySelector('legend')?.textContent).toContain('OU (au moins une condition)');
    expect(g2.querySelector('legend')?.textContent).toContain('ET (toutes les conditions)');
  });

  it('F08-C-056 — axe sur le builder à 3 niveaux : 0 violation', async () => {
    const { container } = render(<Controlled initial={THREE_LEVELS} />);
    await expectNoAxeViolations(container);
  });
});
