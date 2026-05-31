/**
 * CHA-230 — Page de preview développeur pour le wizard checkout.
 *
 * Permet de tester le wizard isolé (sans intégration produit / panier) en
 * environnement local. Sert également de cible pour les vérifications
 * `mcp__Claude_Preview__preview_*` et pour les tests Playwright à venir.
 *
 * Visible uniquement en dev / preview — `notFound()` en production pour
 * éviter qu'elle soit indexée ou découvrable côté users.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { WizardPreviewClient } from './WizardPreviewClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Wizard checkout — preview',
  robots: { index: false, follow: false },
};

export default function CheckoutWizardPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <WizardPreviewClient />;
}
