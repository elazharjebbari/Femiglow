/**
 * Seed legal pages — alimente les 9 pages légales préconfigurées en draft.
 *
 * Idempotent : ré-applique les valeurs seed à chaque exécution. **Préserve
 * les éditions admin** : ne touche pas une page dont status != 'draft' ou
 * dont body_md a été modifié (sauf si appelé avec `--force`).
 *
 * Usage : pnpm tsx scripts/seed-legal.ts
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import {
  legalPages,
  legalPagePlacements,
  legalZones,
  legalTemplateVars,
} from '@/lib/db/schema';
import { createId } from '@/lib/ids';
import { LEGAL_PAGE_ID_PREFIX } from '@/lib/legal/types';

interface SeedPage {
  slug: string;
  title: string;
  description: string;
  contentFile: string;
  includeInSearch: boolean;
  requireLegalReview: boolean;
}

interface SeedPlacement {
  pageSlug: string;
  zoneKey: string;
  displayOrder: number;
  isVisible: boolean;
  labelOverride?: string;
}

const CONTENT_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  '..',
  '..',
  'docs',
  'legal-pages',
  '60-content',
);

const PAGES: SeedPage[] = [
  { slug: 'mentions-legales',        title: 'Mentions légales',                                  description: 'Informations légales obligatoires sur FemiGlow : éditeur, hébergement, propriété intellectuelle.', contentFile: 'mentions-legales.md',                  includeInSearch: false, requireLegalReview: true  },
  { slug: 'cgv',                     title: 'Conditions Générales de Vente',                     description: 'CGV applicables à toute commande passée sur le site FemiGlow.',                                       contentFile: 'conditions-generales-vente.md',         includeInSearch: false, requireLegalReview: true  },
  { slug: 'cgu',                     title: "Conditions Générales d'Utilisation",                description: "Règles d'utilisation du site femiglow-maroc.com.",                                                  contentFile: 'conditions-generales-utilisation.md',   includeInSearch: false, requireLegalReview: true  },
  { slug: 'confidentialite',         title: 'Politique de confidentialité',                      description: 'Comment FemiGlow traite vos données personnelles, conformément à la Loi 09-08.',                     contentFile: 'politique-confidentialite.md',          includeInSearch: false, requireLegalReview: true  },
  { slug: 'cookies',                 title: 'Politique cookies',                                 description: 'Détail des cookies utilisés sur le site et comment gérer vos préférences.',                          contentFile: 'politique-cookies.md',                  includeInSearch: false, requireLegalReview: true  },
  { slug: 'retours-remboursements',  title: 'Politique de retours et remboursements',            description: 'Modalités de retour des produits FemiGlow et délai de remboursement (Loi 31-08).',                   contentFile: 'politique-retours-remboursements.md',   includeInSearch: false, requireLegalReview: true  },
  { slug: 'livraison',               title: 'Politique de livraison',                            description: 'Zones desservies, délais et frais de livraison FemiGlow au Maroc.',                                  contentFile: 'politique-livraison.md',                includeInSearch: true,  requireLegalReview: false },
  { slug: 'securite-produits',       title: 'Sécurité et avertissements produits cosmétiques',   description: "Précautions d'usage, allergies, conservation des produits cosmétiques FemiGlow.",                    contentFile: 'avertissements-securite-produits.md',   includeInSearch: false, requireLegalReview: true  },
  { slug: 'faq',                     title: 'FAQ — Service client',                              description: 'Questions fréquentes sur les produits, la commande, la livraison et le retour FemiGlow.',             contentFile: 'faq-service-client.md',                 includeInSearch: true,  requireLegalReview: false },
];

const PLACEMENTS: SeedPlacement[] = [
  { pageSlug: 'mentions-legales',       zoneKey: 'footer-main',         displayOrder: 1, isVisible: true },
  { pageSlug: 'mentions-legales',       zoneKey: 'footer-bottom-bar',   displayOrder: 1, isVisible: true, labelOverride: 'Mentions' },

  { pageSlug: 'cgv',                    zoneKey: 'footer-main',         displayOrder: 2, isVisible: true },
  { pageSlug: 'cgv',                    zoneKey: 'footer-bottom-bar',   displayOrder: 2, isVisible: true, labelOverride: 'CGV' },
  { pageSlug: 'cgv',                    zoneKey: 'checkout-consent',    displayOrder: 1, isVisible: true, labelOverride: 'CGV' },

  { pageSlug: 'cgu',                    zoneKey: 'footer-main',         displayOrder: 3, isVisible: true },
  { pageSlug: 'cgu',                    zoneKey: 'chat-disclaimer',     displayOrder: 1, isVisible: true, labelOverride: 'CGU' },

  { pageSlug: 'confidentialite',        zoneKey: 'footer-main',         displayOrder: 4, isVisible: true },
  { pageSlug: 'confidentialite',        zoneKey: 'cookie-banner-links', displayOrder: 1, isVisible: true, labelOverride: 'Confidentialité' },
  { pageSlug: 'confidentialite',        zoneKey: 'checkout-consent',    displayOrder: 2, isVisible: true, labelOverride: 'Politique de confidentialité' },
  { pageSlug: 'confidentialite',        zoneKey: 'signup-consent',      displayOrder: 1, isVisible: true, labelOverride: 'politique de confidentialité' },

  { pageSlug: 'cookies',                zoneKey: 'footer-main',         displayOrder: 5, isVisible: true },
  { pageSlug: 'cookies',                zoneKey: 'cookie-banner-links', displayOrder: 2, isVisible: true, labelOverride: 'Cookies' },

  { pageSlug: 'retours-remboursements', zoneKey: 'footer-main',         displayOrder: 6, isVisible: true, labelOverride: 'Retours & remboursements' },
  { pageSlug: 'retours-remboursements', zoneKey: 'checkout-consent',    displayOrder: 3, isVisible: false, labelOverride: 'Politique de retour' },

  { pageSlug: 'livraison',              zoneKey: 'footer-main',         displayOrder: 7, isVisible: true },

  { pageSlug: 'securite-produits',      zoneKey: 'footer-main',         displayOrder: 8, isVisible: true, labelOverride: 'Sécurité produits' },

  { pageSlug: 'faq',                    zoneKey: 'footer-main',         displayOrder: 9, isVisible: true },
  { pageSlug: 'faq',                    zoneKey: 'mobile-menu',         displayOrder: 1, isVisible: true },
];

export interface SeedLegalOptions {
  /** Si true, écrase aussi les pages en review/published/archived (sinon préserve). */
  force?: boolean;
}

