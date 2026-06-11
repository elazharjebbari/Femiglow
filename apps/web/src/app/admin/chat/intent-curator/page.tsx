/**
 * CHA-230 Phase 3.3 — Page admin "Intent curator".
 *
 * Liste les derniers messages user avec leur intent classifié (regex /
 * llm / llm-fixed) et permet à l'admin :
 *   - de filtrer par intent, langue, méthode (URL search params)
 *   - de tagger manuellement un message comme golden-set (POST API)
 *   - de retirer le tag (DELETE API)
 *
 * Architecture :
 *   - Server Component : fait les queries Drizzle directes
 *     (`adminQueries.listMessagesForCurator` + `goldenIntentRepo.existsForMessages`)
 *   - Client Component `<IntentCuratorRow />` : pour le bouton "Tag manuel"
 *     et le dropdown intent — appelle les routes /api/admin/chat/intent-curator/*
 *
 * cf. docs/chat-assistant/20-langchain-robustness-plan.md §2.7
 */
import Link from 'next/link';

import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { IntentCuratorRow } from '@/components/admin/chat/IntentCuratorRow';
import { adminQueries } from '@/lib/chat/admin/queries';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import { goldenIntentRepo } from '@/lib/chat/repos/golden-intent';
import { intentEnumSchema, type IntentTag } from '@/lib/chat/schemas/intent';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

type Method = 'regex' | 'llm' | 'llm-fixed' | 'golden' | 'manual';
const METHODS: Array<{ value: Method | 'all'; label: string }> = [
  { value: 'all', label: 'Toutes' },
  { value: 'regex', label: 'Regex' },
  { value: 'llm', label: 'LLM' },
  { value: 'llm-fixed', label: 'LLM corrigé' },
  { value: 'manual', label: 'Manuel' },
];

const LANGS = [
  { value: 'all', label: 'Toutes' },
  { value: 'fr', label: 'Français' },
  { value: 'ar', label: 'العربية' },
  { value: 'ar-MA', label: 'Darija' },
] as const;

interface PageProps {
  searchParams?: {
    intent?: string;
    language?: string;
    method?: string;
    limit?: string;
  };
}

function isMethod(v: string | undefined): v is Method {
  return (
    v === 'regex' ||
    v === 'llm' ||
    v === 'llm-fixed' ||
    v === 'golden' ||
    v === 'manual'
  );
}

function isLanguage(v: string | undefined): v is 'fr' | 'ar' | 'ar-MA' {
  return v === 'fr' || v === 'ar' || v === 'ar-MA';
}

function isIntent(v: string | null | undefined): v is IntentTag {
  if (!v) return false;
  return intentEnumSchema.safeParse(v).success;
}

function buildHref(
  current: { intent?: string; language?: string; method?: string },
  patch: Partial<{ intent: string; language: string; method: string }>,
): string {
  const merged = { ...current, ...patch };
  const params = new URLSearchParams();
  if (merged.intent) params.set('intent', merged.intent);
  if (merged.language) params.set('language', merged.language);
  if (merged.method) params.set('method', merged.method);
  const qs = params.toString();
  return qs ? `/admin/chat/intent-curator?${qs}` : '/admin/chat/intent-curator';
}

