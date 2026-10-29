/**
 * wizard-arrival — centrage du step actif dans la bande visible et accueil
 * très doux (une passe, jamais sous reduced-motion, pas de clavier en tactile).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { arriveAtCommander, centeredScrollTop } from './wizard-arrival';

describe('centeredScrollTop', () => {
  // Mobile 812 px : header 56 px, sticky + flag 101 px → bande 812-56-101-24 = 631 px.
  const base = { viewportHeight: 812, topInset: 56, bottomInset: 101 };

  it('centre la zone quand elle tient dans la bande', () => {
    // bandTop = 68 ; marge = (631 - 431) / 2 = 100 → 2000 - 68 - 100.
    expect(centeredScrollTop({ ...base, zoneTop: 2000, zoneHeight: 431 })).toBe(1832);
  });

  it('zone trop haute : centre le formulaire de repli', () => {
    expect(
      centeredScrollTop({ ...base, zoneTop: 2000, zoneHeight: 900, fallbackTop: 2150, fallbackHeight: 431 }),
    ).toBe(1982);
  });

  it('repli trop haut lui aussi : aligne son haut sur le haut de la bande', () => {
    expect(
      centeredScrollTop({ ...base, zoneTop: 2000, zoneHeight: 900, fallbackTop: 2150, fallbackHeight: 800 }),
    ).toBe(2150 - 68);
  });

  it('sans repli : aligne la zone en haut de la bande', () => {
    expect(centeredScrollTop({ ...base, zoneTop: 2000, zoneHeight: 900 })).toBe(1932);
  });

  it('jamais négatif', () => {
    expect(centeredScrollTop({ ...base, zoneTop: 10, zoneHeight: 100 })).toBe(0);
  });
});

describe('arriveAtCommander', () => {
  let matches: Record<string, boolean>;

  beforeEach(() => {
    // rAF + performance.now pilotés par l'horloge simulée (attente de fin de scroll).
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
    });
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
    matches = { '(prefers-reduced-motion: reduce)': false, '(pointer: fine)': false };
    window.matchMedia = vi.fn((q: string) => ({ matches: matches[q] ?? false })) as never;
    window.scrollTo = vi.fn() as never;
    document.body.innerHTML = `
      <section id="commander-femiglow">
        <div id="card">
          <div data-testid="wizard-shell">
            <section data-testid="wizard-step-lead">
              <form>
                <input name="website" tabindex="-1" />
                <input name="firstName" value="Sara" />
                <input name="phone" />
              </form>
            </section>
          </div>
        </div>
      </section>`;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  const card = () => document.getElementById('card')!;
  const phone = () => document.querySelector<HTMLInputElement>('input[name="phone"]')!;

  it('défile (smooth) puis, une fois arrivé, halo sur la carte et teinte du 1er champ vide', () => {
    // jsdom : rects à 0 → cible 0 = déjà en place, l'accueil part tout de suite.
    arriveAtCommander();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    expect(card().getAttribute('data-fg-arrival')).toBe('card');
    // Le prénom est rempli : c'est le téléphone qui est invité, pas le honeypot.
    expect(phone().getAttribute('data-fg-arrival')).toBe('field');
    vi.advanceTimersByTime(2100);
    expect(card().hasAttribute('data-fg-arrival')).toBe(false);
    expect(phone().hasAttribute('data-fg-arrival')).toBe(false);
  });

  it('attend que le défilement soit fini avant l’accueil (jamais en plein trajet)', () => {
    let y = 900;
    Object.defineProperty(window, 'scrollY', { get: () => y, configurable: true });
    arriveAtCommander();
    const { top } = vi.mocked(window.scrollTo).mock.calls[0]![0] as ScrollToOptions;
    // Le défilement progresse : pas d'accueil tant que la cible n'est pas atteinte.
    for (const step of [800, 700, 600]) {
      y = step;
      vi.advanceTimersByTime(100);
      expect(card().hasAttribute('data-fg-arrival')).toBe(false);
    }
    y = top!;
    vi.advanceTimersByTime(50);
    expect(card().getAttribute('data-fg-arrival')).toBe('card');
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
  });

  it('défilement bloqué (bas de page) : accueil quand la position est stable', () => {
    Object.defineProperty(window, 'scrollY', { value: 500, configurable: true, writable: true });
    arriveAtCommander();
    vi.advanceTimersByTime(300);
    expect(card().hasAttribute('data-fg-arrival')).toBe(false);
    vi.advanceTimersByTime(300);
    expect(card().getAttribute('data-fg-arrival')).toBe('card');
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
  });

  it('double clic : une seule animation en cours, relancée proprement', () => {
    arriveAtCommander();
    vi.advanceTimersByTime(1500);
    arriveAtCommander();
    // L'ancien minuteur (2 s) ne doit pas couper la nouvelle passe.
    vi.advanceTimersByTime(700);
    expect(card().getAttribute('data-fg-arrival')).toBe('card');
    vi.advanceTimersByTime(1400);
    expect(card().hasAttribute('data-fg-arrival')).toBe(false);
  });

  it('tactile : le clavier ne s’ouvre pas (focus du shell, pas du champ)', () => {
    arriveAtCommander();
    expect(document.activeElement).toBe(document.querySelector('[data-testid="wizard-shell"]'));
  });

  it('souris : curseur placé dans le premier champ vide', () => {
    matches['(pointer: fine)'] = true;
    arriveAtCommander();
    expect(document.activeElement).toBe(phone());
  });

  it('reduced-motion : défilement instantané, aucune animation', () => {
    matches['(prefers-reduced-motion: reduce)'] = true;
    arriveAtCommander();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
    expect(card().hasAttribute('data-fg-arrival')).toBe(false);
  });

  it('ancre absente : ne fait rien', () => {
    document.body.innerHTML = '';
    expect(() => arriveAtCommander()).not.toThrow();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
