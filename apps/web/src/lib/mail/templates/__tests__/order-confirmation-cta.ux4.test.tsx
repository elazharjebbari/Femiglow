/**
 * UX4-PARCOURS-001 — Le CTA « Suivre ma commande » de l'email de confirmation
 * doit pointer vers une route RÉELLEMENT EXISTANTE.
 *
 * Issue (UX-PUB-001) : le template émettait
 *   href="https://femiglow-maroc.com/compte/commandes/<orderId>"
 * or aucune route `/compte` n'existe dans `src/app` → 404 garanti sur la
 * principale action post-achat. Le fix pointe vers `/merci?order=<orderId>`,
 * page de suivi de commande réelle (`src/app/(commerce)/merci/page.tsx`, qui
 * lit `searchParams.order`).
 *
 * Pur unit : on rend le template React et on inspecte le HTML produit. Aucune
 * DB, aucun réseau.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { createElement } from 'react';
import OrderConfirmation from '@/lib/mail/templates/order-confirmation';

const PAYLOAD = {
  firstName: 'Kaoutar',
  orderId: 'FG-2026-0042',
  orderTotal: '249.00 MAD',
  itemsCount: 2,
  deliveryEstimate: '2-4 jours ouvrés',
};

async function renderHtml(payload = PAYLOAD): Promise<string> {
  return render(createElement(OrderConfirmation, payload), { pretty: false });
}

describe('UX4-PARCOURS-001 — CTA order-confirmation vers une route existante', () => {
  it('UX4-PARCOURS-001 : le HTML ne contient AUCUN lien /compte/commandes (route inexistante → 404)', async () => {
    const html = await renderHtml();
    expect(html).not.toContain('/compte/commandes');
    expect(html).not.toContain('/compte/');
  });

  it('UX4-PARCOURS-001 : le CTA « Suivre ma commande » pointe vers /merci?order=<orderId> (route réelle)', async () => {
    const html = await renderHtml();
    // La route de suivi réelle reçoit l'orderId en query (cf. MerciPage).
    expect(html).toContain('/merci?order=');
    expect(html).toContain(`/merci?order=${PAYLOAD.orderId}`);
    // Le libellé de l'action reste présent (on n'a pas cassé le bouton).
    expect(html).toContain('Suivre ma commande');
  });

  it('UX4-PARCOURS-001 : l\'orderId est encodé dans l\'URL (robustesse caractères spéciaux)', async () => {
    const html = await renderHtml({ ...PAYLOAD, orderId: 'FG 0042/A' });
    // encodeURIComponent → espaces et slash encodés, jamais de query cassée.
    expect(html).toContain('/merci?order=FG%200042%2FA');
    expect(html).not.toContain('/merci?order=FG 0042/A');
  });

  it('UX4-PARCOURS-001 : tous les href absolus émis ciblent femiglow-maroc.com (pas de host étranger)', async () => {
    const html = await renderHtml();
    const hrefs = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]!);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      // Host autorisé : femiglow-maroc.com (avec ou sans path) — pas de host
      // tiers ni de placeholder.
      expect(href).toMatch(/^https:\/\/femiglow-maroc\.com(\/|$)/);
      // Aucun href ne pointe vers le préfixe mort.
      expect(href).not.toContain('/compte/');
    }
  });
});
