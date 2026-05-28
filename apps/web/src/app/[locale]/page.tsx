/**
 * Page démonstration locale — sert de pilote pour valider la chaîne i18n
 * complète (middleware → routing → request config → messages → render).
 *
 * Quand le flag `I18N_ENABLED=true`, accéder à `/fr/`, `/ar/` ou `/en/`
 * rend cette page traduite en utilisant `messages/<locale>.json`.
 *
 * Phase 2 ultérieure : migrer les vraies pages marketing
 * (`(marketing)/page.tsx` etc.) sous `[locale]/(marketing)/`.
 *
 * @see docs/i18n-strategy-2026-05/08-plan-action/phases.md §T1.7
 */
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher';
import { getLocaleConfig, isLocale } from '@/i18n.config';
import { notFound } from 'next/navigation';

interface PageProps {
  params: { locale: string };
}

export default async function LocalePilotPage({ params }: PageProps) {
  if (!isLocale(params.locale)) {
    notFound();
  }
  setRequestLocale(params.locale);

  const t = await getTranslations();
  const config = getLocaleConfig(params.locale);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-12 flex items-center justify-between gap-6">
        <span className="text-sm uppercase tracking-widest text-stone-500">
          {config.displayNameNative}
        </span>
        <LocaleSwitcher currentLocale={params.locale} />
      </header>

      <h1 className="font-serif text-5xl leading-tight text-stone-900">
        {t('marketing.home.hero.title')}
      </h1>

      <p className="mt-6 text-lg leading-relaxed text-stone-600">
        {t('marketing.home.hero.subtitle')}
      </p>

      <p className="mt-12 text-sm text-stone-500">
        {t('navigation.kit')} · {t('navigation.home')} · {t('navigation.rituel')}
      </p>

      <section className="mt-16 rounded border border-stone-200 bg-stone-50 p-6">
        <p className="text-xs uppercase tracking-widest text-stone-500">
          {t('common.loading').replace('…', '')}
        </p>
        <p className="mt-3 text-2xl font-serif text-stone-900">
          {t('marketing.home.avis.rating_label')}
        </p>
      </section>

      <footer className="mt-16 border-t border-stone-200 pt-6 text-xs text-stone-400">
        <p>
          Route pilote i18n FemiGlow — locale active :{' '}
          <code className="rounded bg-stone-100 px-1.5 py-0.5">
            {params.locale}
          </code>{' '}
          (direction <code>{config.direction}</code>)
        </p>
      </footer>
    </main>
  );
}
