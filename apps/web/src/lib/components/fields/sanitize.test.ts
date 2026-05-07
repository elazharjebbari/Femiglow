import { describe, expect, it } from 'vitest';

import { sanitizeRichText } from './sanitize';

describe('sanitizeRichText — XSS vectors', () => {
  it('strips <script>alert(1)</script>', () => {
    const out = sanitizeRichText('<p>Hello</p><script>alert(1)</script>');
    expect(out).not.toMatch(/script/i);
    expect(out).toContain('<p>Hello</p>');
  });

  it('strips <img src=x onerror=alert(1)>', () => {
    const out = sanitizeRichText('<p>x</p><img src=x onerror=alert(1)>');
    expect(out).not.toMatch(/img/i);
    expect(out).not.toMatch(/onerror/i);
    expect(out).toContain('<p>x</p>');
  });

  it('removes javascript: href but may keep <a> tag without href', () => {
    const out = sanitizeRichText('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toMatch(/javascript:/i);
    // The <a> tag may remain (with no href attribute) or be reduced — both fine
    // as long as no executable href survives.
    expect(out).toContain('click');
  });

  it('keeps href on allowlisted host and strips onclick', () => {
    const out = sanitizeRichText(
      '<a href="https://instagram.com/x" onclick="evil()">link</a>',
      { allowedHosts: ['instagram.com'] },
    );
    expect(out).toMatch(/href="https:\/\/instagram\.com\/x"/);
    expect(out).not.toMatch(/onclick/i);
  });

  it('strips <iframe>', () => {
    const out = sanitizeRichText('<p>ok</p><iframe src="https://evil.com"></iframe>');
    expect(out).not.toMatch(/iframe/i);
    expect(out).toContain('<p>ok</p>');
  });

  it('strips <style> blocks (content + tag)', () => {
    const out = sanitizeRichText('<p>ok</p><style>body{display:none}</style>');
    expect(out).not.toMatch(/style/i);
    expect(out).not.toMatch(/display/i);
    expect(out).toContain('<p>ok</p>');
  });

  it('preserves allowed editorial tags <h2>, <h3>', () => {
    const out = sanitizeRichText('<h2>Allowed</h2><h3>Sub</h3>');
    expect(out).toContain('<h2>Allowed</h2>');
    expect(out).toContain('<h3>Sub</h3>');
  });

  it('preserves <p>foo<strong>bar</strong></p>', () => {
    const out = sanitizeRichText('<p>foo<strong>bar</strong></p>');
    expect(out).toBe('<p>foo<strong>bar</strong></p>');
  });

  it('decodes entity-injected script and strips it', () => {
    const out = sanitizeRichText('&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;<p>safe</p>');
    expect(out).not.toMatch(/script/i);
    expect(out).toContain('<p>safe</p>');
  });

  it('preserves self-closing <br/> and <br>', () => {
    const out1 = sanitizeRichText('<p>a<br/>b</p>');
    const out2 = sanitizeRichText('<p>a<br>b</p>');
    expect(out1).toMatch(/<br\s*\/?>/);
    expect(out2).toMatch(/<br\s*\/?>/);
  });

  it('strips <link>, <meta>, and other unknown tags', () => {
    const out = sanitizeRichText(
      '<link rel="stylesheet" href="x"><meta http-equiv="refresh"><p>ok</p>',
    );
    expect(out).not.toMatch(/<link/i);
    expect(out).not.toMatch(/<meta/i);
    expect(out).toContain('<p>ok</p>');
  });

  it('strips inline event handlers from allowed tags', () => {
    const out = sanitizeRichText('<p onclick="evil()">x</p>');
    expect(out).not.toMatch(/onclick/i);
    expect(out).toContain('<p>x</p>');
  });

  it('rejects relative-protocol URLs (//evil.com)', () => {
    const out = sanitizeRichText('<a href="//evil.com">x</a>', {
      allowedHosts: ['instagram.com'],
    });
    expect(out).not.toMatch(/evil\.com/);
  });
});
