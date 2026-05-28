/**
 * `FAQAccordion` — liste accordéon des questions-réponses contact.
 *
 * Phase 7C (2026-05) — Architecture dual (sync + helper async pour i18n) :
 *  - composant sync : strings du header (kicker + title) injectés en prop
 *    `header`, sinon fallback FR legacy.
 *  - `getFAQAccordionHeaderForLocale(locale)` — helper async exporté pour
 *    pré-résoudre dans la page parente.
 *
 * @see docs/i18n-strategy-2026-05/PHASE-7-AUDIT.md §A2
 */
import { getTranslations } from 'next-intl/server';

import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import type { Locale } from '@/i18n.config';

export interface FAQAccordionItem {
  id: string;
  question: string;
  answer: string;
}

export interface FAQAccordionHeader {
  kicker: string;
  title: string;
}

interface FAQAccordionProps {
  items: FAQAccordionItem[];
  /**
   * Strings du header (kicker + title). Si absent → fallback FR legacy.
   */
  header?: FAQAccordionHeader;
}

const LEGACY_HEADER_FR: FAQAccordionHeader = {
  kicker: 'Foire aux questions',
  title: 'Réponses rapides.',
};

export async function getFAQAccordionHeaderForLocale(
  locale: Locale,
): Promise<FAQAccordionHeader> {
  const t = await getTranslations({
    locale,
    namespace: 'marketing.contact.faq',
  });
  return { kicker: t('kicker'), title: t('title') };
}

export function FAQAccordion({ items, header = LEGACY_HEADER_FR }: FAQAccordionProps) {
  return (
    <section className="border-t border-encre/10 bg-creme py-16 sm:py-20">
      <Container width="prose">
        <div className="mb-10 space-y-3">
          <Kicker>{header.kicker}</Kicker>
          <Heading as="h2" size="display-sm">
            {header.title}
          </Heading>
        </div>
        <ul className="divide-y divide-encre/10 border-y border-encre/10">
          {items.map((item) => (
            <li key={item.id}>
              <details className="group py-5 [&_summary::-webkit-details-marker]:hidden motion-reduce:transition-none">
                <summary
                  className="flex cursor-pointer list-none items-start justify-between gap-6 text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-encre"
                >
                  <span className="font-display text-xl text-encre">{item.question}</span>
                  <span
                    aria-hidden="true"
                    className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center text-encre/60 transition-transform duration-base group-open:rotate-45 motion-reduce:transition-none"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-none text-base text-encre/80">{item.answer}</p>
              </details>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
