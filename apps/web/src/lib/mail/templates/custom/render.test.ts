import { describe, it, expect, beforeEach } from 'vitest';
import { renderTemplate, clearTemplateCache } from './render';

beforeEach(() => clearTemplateCache());

describe('renderTemplate', () => {
  it('renders simple subject + body with variables', () => {
    const out = renderTemplate(
      {
        subjectTmpl: 'Bienvenue {{firstName}} !',
        htmlSource: '<p>Salut {{firstName}} de {{city}}</p>',
      },
      { firstName: 'Fatima', city: 'Casablanca' },
    );
    expect(out.subject).toBe('Bienvenue Fatima !');
    expect(out.html).toContain('Salut Fatima de Casablanca');
  });

  it('escapes HTML by default (XSS protection)', () => {
    const out = renderTemplate(
      {
        subjectTmpl: 'X',
        htmlSource: '<p>{{name}}</p>',
      },
      { name: '<script>alert(1)</script>' },
    );
    expect(out.html).not.toContain('<script>');
    expect(out.html).toContain('&lt;script&gt;');
  });

  it('sanitizes triple-brace HTML output', () => {
    const out = renderTemplate(
      {
        subjectTmpl: 'X',
        htmlSource: '<p>{{{userHtml}}}</p>',
      },
      { userHtml: '<script>alert(1)</script><strong>OK</strong>' },
    );
    expect(out.html).not.toContain('<script>');
    expect(out.html).toContain('<strong>OK</strong>');
  });

  it('renders preheader when provided', () => {
    const out = renderTemplate(
      {
        subjectTmpl: 'X',
        preheaderTmpl: 'Aperçu : {{value}}',
        htmlSource: '<p>x</p>',
      },
      { value: 'Hello' },
    );
    expect(out.preheader).toBe('Aperçu : Hello');
  });

  it('empty preheader when not provided', () => {
    const out = renderTemplate(
      { subjectTmpl: 'X', htmlSource: '<p>x</p>' },
      {},
    );
    expect(out.preheader).toBe('');
  });

  it('missing variables render as empty string', () => {
    const out = renderTemplate(
      { subjectTmpl: 'Hi {{missing}}', htmlSource: '<p>{{also_missing}}</p>' },
      {},
    );
    expect(out.subject).toBe('Hi ');
    expect(out.html).toContain('<p></p>');
  });

  it('supports {{#if}} conditional', () => {
    const out = renderTemplate(
      {
        subjectTmpl: 'X',
        htmlSource: '<p>{{#if vip}}Salut VIP{{else}}Salut{{/if}}</p>',
      },
      { vip: true },
    );
    expect(out.html).toContain('Salut VIP');
  });

  it('cache : same source compiles once', () => {
    const src = { subjectTmpl: 'X', htmlSource: '<p>{{a}}</p>' };
    renderTemplate(src, { a: '1' });
    renderTemplate(src, { a: '2' });
    // Pas d'API pour observer le cache directement, on vérifie juste
    // que le rendu reste correct
    const out = renderTemplate(src, { a: '3' });
    expect(out.html).toContain('3');
  });

  it('removes iframe + object tags', () => {
    const out = renderTemplate(
      {
        subjectTmpl: 'X',
        htmlSource: '<p>{{{evil}}}</p>',
      },
      { evil: '<iframe src="x"></iframe><object></object>OK' },
    );
    expect(out.html).not.toContain('<iframe');
    expect(out.html).not.toContain('<object');
    expect(out.html).toContain('OK');
  });

  it('preserves safe HTML tags (br, strong, a)', () => {
    const out = renderTemplate(
      {
        subjectTmpl: 'X',
        htmlSource: '{{{x}}}',
      },
      { x: '<a href="https://x.com">Lien</a><br><strong>bold</strong>' },
    );
    expect(out.html).toContain('<a');
    expect(out.html).toContain('<br');
    expect(out.html).toContain('<strong>bold</strong>');
  });
});
