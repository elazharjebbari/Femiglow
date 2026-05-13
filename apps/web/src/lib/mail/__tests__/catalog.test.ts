import { describe, it, expect } from 'vitest';
import { TEMPLATE_REGISTRY, getTemplateMeta, isKnownTemplate } from '../catalog';

describe('catalog', () => {
  it('contains expected initial templates', () => {
    const slugs = Object.keys(TEMPLATE_REGISTRY).sort();
    expect(slugs).toContain('contact-acknowledgement');
    expect(slugs).toContain('order-confirmation');
  });

  describe.each(Object.entries(TEMPLATE_REGISTRY))('Template %s', (slug, meta) => {
    it('has consistent slug field', () => {
      expect(meta.slug).toBe(slug);
    });

    it('sampleData validates against its schema', () => {
      expect(() => meta.schema.parse(meta.sampleData)).not.toThrow();
    });

    it('subjectFn returns non-empty string < 140 chars', () => {
      const subject = meta.subjectFn(meta.sampleData as any);
      expect(subject.length).toBeGreaterThan(0);
      expect(subject.length).toBeLessThan(140);
    });

    it('version is a positive integer', () => {
      expect(Number.isInteger(meta.version)).toBe(true);
      expect(meta.version).toBeGreaterThan(0);
    });

    it('declares at least one variable', () => {
      expect(meta.variables.length).toBeGreaterThan(0);
    });

    it('each variable has a non-empty name + label + sample', () => {
      for (const v of meta.variables) {
        expect(v.name).toBeTruthy();
        expect(v.label).toBeTruthy();
        expect(v.sample).toBeTruthy();
      }
    });
  });

  describe('getTemplateMeta / isKnownTemplate', () => {
    it('returns meta for known slug', () => {
      expect(getTemplateMeta('contact-acknowledgement').slug).toBe('contact-acknowledgement');
    });

    it('throws on unknown slug', () => {
      expect(() => getTemplateMeta('does-not-exist' as any)).toThrow();
    });

    it('isKnownTemplate is a type guard', () => {
      expect(isKnownTemplate('contact-acknowledgement')).toBe(true);
      expect(isKnownTemplate('nope')).toBe(false);
    });
  });
});
