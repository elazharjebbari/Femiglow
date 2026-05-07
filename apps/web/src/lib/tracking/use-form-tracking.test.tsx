/**
 * Tests useFormTracking — instrumentation form_start/focus/blur/abandon.
 * cf. docs/analytics/06-tests-strategy.md §3.4
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TrackingContextValue } from './provider';
import { TrackingContext } from './provider';
import { useFormTracking } from './use-form-tracking';

interface CapturedEvent {
  name: string;
  params: Record<string, unknown>;
}

function makeProviderValue(events: CapturedEvent[]): TrackingContextValue {
  return {
    client: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      emit: (name: string, params: Record<string, unknown>) => {
        events.push({ name, params });
      },
      flushSync: () => {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    consent: {
      ad_storage: 'denied',
      analytics_storage: 'granted',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functional_storage: 'granted',
    },
    isReady: true,
    bannerEnabled: false,
  };
}

function FormBody({ trackAbandon = true }: { trackAbandon?: boolean }) {
  const { handleFieldFocus, handleFieldBlur, markSubmitted, reportError } =
    useFormTracking({ formId: 'contact-form', trackAbandon });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        markSubmitted();
      }}
    >
      <input
        name="email"
        aria-label="Email"
        onFocus={handleFieldFocus('email')}
        onBlur={handleFieldBlur('email', false)}
      />
      <input
        name="name"
        aria-label="Nom"
        onFocus={handleFieldFocus('name')}
        onBlur={handleFieldBlur('name', true)}
      />
      <button type="button" onClick={() => reportError('email', 'invalid_format')}>
        Trigger error
      </button>
      <button type="submit">Envoyer</button>
    </form>
  );
}

function renderForm(events: CapturedEvent[], trackAbandon = true) {
  return render(
    <TrackingContext.Provider value={makeProviderValue(events)}>
      <FormBody trackAbandon={trackAbandon} />
    </TrackingContext.Provider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useFormTracking', () => {
  it('emits form_start exactly once on first focus', () => {
    const events: CapturedEvent[] = [];
    renderForm(events);

    fireEvent.focus(screen.getByLabelText('Email'));
    fireEvent.focus(screen.getByLabelText('Nom'));

    const startEvents = events.filter((e) => e.name === 'form_start');
    expect(startEvents).toHaveLength(1);
    expect(startEvents[0]?.params).toEqual({ form_id: 'contact-form' });
  });

  it('emits form_field_focus once per field (idempotent)', () => {
    const events: CapturedEvent[] = [];
    renderForm(events);

    const email = screen.getByLabelText('Email');
    fireEvent.focus(email);
    fireEvent.blur(email);
    fireEvent.focus(email); // second focus, must NOT re-emit
    fireEvent.focus(screen.getByLabelText('Nom'));

    const focuses = events.filter((e) => e.name === 'form_field_focus');
    expect(focuses).toHaveLength(2);
    expect(focuses.map((e) => e.params.field_name)).toEqual(['email', 'name']);
  });

  it('emits form_field_blur each time, with has_value flag', () => {
    const events: CapturedEvent[] = [];
    renderForm(events);

    const email = screen.getByLabelText('Email');
    fireEvent.focus(email);
    fireEvent.blur(email);
    fireEvent.focus(email);
    fireEvent.blur(email);

    const blurs = events.filter((e) => e.name === 'form_field_blur');
    expect(blurs).toHaveLength(2);
    expect(blurs[0]?.params).toMatchObject({
      form_id: 'contact-form',
      field_name: 'email',
      has_value: false,
    });
  });

  it('emits form_validation_error via reportError', () => {
    const events: CapturedEvent[] = [];
    renderForm(events);

    fireEvent.focus(screen.getByLabelText('Email'));
    fireEvent.click(screen.getByText('Trigger error'));

    const errors = events.filter((e) => e.name === 'form_validation_error');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.params).toEqual({
      form_id: 'contact-form',
      field_name: 'email',
      error_code: 'invalid_format',
    });
  });

  it('emits form_abandon on pagehide if not submitted', () => {
    const events: CapturedEvent[] = [];
    renderForm(events);

    fireEvent.focus(screen.getByLabelText('Email'));

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    const abandons = events.filter((e) => e.name === 'form_abandon');
    expect(abandons).toHaveLength(1);
    expect(abandons[0]?.params).toMatchObject({
      form_id: 'contact-form',
      last_field: 'email',
    });
  });

  it('does NOT emit form_abandon if markSubmitted was called', () => {
    const events: CapturedEvent[] = [];
    renderForm(events);

    fireEvent.focus(screen.getByLabelText('Email'));
    fireEvent.submit(screen.getByText('Envoyer').closest('form')!);

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(events.filter((e) => e.name === 'form_abandon')).toHaveLength(0);
  });

  it('does NOT emit form_abandon if no field was ever focused', () => {
    const events: CapturedEvent[] = [];
    const { unmount } = renderForm(events);
    unmount();
    expect(events.filter((e) => e.name === 'form_abandon')).toHaveLength(0);
  });

  it('respects trackAbandon=false', () => {
    const events: CapturedEvent[] = [];
    renderForm(events, false);

    fireEvent.focus(screen.getByLabelText('Email'));
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(events.filter((e) => e.name === 'form_abandon')).toHaveLength(0);
  });
});
