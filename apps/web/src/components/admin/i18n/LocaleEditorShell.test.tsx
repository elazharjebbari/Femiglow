/**
 * RTL — LocaleEditorShell (T3.8).
 *
 * Stratégie : on stub EditorWithPreview pour isoler la logique de switch
 * de locale. L'objectif n'est PAS de re-tester le formulaire (déjà couvert
 * par FieldsPanel.test) mais :
 *
 *  - le shell rend bien les onglets + l'éditeur pour la locale FR au boot,
 *  - le switch vers AR met `dir="rtl"` sur le tabpanel + propage `locale="ar"`,
 *  - le badge "traduit" reflète l'état initialFieldsByLocale,
 *  - le `key={activeLocale}` force bien un remount (cf. data-mount-count).
 *
 * Cf. docs/i18n-strategy-2026-05/PHASE-3-PROGRESS.md (T3.8)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleEditorShell } from './LocaleEditorShell';
import type { ComponentFieldDefinition } from '@/lib/db/types';
import type { FieldDirtyState } from '@/components/admin/components/fields/types';

// Stub EditorWithPreview : on capture les props pour vérifier que la locale
// est bien propagée, sans dépendre de la stack form-engine + preview iframe.
let renderCount = 0;
vi.mock('@/components/admin/components/EditorWithPreview', () => ({
  EditorWithPreview: (props: {
    componentKey: string;
    locale?: string;
    initialFields: Record<string, FieldDirtyState>;
  }) => {
    renderCount++;
    return (
      <div
        data-testid="editor-stub"
        data-locale={props.locale ?? 'fr'}
        data-component-key={props.componentKey}
        data-field-keys={Object.keys(props.initialFields).join(',')}
        data-mount-count={renderCount}
      >
        editor-stub
      </div>
    );
  },
}));

const TITLE: ComponentFieldDefinition = {
  key: 'title',
  label: 'Titre',
  type: 'text',
  required: false,
};

function fld(value: unknown): FieldDirtyState {
  return {
    initial: value,
    current: value,
    error: null,
    saving: false,
    lastSavedAt: null,
    ifMatch: null,
  };
}

describe('LocaleEditorShell', () => {
  beforeEach(() => {
    renderCount = 0;
  });

  it("rend le tabpanel avec dir='ltr' et locale='fr' par défaut", () => {
    render(
      <LocaleEditorShell
        componentKey="home-hero"
        fieldDefs={[TITLE]}
        initialFieldsByLocale={{
          fr: { title: fld('Bonjour') },
          ar: {},
          en: {},
        }}
      />,
    );
    const editor = screen.getByTestId('editor-stub');
    expect(editor).toHaveAttribute('data-locale', 'fr');
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('dir', 'ltr');
    expect(panel).toHaveAttribute('data-active-locale', 'fr');
  });

  it("bascule sur AR au clic → dir='rtl', locale='ar' et remount de l'éditeur", () => {
    render(
      <LocaleEditorShell
        componentKey="home-hero"
        fieldDefs={[TITLE]}
        initialFieldsByLocale={{
          fr: { title: fld('Bonjour') },
          ar: { title: fld('مرحبا') },
          en: {},
        }}
      />,
    );

    const initialMountCount = renderCount;
    fireEvent.click(screen.getByRole('tab', { name: /AR/ }));

    const editor = screen.getByTestId('editor-stub');
    expect(editor).toHaveAttribute('data-locale', 'ar');
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('dir', 'rtl');
    expect(panel).toHaveAttribute('data-active-locale', 'ar');
    // remount → mount count > initial (key={activeLocale} a changé).
    expect(renderCount).toBeGreaterThan(initialMountCount);
  });

  it("calcule la complétion : 'traduit' pour FR uniquement si AR/EN vides", () => {
    render(
      <LocaleEditorShell
        componentKey="home-hero"
        fieldDefs={[TITLE]}
        initialFieldsByLocale={{
          fr: { title: fld('Bonjour') },
          ar: { title: fld(null) },
          en: { title: fld('') },
        }}
      />,
    );
    // FR : présente
    expect(
      screen.getByText(/Français.*au moins un champ traduit/i),
    ).toBeInTheDocument();
    // AR et EN : vides (null / empty string)
    expect(screen.getByText(/Arabe.*rien de traduit/i)).toBeInTheDocument();
    expect(screen.getByText(/Anglais.*rien de traduit/i)).toBeInTheDocument();
  });

  it("propage 'initialFields' de la locale active à l'éditeur stub", () => {
    render(
      <LocaleEditorShell
        componentKey="home-hero"
        fieldDefs={[TITLE]}
        initialFieldsByLocale={{
          fr: { title: fld('FR-value') },
          ar: { title: fld('AR-value'), subtitle: fld('AR-sub') },
          en: {},
        }}
      />,
    );
    // FR par défaut : un seul field "title"
    expect(screen.getByTestId('editor-stub')).toHaveAttribute(
      'data-field-keys',
      'title',
    );
    fireEvent.click(screen.getByRole('tab', { name: /AR/ }));
    // AR : 2 fields
    expect(screen.getByTestId('editor-stub')).toHaveAttribute(
      'data-field-keys',
      'title,subtitle',
    );
  });

  it("ne crash pas si initialFieldsByLocale[activeLocale] est manquant (fallback {})", () => {
    render(
      <LocaleEditorShell
        componentKey="home-hero"
        fieldDefs={[TITLE]}
        initialFieldsByLocale={{ fr: { title: fld('Bonjour') } }}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: /EN/ }));
    const editor = screen.getByTestId('editor-stub');
    expect(editor).toHaveAttribute('data-locale', 'en');
    expect(editor).toHaveAttribute('data-field-keys', '');
  });
});
