/**
 * renderComponentByKey — dispatcher RSC pour la preview iframe (F4).
 *
 * Mappe un `componentKey` au composant React serveur correspondant,
 * en lui injectant les `fields` résolus (draft cascade).
 *
 * Convention : chaque composant migré au CMS expose un export `default`
 * dans `apps/web/src/components/cms/<key>/PreviewRender.tsx` qui prend
 * `{ fields }`. Cf. P12 — pilote `home-hero`.
 *
 * Pour les composants pas encore migrés, on renvoie un placeholder
 * neutre listant les champs résolus (utile pour valider que la cascade
 * draft fonctionne avant la migration complète).
 */
import 'server-only';
import type { ResolvedFields } from '@/lib/db/types';
import { Hero } from '@/components/sections/Hero';
import { mergeHeroFields } from '@/components/sections/hero-fields';
import { mockHomepage } from '@/data/mock/homepage';

interface RenderArgs {
  fields: ResolvedFields;
}

/**
 * Composants migrés (ajoutés au fil des phases pilote).
 *
 * P12 — `home-hero` : on utilise `mockHomepage.hero` comme base
 * (notamment pour `image`, `variant`) puis on superpose les `fields`
 * résolus via `mergeHeroFields`. La preview admin n'a pas accès au
 * système de slot media donc l'image affichée est celle du mock,
 * mais c'est suffisant pour valider visuellement les champs éditoriaux.
 */
const MIGRATED_COMPONENTS: Record<
  string,
  ((args: RenderArgs) => Promise<JSX.Element> | JSX.Element) | undefined
> = {
  'home-hero': ({ fields }) => {
    const merged = mergeHeroFields(mockHomepage.hero, fields);
    return <Hero data={merged} priority={false} />;
  },
};

export async function renderComponentByKey(
  componentKey: string,
  args: RenderArgs,
): Promise<JSX.Element> {
  const renderer = MIGRATED_COMPONENTS[componentKey];
  if (renderer) {
    return await renderer(args);
  }
  return <PreviewPlaceholder componentKey={componentKey} fields={args.fields} />;
}

interface PlaceholderProps {
  componentKey: string;
  fields: ResolvedFields;
}

function PreviewPlaceholder({ componentKey, fields }: PlaceholderProps): JSX.Element {
  const entries = Object.entries(fields);
  return (
    <div
      className="preview-placeholder mx-auto max-w-3xl space-y-4 p-8 font-sans text-sm text-stone-800"
      data-preview-placeholder
    >
      <header>
        <p className="text-xs uppercase tracking-wide text-stone-500">
          Aperçu — composant pas encore migré
        </p>
        <h2 className="mt-1 text-lg font-semibold text-stone-900">{componentKey}</h2>
      </header>
      {entries.length === 0 ? (
        <p className="rounded-md bg-stone-50 p-4 text-stone-500">
          Aucun champ éditorial déclaré dans le registre.
        </p>
      ) : (
        <dl className="divide-y divide-stone-100 rounded-md border border-stone-200 bg-white">
          {entries.map(([key, resolved]) => (
            <div
              key={key}
              data-field-key={key}
              className="grid grid-cols-[160px_1fr] gap-4 px-4 py-3"
            >
              <dt className="font-mono text-xs text-stone-500">{key}</dt>
              <dd className="break-words text-stone-800">
                <pre className="whitespace-pre-wrap text-xs">
                  {JSON.stringify(resolved.value, null, 2)}
                </pre>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-stone-400">
                  source: {resolved.meta.source}
                </p>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