export default async function IntentCuratorPage({ searchParams }: PageProps) {
  const session = await requireAdmin('/admin/chat/intent-curator');
  if (!isChatEnabled()) {
    return (
      <AdminShell adminEmail={session.email} active="chat">
        <ChatAdminNav active="intent-curator" />
        <p className="text-sm text-stone-500">Chat désactivé.</p>
      </AdminShell>
    );
  }

  const intentFilter = isIntent(searchParams?.intent) ? searchParams!.intent : undefined;
  const languageFilter = isLanguage(searchParams?.language)
    ? searchParams!.language
    : undefined;
  const methodFilter = isMethod(searchParams?.method) ? searchParams!.method : undefined;
  const limit = (() => {
    const raw = Number.parseInt(searchParams?.limit ?? '', 10);
    if (!Number.isFinite(raw)) return 100;
    return Math.min(500, Math.max(20, raw));
  })();

  const [messages, intentEnumOptions] = await Promise.all([
    adminQueries
      .listMessagesForCurator({
        intent: intentFilter,
        language: languageFilter,
        method: methodFilter,
        limit,
      })
      .catch(() => []),
    Promise.resolve(intentEnumSchema.options),
  ]);

  const taggedSet = await goldenIntentRepo
    .existsForMessages(messages.map((m) => m.id))
    .catch(() => new Set<string>());

  const currentParams = {
    intent: intentFilter,
    language: languageFilter,
    method: methodFilter,
  };

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="intent-curator" />
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Intent curator</h1>
        <p className="text-sm text-stone-600">
          Tag manuel des messages user comme golden-set pour la régression
          CI. Les messages déjà tagués apparaissent en vert.
        </p>
      </header>

      {/* ----- Filtres ---------------------------------------------------- */}
      <section className="mb-4 grid gap-3 rounded-md border border-stone-200 bg-white p-3 sm:grid-cols-3">
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-stone-500">
            Intent
          </p>
          <div className="flex flex-wrap gap-1">
            <Link
              href={buildHref(currentParams, { intent: '' })}
              className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                !intentFilter
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              Tous
            </Link>
            {intentEnumOptions.map((opt) => (
              <Link
                key={opt}
                href={buildHref(currentParams, { intent: opt })}
                className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                  intentFilter === opt
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {opt}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-stone-500">
            Langue
          </p>
          <div className="flex flex-wrap gap-1">
            {LANGS.map((l) => (
              <Link
                key={l.value}
                href={buildHref(currentParams, {
                  language: l.value === 'all' ? '' : l.value,
                })}
                className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                  (l.value === 'all' && !languageFilter) ||
                  l.value === languageFilter
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-stone-500">
            Méthode
          </p>
          <div className="flex flex-wrap gap-1">
            {METHODS.map((m) => (
              <Link
                key={m.value}
                href={buildHref(currentParams, {
                  method: m.value === 'all' ? '' : m.value,
                })}
                className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                  (m.value === 'all' && !methodFilter) ||
                  m.value === methodFilter
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {m.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ----- Table ------------------------------------------------------ */}
      <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-3 py-2">Quand</th>
              <th className="px-3 py-2">Texte</th>
              <th className="px-3 py-2">Lang</th>
              <th className="px-3 py-2">Intent détecté</th>
              <th className="px-3 py-2">Méthode</th>
              <th className="px-3 py-2">Confiance</th>
              <th className="px-3 py-2">Tag manuel</th>
            </tr>
          </thead>
          <tbody>
            {messages.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-stone-500"
                >
                  Aucun message ne correspond aux filtres.
                </td>
              </tr>
            )}
            {messages.map((m) => {
              const text = m.contentSafe ?? m.content ?? '';
              const isAr = m.language === 'ar' || m.language === 'ar-MA';
              const detected = isIntent(m.intentTag) ? m.intentTag : null;
              return (
                <tr key={m.id} className="border-t border-stone-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] tabular-nums text-stone-500">
                    {m.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="px-3 py-2">
                    <div
                      className="max-w-md text-stone-900"
                      dir={isAr ? 'rtl' : 'ltr'}
                    >
                      {text.length > 280 ? `${text.slice(0, 280)}…` : text}
                    </div>
                    <Link
                      href={`/admin/chat/conversations/${m.sessionId}`}
                      className="text-[11px] text-stone-500 underline-offset-2 hover:underline"
                    >
                      session {m.sessionId.slice(0, 12)}…
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-700">
                    {m.language ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {detected ? (
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 font-mono text-[11px] text-stone-700">
                        {detected}
                      </span>
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {m.intentMethod ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          m.intentMethod === 'llm-fixed'
                            ? 'bg-amber-100 text-amber-800'
                            : m.intentMethod === 'manual'
                              ? 'bg-violet-100 text-violet-800'
                              : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {m.intentMethod}
                      </span>
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-700">
                    {m.intentConfidence ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <IntentCuratorRow
                      messageId={m.id}
                      alreadyTagged={taggedSet.has(m.id)}
                      detectedIntent={detected}
                      intents={intentEnumOptions}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-stone-500">
        {messages.length} messages affichés (limite {limit}).{' '}
        <Link href="/admin/chat/quality" className="underline-offset-2 hover:underline">
          → Voir le dashboard qualité
        </Link>
      </p>
    </AdminShell>
  );
}
