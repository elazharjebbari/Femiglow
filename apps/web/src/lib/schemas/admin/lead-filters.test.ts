import { describe, it, expect } from 'vitest';
import {
  leadFiltersSchema,
  leadStatusUpdateSchema,
  leadNoteSchema,
} from './lead-filters';

describe('leadFiltersSchema', () => {
  it('défauts page=1 pageSize=25 sort=created_desc', () => {
    const r = leadFiltersSchema.parse({});
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(25);
    expect(r.sort).toBe('created_desc');
  });

  it('coerce les valeurs string en nombres', () => {
    const r = leadFiltersSchema.parse({ page: '2', pageSize: '50' });
    expect(r.page).toBe(2);
    expect(r.pageSize).toBe(50);
  });

  it('borne pageSize entre 5 et 100', () => {
    expect(leadFiltersSchema.safeParse({ pageSize: 4 }).success).toBe(false);
    expect(leadFiltersSchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });

  it('rejette un statut inconnu', () => {
    expect(leadFiltersSchema.safeParse({ status: 'pirate' }).success).toBe(false);
  });
});

describe('leadStatusUpdateSchema', () => {
  it('accepte uniquement les statuts du domaine', () => {
    expect(leadStatusUpdateSchema.parse({ status: 'qualified' }).status).toBe('qualified');
    expect(leadStatusUpdateSchema.safeParse({ status: 'won' }).success).toBe(false);
  });
});

describe('leadNoteSchema', () => {
  it('exige 2 à 2000 caractères', () => {
    expect(leadNoteSchema.safeParse({ content: 'a' }).success).toBe(false);
    expect(leadNoteSchema.safeParse({ content: 'ok' }).success).toBe(true);
    expect(leadNoteSchema.safeParse({ content: 'x'.repeat(2001) }).success).toBe(false);
  });

  it('trim avant validation', () => {
    const r = leadNoteSchema.parse({ content: '  hello  ' });
    expect(r.content).toBe('hello');
  });
});
