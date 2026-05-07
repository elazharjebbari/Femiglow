/**
 * Reducer — invariants des transitions.
 */
import { describe, it, expect } from 'vitest';
import { formReducer, makeInitialField, type FormState } from './reducer';

function baseState(overrides: Partial<FormState> = {}): FormState {
  return {
    componentKey: 'home-hero',
    locale: 'fr',
    fields: {
      title: makeInitialField('Hello', '2026-05-05T10:00:00.000Z'),
      subtitle: makeInitialField('World', null),
    },
    conflict: null,
    publishing: false,
    publishError: null,
    ...overrides,
  };
}

describe('formReducer', () => {
  it('INIT et RELOAD écrasent fields + reset conflict', () => {
    const s0 = baseState({
      conflict: {
        fieldKey: 'title',
        localValue: 'A',
        remoteValue: 'B',
        remoteUpdatedAt: 'x',
        remoteAuthorId: null,
      },
    });
    const fresh = { foo: makeInitialField('Foo') };
    const after = formReducer(s0, { type: 'INIT', fields: fresh });
    expect(after.fields).toEqual(fresh);
    expect(after.conflict).toBeNull();
  });

  it('FIELD_CHANGED met à jour current et reset error', () => {
    const s0 = baseState();
    s0.fields.title!.error = 'Trop court';
    const s1 = formReducer(s0, {
      type: 'FIELD_CHANGED',
      fieldKey: 'title',
      value: 'Bonjour',
    });
    expect(s1.fields.title!.current).toBe('Bonjour');
    expect(s1.fields.title!.initial).toBe('Hello');
    expect(s1.fields.title!.error).toBeNull();
  });

  it('FIELD_CHANGED ignore les clés inconnues', () => {
    const s0 = baseState();
    const s1 = formReducer(s0, {
      type: 'FIELD_CHANGED',
      fieldKey: 'unknown',
      value: 'X',
    });
    expect(s1).toBe(s0);
  });

  it('SAVE_STARTED → SAVE_SUCCEEDED actualise initial + ifMatch + savedAt', () => {
    const s0 = baseState();
    const s1 = formReducer(s0, { type: 'SAVE_STARTED', fieldKey: 'title' });
    expect(s1.fields.title!.saving).toBe(true);
    const s2 = formReducer(s1, {
      type: 'SAVE_SUCCEEDED',
      fieldKey: 'title',
      savedAt: '2026-05-05T11:00:00.000Z',
      updatedAt: '2026-05-05T11:00:00.000Z',
    });
    expect(s2.fields.title!.saving).toBe(false);
    expect(s2.fields.title!.lastSavedAt).toBe('2026-05-05T11:00:00.000Z');
    expect(s2.fields.title!.ifMatch).toBe('2026-05-05T11:00:00.000Z');
    // initial == current : le badge "saved" peut s'afficher.
    expect(s2.fields.title!.initial).toBe(s2.fields.title!.current);
  });

  it('SAVE_FAILED garde current et stocke l\'erreur', () => {
    const s0 = baseState();
    const s0b = formReducer(s0, {
      type: 'FIELD_CHANGED',
      fieldKey: 'title',
      value: 'Bad',
    });
    const s1 = formReducer(s0b, { type: 'SAVE_STARTED', fieldKey: 'title' });
    const s2 = formReducer(s1, {
      type: 'SAVE_FAILED',
      fieldKey: 'title',
      error: 'Trop court',
    });
    expect(s2.fields.title!.saving).toBe(false);
    expect(s2.fields.title!.error).toBe('Trop court');
    expect(s2.fields.title!.current).toBe('Bad');
  });

  it('CONFLICT_DETECTED stoppe le saving spinner du champ concerné', () => {
    const s0 = baseState();
    const s1 = formReducer(s0, { type: 'SAVE_STARTED', fieldKey: 'title' });
    const s2 = formReducer(s1, {
      type: 'CONFLICT_DETECTED',
      conflict: {
        fieldKey: 'title',
        localValue: 'A',
        remoteValue: 'B',
        remoteUpdatedAt: '2026-05-05T11:00:00.000Z',
        remoteAuthorId: 'adm_1',
      },
    });
    expect(s2.conflict?.fieldKey).toBe('title');
    expect(s2.fields.title!.saving).toBe(false);
  });

  it('CONFLICT_RESOLVED_KEEP_LOCAL clôt la modale sans toucher aux fields', () => {
    const s0 = baseState({
      conflict: {
        fieldKey: 'title',
        localValue: 'A',
        remoteValue: 'B',
        remoteUpdatedAt: 'x',
        remoteAuthorId: null,
      },
    });
    const s1 = formReducer(s0, { type: 'CONFLICT_RESOLVED_KEEP_LOCAL' });
    expect(s1.conflict).toBeNull();
    expect(s1.fields).toEqual(s0.fields);
  });

  it('CONFLICT_RESOLVED_RELOAD remplace fields et clôt la modale', () => {
    const s0 = baseState({
      conflict: {
        fieldKey: 'title',
        localValue: 'A',
        remoteValue: 'B',
        remoteUpdatedAt: 'x',
        remoteAuthorId: null,
      },
    });
    const fresh = { title: makeInitialField('Server', '2026-05-05T12:00:00.000Z') };
    const s1 = formReducer(s0, { type: 'CONFLICT_RESOLVED_RELOAD', fields: fresh });
    expect(s1.conflict).toBeNull();
    expect(s1.fields).toEqual(fresh);
  });

  it('PUBLISH_REQUESTED → PUBLISH_SUCCEEDED toggle publishing', () => {
    const s0 = baseState();
    const s1 = formReducer(s0, { type: 'PUBLISH_REQUESTED' });
    expect(s1.publishing).toBe(true);
    const s2 = formReducer(s1, { type: 'PUBLISH_SUCCEEDED' });
    expect(s2.publishing).toBe(false);
    expect(s2.publishError).toBeNull();
  });

  it('PUBLISH_FAILED stocke publishError', () => {
    const s0 = formReducer(baseState(), { type: 'PUBLISH_REQUESTED' });
    const s1 = formReducer(s0, { type: 'PUBLISH_FAILED', error: 'Échec' });
    expect(s1.publishing).toBe(false);
    expect(s1.publishError).toBe('Échec');
  });
});
