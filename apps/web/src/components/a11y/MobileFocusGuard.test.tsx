/**
 * Tests `MobileFocusGuard`.
 *
 * Vérifie que :
 *  - À l'ouverture (mount) : la viewport meta est conservée.
 *  - Sur focus d'un <input>/<textarea>/<select> : viewport patchée avec
 *    `maximum-scale=1, user-scalable=no`.
 *  - Sur blur : viewport restaurée à sa valeur initiale.
 *  - Les boutons / checkbox / radio NE déclenchent PAS le lock.
 *  - Au unmount alors qu'un champ est focus : viewport restaurée (cleanup).
 *
 * cf. apps/web/src/components/a11y/MobileFocusGuard.tsx
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent, act } from '@testing-library/react';
import { MobileFocusGuard } from './MobileFocusGuard';

const LOCKED = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
const INITIAL = 'width=device-width, initial-scale=1';

function getViewportContent(): string | null {
  return document
    .querySelector<HTMLMetaElement>('meta[name="viewport"]')
    ?.getAttribute('content') ?? null;
}

function ensureViewport(content: string): void {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

describe('MobileFocusGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ensureViewport(INITIAL);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    // Reset viewport
    const meta = document.querySelector('meta[name="viewport"]');
    meta?.parentElement?.removeChild(meta);
  });

  it('preserves viewport content on mount (no input focused)', () => {
    render(<MobileFocusGuard />);
    expect(getViewportContent()).toBe(INITIAL);
  });

  it('locks viewport on textarea focus', () => {
    render(
      <>
        <MobileFocusGuard />
        <textarea data-testid="ta" />
      </>,
    );
    const ta = document.querySelector<HTMLTextAreaElement>('[data-testid="ta"]')!;
    act(() => { ta.focus(); fireEvent.focusIn(ta); });
    expect(getViewportContent()).toBe(LOCKED);
  });

  it('locks viewport on input[type=text] focus', () => {
    render(
      <>
        <MobileFocusGuard />
        <input type="text" data-testid="in" />
      </>,
    );
    const inp = document.querySelector<HTMLInputElement>('[data-testid="in"]')!;
    act(() => { inp.focus(); fireEvent.focusIn(inp); });
    expect(getViewportContent()).toBe(LOCKED);
  });

  it('locks on select focus', () => {
    render(
      <>
        <MobileFocusGuard />
        <select data-testid="sel"><option>x</option></select>
      </>,
    );
    const sel = document.querySelector<HTMLSelectElement>('[data-testid="sel"]')!;
    act(() => { sel.focus(); fireEvent.focusIn(sel); });
    expect(getViewportContent()).toBe(LOCKED);
  });

  it('does NOT lock on button focus', () => {
    render(
      <>
        <MobileFocusGuard />
        <button data-testid="btn">Send</button>
      </>,
    );
    const btn = document.querySelector<HTMLButtonElement>('[data-testid="btn"]')!;
    act(() => { btn.focus(); fireEvent.focusIn(btn); });
    expect(getViewportContent()).toBe(INITIAL);
  });

  it('does NOT lock on checkbox focus', () => {
    render(
      <>
        <MobileFocusGuard />
        <input type="checkbox" data-testid="cb" />
      </>,
    );
    const cb = document.querySelector<HTMLInputElement>('[data-testid="cb"]')!;
    act(() => { cb.focus(); fireEvent.focusIn(cb); });
    expect(getViewportContent()).toBe(INITIAL);
  });

  it('restores viewport on blur (after debounce)', () => {
    render(
      <>
        <MobileFocusGuard />
        <textarea data-testid="ta" />
      </>,
    );
    const ta = document.querySelector<HTMLTextAreaElement>('[data-testid="ta"]')!;
    act(() => { ta.focus(); fireEvent.focusIn(ta); });
    expect(getViewportContent()).toBe(LOCKED);
    act(() => { ta.blur(); fireEvent.focusOut(ta); });
    // Avant timer : encore lock
    act(() => { vi.advanceTimersByTime(60); });
    expect(getViewportContent()).toBe(INITIAL);
  });

  it('keeps lock if focus jumps between two text inputs', () => {
    render(
      <>
        <MobileFocusGuard />
        <input type="text" data-testid="a" />
        <input type="email" data-testid="b" />
      </>,
    );
    const a = document.querySelector<HTMLInputElement>('[data-testid="a"]')!;
    const b = document.querySelector<HTMLInputElement>('[data-testid="b"]')!;
    act(() => { a.focus(); fireEvent.focusIn(a); });
    expect(getViewportContent()).toBe(LOCKED);
    // jump to b
    act(() => {
      fireEvent.focusOut(a);
      b.focus();
      fireEvent.focusIn(b);
    });
    act(() => { vi.advanceTimersByTime(100); });
    // Toujours lock car b a le focus
    expect(getViewportContent()).toBe(LOCKED);
  });

  it('restores viewport on unmount even if input is focused', () => {
    const { unmount } = render(
      <>
        <MobileFocusGuard />
        <textarea data-testid="ta" />
      </>,
    );
    const ta = document.querySelector<HTMLTextAreaElement>('[data-testid="ta"]')!;
    act(() => { ta.focus(); fireEvent.focusIn(ta); });
    expect(getViewportContent()).toBe(LOCKED);
    unmount();
    expect(getViewportContent()).toBe(INITIAL);
  });

  it('locks on contenteditable focus', () => {
    render(
      <>
        <MobileFocusGuard />
        <div contentEditable data-testid="ce" suppressContentEditableWarning>x</div>
      </>,
    );
    const ce = document.querySelector<HTMLDivElement>('[data-testid="ce"]')!;
    act(() => { ce.focus(); fireEvent.focusIn(ce); });
    expect(getViewportContent()).toBe(LOCKED);
  });
});
