/**
 * AUD-BLD-002/007 (volet country, R-011 côté UI) — le builder sait ajouter et
 * éditer une règle `country`, et propage un code de pays exploitable par le
 * compilateur corrigé.
 *
 * Complément au test builder existant (AudienceRulesBuilder.test.tsx) : on cible
 * spécifiquement la règle `country`, dont le compilateur a été corrigé (R-011 :
 * dérivation par préfixe E.164). On prouve que la chaîne UI → onChange produit
 * bien un `{ kind:'country', operator:'eq', value:'<ISO>' }` propre.
 *
 * CountryAutocomplete est statique (datalist HTML5, zéro fetch) → aucune MSW.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AudienceRulesBuilder } from './AudienceRulesBuilder';
import type { Rule, RulesGroup } from '@/lib/mail/audiences/rules-types';

const emptyGroup = (): RulesGroup => ({ kind: 'all', conditions: [] });

describe('<AudienceRulesBuilder /> — règle country (R-011)', () => {
  it('ajoute une règle country avec le default MA depuis le menu', async () => {
    const onChange = vi.fn();
    render(<AudienceRulesBuilder value={emptyGroup()} onChange={onChange} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-rule-btn'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-rule-country'));
    });

    const next = onChange.mock.calls.at(-1)![0] as RulesGroup;
    expect(next.conditions).toHaveLength(1);
    const rule = next.conditions[0] as Extract<Rule, { kind: 'country' }>;
    expect(rule.kind).toBe('country');
    expect(rule.operator).toBe('eq');
    expect(rule.value).toBe('MA'); // default sensé (cf. rule-defaults)
  });

  it('édite le code pays (MA → FR) et propage la valeur en majuscules', async () => {
    const onChange = vi.fn();
    const value: RulesGroup = {
      kind: 'all',
      conditions: [{ kind: 'country', operator: 'eq', value: 'MA' }],
    };
    render(<AudienceRulesBuilder value={value} onChange={onChange} />);

    // L'éditeur country (operator=eq) rend un CountryAutocomplete dont l'input
    // porte la value 'MA'.
    const input = screen.getByDisplayValue('MA') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'fr' } });
    });

    const next = onChange.mock.calls.at(-1)![0] as RulesGroup;
    const rule = next.conditions[0] as Extract<Rule, { kind: 'country' }>;
    // L'autocomplete uppercase la saisie → 'FR' (code ISO exploitable par le compiler).
    expect(rule.value).toBe('FR');
  });

  it('bascule operator eq → in et accepte une liste de pays (chips, UX-AUD-009)', async () => {
    // ADAPTÉ vague 4 : le mode `in` ne propose PLUS un input CSV texte-libre
    // ("MA, FR") — remplacé par un multi-select de chips (CountryMultiSelect)
    // alimenté par la liste fermée COUNTRIES. On valide que la chaîne
    // select operator → ajout de chips produit toujours value=['MA','FR'].
    const onChange = vi.fn();
    const value: RulesGroup = {
      kind: 'all',
      conditions: [{ kind: 'country', operator: 'eq', value: 'MA' }],
    };
    const { rerender } = render(<AudienceRulesBuilder value={value} onChange={onChange} />);

    // Le select operator du CountryEditor : eq → in. La bascule convertit aussi
    // la value scalaire 'MA' en tableau ['MA'] (Zod CountryRule string[]).
    const select = screen.getByDisplayValue('égal') as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(select, { target: { value: 'in' } });
    });
    let current = onChange.mock.calls.at(-1)![0] as RulesGroup;
    expect((current.conditions[0] as { operator: string }).operator).toBe('in');
    expect((current.conditions[0] as { value: string[] }).value).toEqual(['MA']);

    // En mode 'in' : un select fermé « + Ajouter un pays… » ; on ajoute FR.
    rerender(<AudienceRulesBuilder value={current} onChange={onChange} />);
    const addSelect = screen.getByTestId('country-add-select') as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(addSelect, { target: { value: 'FR' } });
    });
    current = onChange.mock.calls.at(-1)![0] as RulesGroup;
    expect((current.conditions[0] as { value: string[] }).value).toEqual(['MA', 'FR']);

    // La chip MA est retirable → ne reste que FR.
    rerender(<AudienceRulesBuilder value={current} onChange={onChange} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('country-remove-MA'));
    });
    current = onChange.mock.calls.at(-1)![0] as RulesGroup;
    expect((current.conditions[0] as { value: string[] }).value).toEqual(['FR']);
  });
});
