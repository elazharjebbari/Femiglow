/**
 * UX4-PARCOURS-005 (RTL) — La page de désinscription (GET non destructif)
 * expose un CTA « Me réabonner » et un formulaire de confirmation explicite.
 *
 * Issue (UX-PUB-004 / UX-PUB-005) : avant la vague 4, le GET désinscrivait
 * immédiatement et n'offrait qu'un lien vers l'accueil. Désormais le GET rend une
 * page de CONFIRMATION (non destructive) avec deux actions POST :
 *   - « Confirmer la désinscription » (POST sans action → suppression)
 *   - « Me réabonner » (POST action=resubscribe → retire la suppression)
 *
 * Ici on prouve la STRUCTURE de la page (boutons FR, formulaires POST, cibles
 * d'action correctes) en injectant le HTML rendu dans le DOM jsdom. L'effet de
 * bord « le re-opt-in retire la suppression » est prouvé côté vraie-DB dans
 * route.integration.test.ts (UX4-PARCOURS-005).
 *
 * Le GET est non destructif → aucune DB requise (il ne fait que vérifier le
 * token signé). On pose le secret avant les imports pour signer un vrai token.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { within } from '@testing-library/react';

vi.hoisted(() => {
  process.env.MAIL_UNSUB_TOKEN_SECRET ??= 'qa-resub-page-secret-0123456789abcdef';
});

vi.mock('@/lib/mail/rate-limit', () => ({
  enforceMailRateLimit: vi.fn().mockResolvedValue(null),
}));

import { GET } from '../route';
import { generateUnsubToken } from '@/lib/mail/unsub-token';

const EMAIL = 'reabo-rtl@exemple.test';

async function renderPage(token: string): Promise<void> {
  const req = new Request(
    `http://localhost/api/mail/unsubscribe?t=${encodeURIComponent(token)}`,
    { method: 'GET' },
  );
  const res = await GET(req as never);
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toContain('text/html');
  document.body.innerHTML = await res.text();
}

beforeAll(() => {
  // jsdom est l'environnement par défaut de la config vitest (component).
});

beforeEach(() => {
  document.body.innerHTML = '';
});

afterAll(() => {
  document.body.innerHTML = '';
});

describe('UX4-PARCOURS-005 — page de désinscription : CTA « Me réabonner »', () => {
  it('UX4-PARCOURS-005 : la page expose un bouton « Me réabonner » (re-opt-in)', async () => {
    await renderPage(generateUnsubToken(EMAIL));
    const body = within(document.body);
    expect(
      body.getByRole('button', { name: /me réabonner/i }),
    ).toBeInTheDocument();
  });

  it('UX4-PARCOURS-005 : le bouton « Me réabonner » est dans un form POST action=resubscribe', async () => {
    const token = generateUnsubToken(EMAIL);
    await renderPage(token);
    const resubBtn = within(document.body).getByRole('button', { name: /me réabonner/i });
    const form = resubBtn.closest('form');
    expect(form).not.toBeNull();
    expect(form!.getAttribute('method')?.toLowerCase()).toBe('post');
    const action = form!.getAttribute('action') ?? '';
    expect(action).toContain('/api/mail/unsubscribe');
    expect(action).toContain('action=resubscribe');
    expect(action).toContain(`t=${encodeURIComponent(token)}`);
  });

  it('UX4-PARCOURS-005 : la page porte AUSSI le form de confirmation de désinscription (POST, sans action=resubscribe)', async () => {
    const token = generateUnsubToken(EMAIL);
    await renderPage(token);
    const confirmBtn = within(document.body).getByRole('button', {
      name: /confirmer la désinscription/i,
    });
    const form = confirmBtn.closest('form');
    expect(form).not.toBeNull();
    expect(form!.getAttribute('method')?.toLowerCase()).toBe('post');
    const action = form!.getAttribute('action') ?? '';
    expect(action).toContain('/api/mail/unsubscribe');
    expect(action).not.toContain('action=resubscribe');
    // L'adresse concernée est rappelée à l'utilisateur (consentement éclairé).
    expect(document.body.textContent).toContain(EMAIL);
  });

  it('UX4-PARCOURS-005 : un GET (page affichée) ne désinscrit pas — il n\'y a pas de mention « confirmée »', async () => {
    await renderPage(generateUnsubToken(EMAIL));
    // La page INVITE à confirmer ; elle n'annonce pas une désinscription déjà
    // actée (garde-fou anti-régression du GET non destructif).
    expect(document.body.textContent).not.toMatch(/désinscription confirmée/i);
  });
});
