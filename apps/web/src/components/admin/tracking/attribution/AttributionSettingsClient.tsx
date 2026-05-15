'use client';

/**
 * Page admin /admin/tracking/attribution — sélecteur de stratégie +
 * debugger client-side basé sur le cookie `fg_attr` du navigateur.
 *
 * La stratégie est persistée côté serveur (table tracking_settings).
 * Le bouton "Enregistrer" appelle un server action qui met à jour la
 * setting, audit-log + revalidatePath. La valeur initiale est passée
 * en prop depuis le RSC parent.
 */
import { useEffect, useState, useTransition } from 'react';
import {
  readAttributionCookie,
} from '@/lib/tracking/attribution/cookie';
import { simulateAllStrategies } from '@/lib/tracking/attribution/strategy';
import {
  ATTRIBUTION_STRATEGIES,
  CHANNEL_TO_PROVIDERS,
  STRATEGY_META,
  type AttributionSnapshot,
  type AttributionStrategy,
} from '@/lib/tracking/attribution/types';
import { setAttributionStrategyAction } from '@/lib/tracking/attribution/actions';

export function AttributionSettingsClient({
  initialStrategy,
}: {
  initialStrategy: AttributionStrategy;
}): JSX.Element {
  const [strategy, setStrategy] = useState<AttributionStrategy>(initialStrategy);
  const [savedStrategy, setSavedStrategy] = useState<AttributionStrategy>(initialStrategy);
  const [snapshot, setSnapshot] = useState<AttributionSnapshot | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const dirty = strategy !== savedStrategy;

  useEffect(() => {
    setSnapshot(readAttributionCookie());
  }, []);

  function save() {
    setSaveMessage(null);
    startTransition(async () => {
      try {
        const res = await setAttributionStrategyAction({ strategy });
        setSavedStrategy(res.strategy);
        setSaveMessage('✓ Stratégie enregistrée.');
        window.setTimeout(() => setSaveMessage(null), 3000);
      } catch (e) {
        setSaveMessage(
          e instanceof Error ? `Erreur : ${e.message}` : 'Erreur inattendue.',
        );
      }
    });
  }

  function refresh() {
    setSnapshot(readAttributionCookie());
  }

  function clearCookie() {
    if (typeof document !== 'undefined') {
      document.cookie = 'fg_attr=; Max-Age=0; Path=/';
      refresh();
    }
  }

  return (
    <div className="space-y-8">
      <DocPanel />

      <section aria-labelledby="strat-h">
        <h2 id="strat-h" className="mb-2 text-base font-semibold text-stone-900">
          ⚙️ Stratégie active
        </h2>
        <p className="mb-4 text-sm text-stone-600">
          Quand une conversion survient, FemiGlow lit le snapshot
          d'attribution du visiteur (cookie <code>fg_attr</code>) et applique
          la stratégie ci-dessous pour décider quel canal créditer.
        </p>
        <fieldset className="space-y-2" disabled={isPending}>
          <legend className="sr-only">Stratégie</legend>
          {ATTRIBUTION_STRATEGIES.map((s) => (
            <StrategyRadio
              key={s}
              value={s}
              checked={strategy === s}
              onChange={() => setStrategy(s)}
            />
          ))}
        </fieldset>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || isPending}
            className="rounded-md bg-stone-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? 'Enregistrement…' : 'Enregistrer la stratégie'}
          </button>
          {!dirty && !saveMessage && (
            <span className="text-xs text-stone-500">
              Stratégie active : <code className="font-mono">{savedStrategy}</code>
            </span>
          )}
          {saveMessage && (
            <span
              role="status"
              className={`text-xs ${
                saveMessage.startsWith('✓') ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {saveMessage}
            </span>
          )}
        </div>
      </section>

      <section aria-labelledby="debug-h">
        <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="debug-h" className="text-base font-semibold text-stone-900">
            🔍 Debugger — votre snapshot actuel
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={refresh}
              className="rounded border border-stone-300 bg-white px-3 py-1 text-xs hover:bg-stone-50"
            >
              Actualiser
            </button>
            <button
              type="button"
              onClick={clearCookie}
              className="rounded border border-rose-300 bg-white px-3 py-1 text-xs text-rose-700 hover:bg-rose-50"
            >
              Réinitialiser le cookie
            </button>
          </div>
        </header>
        <p className="mb-4 text-sm text-stone-600">
          Inspecte le cookie <code>fg_attr</code> de ton propre navigateur.
          Pour tester un visiteur acquisition différente, ouvre une fenêtre
          privée et navigue avec un click ID en URL (ex.{' '}
          <code>/?gclid=test_1</code>).
        </p>

        {snapshot ? (
          <SnapshotPanel snapshot={snapshot} activeStrategy={strategy} />
        ) : (
          <p className="text-sm text-stone-500">Chargement…</p>
        )}
      </section>
    </div>
  );
}

function StrategyRadio({
  value,
  checked,
  onChange,
}: {
  value: AttributionStrategy;
  checked: boolean;
  onChange: () => void;
}): JSX.Element {
  const meta = STRATEGY_META[value];
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition ${
        checked
          ? 'border-stone-900 bg-stone-50'
          : 'border-stone-200 bg-white hover:border-stone-400'
      }`}
    >
      <input
        type="radio"
        name="attribution-strategy"
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 accent-stone-900"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-stone-900">{meta.label}</span>
          {meta.recommended && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
              ★ Recommandé
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-stone-600">{meta.description}</p>
      </div>
    </label>
  );
}

function SnapshotPanel({
  snapshot,
  activeStrategy,
}: {
  snapshot: AttributionSnapshot;
  activeStrategy: AttributionStrategy;
}): JSX.Element {
  const simulations = simulateAllStrategies(snapshot);
  const active = simulations[activeStrategy];
  const enabledProviders =
    active.channel === 'broadcast'
      ? ['google_ads', 'meta', 'tiktok', 'snap', 'pinterest', 'bing_ads']
      : (CHANNEL_TO_PROVIDERS[active.channel] ?? []);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <TouchCard title="first_touch" touch={snapshot.first_touch} />
        <TouchCard title="last_touch" touch={snapshot.last_touch} />
        <div className="rounded-md border border-stone-200 bg-white p-3 text-xs">
          <h3 className="mb-1 font-medium text-stone-900">
            paid_history ({snapshot.paid_history.length})
          </h3>
          {snapshot.paid_history.length === 0 ? (
            <p className="text-stone-500">Aucun touch payant enregistré.</p>
          ) : (
            <ul className="space-y-1">
              {snapshot.paid_history.map((t, i) => (
                <li key={i} className="font-mono text-[11px]">
                  {i + 1}. {t.channel}
                  {t.click_id_field && ` (${t.click_id_field})`}{' '}
                  <span className="text-stone-400">
                    {new Date(t.detected_at).toLocaleString('fr-FR')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-4">
        <h3 className="mb-2 text-sm font-medium text-emerald-900">
          Résolution active (<code>{activeStrategy}</code>)
        </h3>
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[140px_1fr]">
          <dt className="text-stone-500">Canal attribué</dt>
          <dd className="font-mono font-medium text-stone-900">{active.channel}</dd>
          <dt className="text-stone-500">Payant</dt>
          <dd>{active.is_paid ? '✓ oui' : '— non'}</dd>
          <dt className="text-stone-500">Reason</dt>
          <dd className="font-mono text-xs text-stone-700">{active.reason}</dd>
          {active.click_id && (
            <>
              <dt className="text-stone-500">Click ID</dt>
              <dd className="font-mono text-xs text-stone-700">
                {active.click_id_field}: {active.click_id}
              </dd>
            </>
          )}
          <dt className="text-stone-500">Pixels qui fire</dt>
          <dd className="flex flex-wrap gap-1.5">
            {['google_ads', 'meta', 'tiktok', 'snap', 'pinterest'].map((p) => {
              const on = enabledProviders.includes(p);
              return (
                <span
                  key={p}
                  className={`rounded px-2 py-0.5 text-[11px] ring-1 ring-inset ${
                    on
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                      : 'bg-stone-50 text-stone-400 ring-stone-200 line-through'
                  }`}
                >
                  {on ? '✓ ' : ''}
                  {p}
                </span>
              );
            })}
          </dd>
        </dl>
      </div>

      <details className="overflow-hidden rounded-md border border-stone-200 bg-white">
        <summary className="cursor-pointer list-none px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">
          Simulation autres stratégies
        </summary>
        <div className="border-t border-stone-200 px-4 py-3 text-xs">
          <table className="w-full">
            <tbody className="divide-y divide-stone-100">
              {ATTRIBUTION_STRATEGIES.map((s) => (
                <tr key={s}>
                  <td className="py-1.5 pr-3 font-mono text-stone-700">{s}</td>
                  <td className="py-1.5 font-mono font-medium text-stone-900">
                    → {simulations[s].channel}
                  </td>
                  <td className="py-1.5 pl-3 text-[11px] text-stone-500">
                    {simulations[s].reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function TouchCard({
  title,
  touch,
}: {
  title: string;
  touch: AttributionSnapshot['first_touch'];
}): JSX.Element {
  return (
    <div className="rounded-md border border-stone-200 bg-white p-3 text-xs">
      <h3 className="mb-1 font-medium text-stone-900">{title}</h3>
      {!touch ? (
        <p className="text-stone-500">Aucune donnée.</p>
      ) : (
        <dl className="grid gap-x-2 gap-y-0.5 sm:grid-cols-[80px_1fr]">
          <dt className="text-stone-500">channel</dt>
          <dd className="font-mono font-medium text-stone-900">{touch.channel}</dd>
          <dt className="text-stone-500">paid</dt>
          <dd>{touch.is_paid ? '✓' : '—'}</dd>
          {touch.click_id_field && (
            <>
              <dt className="text-stone-500">click_id</dt>
              <dd className="truncate font-mono text-[11px]">
                {touch.click_id_field}: {touch.click_id?.slice(0, 24)}…
              </dd>
            </>
          )}
          {touch.utm?.source && (
            <>
              <dt className="text-stone-500">utm</dt>
              <dd className="truncate font-mono text-[11px]">
                {touch.utm.source}/{touch.utm.medium ?? '?'}
              </dd>
            </>
          )}
          <dt className="text-stone-500">when</dt>
          <dd className="text-[11px] text-stone-500">
            {new Date(touch.detected_at).toLocaleString('fr-FR')}
          </dd>
        </dl>
      )}
    </div>
  );
}

function DocPanel(): JSX.Element {
  return (
    <details className="group overflow-hidden rounded-lg border border-sky-200 bg-sky-50/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-sky-900 hover:bg-sky-50">
        <span className="flex items-center gap-2">
          <span aria-hidden>📖</span>
          <span>Comprendre l'attribution multi-canal</span>
        </span>
        <svg
          className="h-4 w-4 transition-transform group-open:rotate-90"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </summary>
      <div className="space-y-3 border-t border-sky-200 bg-white/60 p-4 text-sm leading-relaxed text-stone-700">
        <p>
          Sans attribution multi-canal, <strong>chaque conversion</strong>{' '}
          (achat, lead, sign-up) est envoyée à TOUS les pixels publicitaires
          actifs. Conséquence : Google Ads, Meta, TikTok se créditent tous
          de la même vente → ROAS dilué + Smart Bidding bruité.
        </p>
        <p>
          Avec l'attribution active, FemiGlow détecte le canal d'acquisition
          du visiteur (gclid / fbclid / ttclid / utm…) au landing et stocke
          ce signal dans un cookie 90 jours. Au moment de la conversion, la
          stratégie active décide quel canal payant créditer.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-stone-200 bg-white p-3">
            <h4 className="mb-1 text-xs font-medium text-stone-900">
              Events d'audience
            </h4>
            <p className="text-xs text-stone-600">
              <code>page_view</code>, <code>view_item</code>,{' '}
              <code>add_to_cart</code>… fire sur <strong>tous les pixels</strong>{' '}
              (pour Lookalike + Custom Audiences). L'attribution ne s'applique
              pas.
            </p>
          </div>
          <div className="rounded-md border border-stone-200 bg-white p-3">
            <h4 className="mb-1 text-xs font-medium text-stone-900">
              Events de conversion
            </h4>
            <p className="text-xs text-stone-600">
              <code>purchase</code>, <code>lead_capture</code>… fire{' '}
              <strong>uniquement sur le canal attribué</strong> (selon la
              stratégie active). Visiteur direct → tous les pixels.
            </p>
          </div>
        </div>
        <p className="text-xs text-stone-500">
          Doc complète :{' '}
          <code>docs/tracking-attribution/</code>
        </p>
      </div>
    </details>
  );
}
