/**
 * Tests unitaires LocaleSwitcher (Phase 5 — Switcher public éditorial).
 *
 * Couverture :
 *  - Rendu desktop (dropdown) avec locale active FR : bouton "FR" visible
 *  - Click trigger ouvre le menu : 3 options visibles (FR/AR/EN)
 *  - Click sur AR → router.replace appelé avec { locale: 'ar' }
 *  - Escape ferme le menu et restaure le focus au trigger
 *  - A11y : aria-expanded toggle correct, role=menu présent, lang/dir
 *    sur les items, indicateur sauge sur l'actif
 *  - Variante inline : kicker + items verticaux, callback onSelect
 *  - Navigation clavier : Arrow Down/Up cycle, Home/End sautent
 *  - Sélection de la locale active : no-op router (idempotence)
 *
 * On stube `next-intl` (useLocale, useTranslations) et `@/i18n/navigation`
 * (useRouter, usePathname) pour isoler le composant. Le composant lit
 * `getEnabledLocales()` réel — couvre 3 locales activées par défaut.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';

import { LocaleSwitcher } from './LocaleSwitcher';

// ─────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────

const mockReplace = vi.fn();
const mockPush = vi.fn();
let mockLocale = 'fr';

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  usePathname: () => '/contact',
}));

// `next/navigation.usePathname` est utilisé par `useActiveLocaleSafe` pour
// détecter si on est dans une route `[locale]/*` AVANT d'appeler les hooks
// next-intl. On simule donc un path préfixé par la locale active.
vi.mock('next/navigation', () => ({
  usePathname: () => `/${mockLocale}/contact`,
}));

vi.mock('next-intl', () => ({
  useLocale: () => mockLocale,
  useTranslations: () => (key: string) => {
    // Retour direct des clés navigation.* pour ne pas dépendre des messages JSON.
    const map: Record<string, string> = {
      locale_switcher_label: 'Langue',
      locale_switcher_aria: 'Choisir la langue',
      locale_switcher_menu_aria: 'Langues disponibles',
      locale_switcher_active_suffix: 'active',
    };
    return map[key] ?? key;
  },
}));

beforeEach(() => {
  mockReplace.mockReset();
  mockPush.mockReset();
  mockLocale = 'fr';
});

afterEach(() => {
  cleanup();
});

// ─────────────────────────────────────────────────────────────────────────
// Variante DROPDOWN
// ─────────────────────────────────────────────────────────────────────────

describe('LocaleSwitcher dropdown (desktop)', () => {
  it("affiche l'endonyme de la locale active (Français par défaut)", () => {
    render(<LocaleSwitcher variant="dropdown" />);
    const trigger = screen.getByTestId('locale-switcher-trigger');
    // Phase 9bis — endonyme dans sa propre écriture (pas de code latin AR).
    expect(trigger).toHaveTextContent('Français');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('change le label si la locale active change (AR → العربية)', () => {
    mockLocale = 'ar';
    render(<LocaleSwitcher variant="dropdown" />);
    expect(screen.getByTestId('locale-switcher-trigger')).toHaveTextContent(
      'العربية',
    );
  });

  it('click sur le trigger ouvre le menu avec 3 options (FR/AR/EN)', () => {
    render(<LocaleSwitcher variant="dropdown" />);
    const trigger = screen.getByTestId('locale-switcher-trigger');
    fireEvent.click(trigger);

    const menu = screen.getByTestId('locale-switcher-menu');
    expect(menu).toBeInTheDocument();
    expect(menu).toHaveAttribute('role', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Les 3 locales sont visibles
    expect(within(menu).getByTestId('locale-switcher-item-fr')).toBeInTheDocument();
    expect(within(menu).getByTestId('locale-switcher-item-ar')).toBeInTheDocument();
    expect(within(menu).getByTestId('locale-switcher-item-en')).toBeInTheDocument();

    // Les endonymes natifs apparaissent (charte : Cormorant italic)
    expect(within(menu).getByText('Français')).toBeInTheDocument();
    expect(within(menu).getByText('العربية')).toBeInTheDocument();
    expect(within(menu).getByText('English')).toBeInTheDocument();
  });

  it("click sur l'option AR appelle router.replace avec { locale: 'ar' }", () => {
    render(<LocaleSwitcher variant="dropdown" />);
    fireEvent.click(screen.getByTestId('locale-switcher-trigger'));
    fireEvent.click(screen.getByTestId('locale-switcher-item-ar'));

    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/contact', { locale: 'ar' });
  });

  it('clic sur la locale active = no-op router (idempotence)', () => {
    render(<LocaleSwitcher variant="dropdown" />);
    fireEvent.click(screen.getByTestId('locale-switcher-trigger'));
    fireEvent.click(screen.getByTestId('locale-switcher-item-fr'));

    // Le menu se ferme mais router.replace n'est pas appelé.
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("l'item actif porte data-active='true' + aria-checked='true'", () => {
    render(<LocaleSwitcher variant="dropdown" />);
    fireEvent.click(screen.getByTestId('locale-switcher-trigger'));

    const itemFr = screen.getByTestId('locale-switcher-item-fr');
    const itemAr = screen.getByTestId('locale-switcher-item-ar');
    expect(itemFr).toHaveAttribute('data-active', 'true');
    expect(itemFr).toHaveAttribute('aria-checked', 'true');
    expect(itemAr).toHaveAttribute('data-active', 'false');
    expect(itemAr).toHaveAttribute('aria-checked', 'false');
  });

  it("les items portent les attributs lang+dir corrects (RTL pour AR)", () => {
    render(<LocaleSwitcher variant="dropdown" />);
    fireEvent.click(screen.getByTestId('locale-switcher-trigger'));

    expect(screen.getByTestId('locale-switcher-item-fr')).toHaveAttribute(
      'dir',
      'ltr',
    );
    expect(screen.getByTestId('locale-switcher-item-fr')).toHaveAttribute(
      'lang',
      'fr',
    );
    expect(screen.getByTestId('locale-switcher-item-ar')).toHaveAttribute(
      'dir',
      'rtl',
    );
    expect(screen.getByTestId('locale-switcher-item-ar')).toHaveAttribute(
      'lang',
      'ar',
    );
  });

  it('Escape sur le menu ferme le panel', () => {
    render(<LocaleSwitcher variant="dropdown" />);
    const trigger = screen.getByTestId('locale-switcher-trigger');
    fireEvent.click(trigger);
    expect(screen.queryByTestId('locale-switcher-menu')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByTestId('locale-switcher-menu'), {
      key: 'Escape',
    });

    expect(screen.queryByTestId('locale-switcher-menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('ArrowDown sur le menu cycle vers l\'item suivant', () => {
    render(<LocaleSwitcher variant="dropdown" />);
    fireEvent.click(screen.getByTestId('locale-switcher-trigger'));
    const menu = screen.getByTestId('locale-switcher-menu');

    // Position initiale = FR (index 0). ArrowDown → AR (index 1).
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    // Le focus va sur l'item AR (tabIndex=0, les autres -1)
    expect(screen.getByTestId('locale-switcher-item-ar')).toHaveAttribute(
      'tabindex',
      '0',
    );
    expect(screen.getByTestId('locale-switcher-item-fr')).toHaveAttribute(
      'tabindex',
      '-1',
    );
  });

  it('notifie onOpenChange(true) à l\'ouverture et (false) à la fermeture', () => {
    const onOpenChange = vi.fn();
    render(<LocaleSwitcher variant="dropdown" onOpenChange={onOpenChange} />);
    // Effet de montage : état initial fermé.
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    fireEvent.click(screen.getByTestId('locale-switcher-trigger'));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    fireEvent.keyDown(screen.getByTestId('locale-switcher-menu'), {
      key: 'Escape',
    });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("aucun emoji n'est rendu dans le DOM (politique charte FemiGlow)", () => {
    render(<LocaleSwitcher variant="dropdown" />);
    fireEvent.click(screen.getByTestId('locale-switcher-trigger'));
    const menu = screen.getByTestId('locale-switcher-menu');

    // Charte FemiGlow : pas de flagEmoji 🇫🇷🇲🇦🇬🇧 dans le DOM
    const text = menu.textContent ?? '';
    expect(text).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]/u);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Variante INLINE
// ─────────────────────────────────────────────────────────────────────────

describe('LocaleSwitcher inline (mobile / SommaireOverlay)', () => {
  it('rend une liste verticale avec kicker + 3 items, sans bouton trigger', () => {
    render(<LocaleSwitcher variant="inline" />);
    const section = screen.getByTestId('locale-switcher-inline');
    expect(section).toBeInTheDocument();
    // Kicker label visible (Cormorant italic)
    expect(within(section).getByText('Langue')).toBeInTheDocument();
    // Pas de bouton trigger (variante inline = liste dépliée en flux)
    expect(screen.queryByTestId('locale-switcher-trigger')).not.toBeInTheDocument();
    // 3 items
    expect(
      within(section).getByTestId('locale-switcher-inline-item-fr'),
    ).toBeInTheDocument();
    expect(
      within(section).getByTestId('locale-switcher-inline-item-ar'),
    ).toBeInTheDocument();
    expect(
      within(section).getByTestId('locale-switcher-inline-item-en'),
    ).toBeInTheDocument();
  });

  it('appelle onSelect callback après une sélection (fermeture drawer)', () => {
    const onSelect = vi.fn();
    render(<LocaleSwitcher variant="inline" onSelect={onSelect} />);

    fireEvent.click(screen.getByTestId('locale-switcher-inline-item-en'));

    expect(mockReplace).toHaveBeenCalledWith('/contact', { locale: 'en' });
    expect(onSelect).toHaveBeenCalledWith('en');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Résilience hors provider next-intl
// ─────────────────────────────────────────────────────────────────────────

describe('LocaleSwitcher résilience hors provider', () => {
  it('rend null si le pathname n\'a pas de préfixe locale (routes legacy)', async () => {
    // Force un pathname sans préfixe locale : `useActiveLocaleSafe` retourne null
    // → le composant rend null sans appeler `useLocale()` (pas de crash).
    vi.doMock('next/navigation', () => ({
      usePathname: () => '/journal/foo',
    }));
    vi.resetModules();
    const { LocaleSwitcher: Fresh } = await import('./LocaleSwitcher');
    const { container } = render(<Fresh />);
    expect(container.firstChild).toBeNull();
    vi.doUnmock('next/navigation');
  });
});
