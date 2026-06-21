// @vitest-environment jsdom
/**
 * F07 P3.4-k (Lot 3 + F07-S) — aperçu : bascule Bureau/Mobile + durcissement
 * sandbox de l'iframe.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TemplateEditor } from '../TemplateEditor';
import type { EmailTemplateCustomRow, EmailTemplateCustomVersionRow } from '@/lib/db/schema-emails';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const baseTemplate: EmailTemplateCustomRow = {
  id: 'tpl-1',
  slug: 'welcome',
  name: 'Welcome',
  description: null,
  subjectTmpl: 'Hi {{firstName}}',
  preheaderTmpl: null,
  htmlSource: '<!doctype html><html><body><p>Hi</p></body></html>',
  customVars: {},
  activeVersionId: null,
  createdBy: 'admin@example.com',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};
const baseVersions: EmailTemplateCustomVersionRow[] = [];

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ html: '<p>rendered</p>', subject: 'Hi' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
});

describe('TemplateEditor — aperçu (P3.4-k)', () => {
  it('F07-C-030 — iframe d’aperçu en sandbox="" (origine opaque, scripts inertes)', () => {
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    const iframe = screen.getByTitle('Email preview');
    // Durci F07-S : sandbox vide (≠ allow-same-origin). L'attribut DOIT exister
    // et être STRICTEMENT vide (pas de token).
    expect(iframe).toHaveAttribute('sandbox', '');
  });

  it('F07-C-031 — Bureau par défaut (pleine largeur), bascule Mobile borne le cadre à 390px', () => {
    render(<TemplateEditor template={baseTemplate} versions={baseVersions} />);
    const frame = screen.getByTestId('preview-frame');
    expect(frame).toHaveAttribute('data-viewport', 'desktop');

    const inner = screen.getByTitle('Email preview').parentElement as HTMLElement;
    expect(inner.style.maxWidth).toBe('100%');

    fireEvent.click(screen.getByRole('button', { name: 'Mobile' }));
    expect(frame).toHaveAttribute('data-viewport', 'mobile');
    expect(inner.style.maxWidth).toBe('390px');
  });
});