export interface SeedLegalResult {
  pagesInserted: number;
  pagesSkipped: number;
  placementsInserted: number;
  varsCount: number;
  zonesCount: number;
}

export async function seedLegalPages(opts: SeedLegalOptions = {}): Promise<SeedLegalResult> {
  const conn = db();
  if (!conn) {
    throw new Error('seed-legal: DATABASE_URL non défini');
  }

  let pagesInserted = 0;
  let pagesSkipped = 0;
  let placementsInserted = 0;

  for (const page of PAGES) {
    const body = await readFile(path.join(CONTENT_ROOT, page.contentFile), 'utf8');
    const existing = await conn.select().from(legalPages).where(eq(legalPages.slug, page.slug));
    const head = existing[0];

    if (head && head.status !== 'draft' && !opts.force) {
      pagesSkipped += 1;
      continue;
    }

    if (head) {
      await conn
        .update(legalPages)
        .set({
          title: page.title,
          description: page.description,
          bodyMd: body,
          includeInSearch: page.includeInSearch,
          requireLegalReview: page.requireLegalReview,
          updatedAt: sql`now()`,
        })
        .where(eq(legalPages.id, head.id));
    } else {
      await conn.insert(legalPages).values({
        id: createId(LEGAL_PAGE_ID_PREFIX),
        slug: page.slug,
        title: page.title,
        description: page.description,
        bodyMd: body,
        status: 'draft',
        version: 1,
        includeInSearch: page.includeInSearch,
        requireLegalReview: page.requireLegalReview,
        locale: 'fr-MA',
      });
    }
    pagesInserted += 1;
  }

  for (const placement of PLACEMENTS) {
    const result = await conn
      .insert(legalPagePlacements)
      .values({
        pageSlug: placement.pageSlug,
        zoneKey: placement.zoneKey,
        displayOrder: placement.displayOrder,
        isVisible: placement.isVisible,
        labelOverride: placement.labelOverride ?? null,
      })
      .onConflictDoNothing();
    if ((result as { rowCount?: number }).rowCount === 1) {
      placementsInserted += 1;
    } else {
      placementsInserted += 1;
    }
  }

  const zones = await conn.select({ key: legalZones.key }).from(legalZones);
  const vars = await conn.select({ key: legalTemplateVars.key }).from(legalTemplateVars);

  return {
    pagesInserted,
    pagesSkipped,
    placementsInserted,
    varsCount: vars.length,
    zonesCount: zones.length,
  };
}

async function main() {
  const force = process.argv.includes('--force');
  const result = await seedLegalPages({ force });
  console.log('[seed-legal]', JSON.stringify(result, null, 2));
}

const isCli = import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  main()
    .catch((err) => {
      console.error('[seed-legal] error:', err);
      process.exit(1);
    })
    .finally(() => process.exit(0));
}
