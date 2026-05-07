'use client';

/**
 * CHA-115b — Formulaire client pour la création d'un provider chat.
 *
 * - Auto-complétion des modèles via POST /api/admin/chat/providers/models
 *   (HTML5 <datalist> natif → dropdown sur focus + filtre instantané).
 * - Recharge la liste quand `kind`, `apiKey` ou `apiBase` changent (debounce).
 * - Fallback silencieux sur une liste statique si le fetch échoue.
 * - Le formulaire reste 100 % form-encoded → POST /api/admin/chat/providers,
 *   donc compatible avec la redirection 303 actuelle (pas de fetch côté JS).
 */
import { useEffect, useId, useRef, useState } from 'react';

type ProviderKind =
  | 'openai'
  | 'anthropic'
  | 'mistral'
  | 'gemini'
  | 'qwen'
  | 'deepseek'
  | 'zhipu'
  | 'azure-openai'
  | 'ollama';

type Role = 'chat' | 'embedding' | 'moderation' | 'rerank';

type ModelEntry = { id: string; role?: 'chat' | 'embedding' };
type FetchSource = 'fetch' | 'fallback' | 'idle' | 'loading' | 'error';

const KIND_OPTIONS: Array<{ value: ProviderKind; label: string }> = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'qwen', label: 'Qwen' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'zhipu', label: 'Zhipu' },
  { value: 'azure-openai', label: 'Azure OpenAI' },
  { value: 'ollama', label: 'Ollama (self-hosted)' },
];

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: 'chat', label: 'chat (génération)' },
  { value: 'embedding', label: 'embedding (RAG)' },
  { value: 'moderation', label: 'moderation' },
  { value: 'rerank', label: 'rerank' },
];

const DEFAULT_LABELS: Partial<Record<ProviderKind, string>> = {
  openai: 'OpenAI · GPT-4o mini',
  anthropic: 'Anthropic · Claude 3.5 Sonnet',
  mistral: 'Mistral · large',
  gemini: 'Google · Gemini 2.0 Flash',
  deepseek: 'DeepSeek · chat',
  qwen: 'Qwen · max',
  zhipu: 'Zhipu · GLM-4',
  'azure-openai': 'Azure OpenAI',
  ollama: 'Ollama (local)',
};

export function ProviderForm({ chatEnabled }: { chatEnabled: boolean }) {
  const [kind, setKind] = useState<ProviderKind>('openai');
  const [role, setRole] = useState<Role>('chat');
  const [apiKey, setApiKey] = useState('');
  const [apiBase, setApiBase] = useState('');
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [source, setSource] = useState<FetchSource>('idle');
  const [chatModel, setChatModel] = useState('');
  const [embeddingModel, setEmbeddingModel] = useState('');

  const chatListId = useId();
  const embedListId = useId();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  // Charge les modèles dès qu'on change kind ou (apiKey | apiBase) avec debounce.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const myReqId = ++reqIdRef.current;
      setSource('loading');
      try {
        const res = await fetch('/api/admin/chat/providers/models', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind,
            apiKey: apiKey || undefined,
            apiBase: apiBase || undefined,
          }),
        });
        if (myReqId !== reqIdRef.current) return; // requête obsolète
        if (!res.ok) {
          setSource('error');
          setModels([]);
          return;
        }
        const json = (await res.json()) as { models: ModelEntry[]; source: 'fetch' | 'fallback' };
        if (myReqId !== reqIdRef.current) return;
        setModels(json.models ?? []);
        setSource(json.source);
      } catch {
        if (myReqId !== reqIdRef.current) return;
        setSource('error');
        setModels([]);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [kind, apiKey, apiBase]);

  const chatModels = models.filter((m) => m.role !== 'embedding');
  const embedModels = models.filter((m) => m.role === 'embedding');

  // Defaults par kind quand on bascule.
  useEffect(() => {
    if (!chatModel && chatModels[0]) setChatModel(chatModels[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const sourceBadge = (() => {
    if (source === 'loading') return { label: 'fetching…', cls: 'bg-stone-100 text-stone-600' };
    if (source === 'fetch') return { label: 'liste live', cls: 'bg-emerald-100 text-emerald-700' };
    if (source === 'fallback') return { label: 'liste statique', cls: 'bg-amber-100 text-amber-700' };
    if (source === 'error') return { label: 'fetch error', cls: 'bg-rose-100 text-rose-700' };
    return null;
  })();

  return (
    <form
      action="/api/admin/chat/providers"
      method="POST"
      className="space-y-5 rounded-md border border-stone-200 bg-white p-6"
    >
      {!chatEnabled && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <code>CHAT_ENABLED</code> est désactivé. La création est possible mais
          le module restera inactif tant que l'env n'est pas à <code>true</code>.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Provider" htmlFor="kind">
          <select
            id="kind"
            name="kind"
            value={kind}
            onChange={(e) => {
              const next = e.target.value as ProviderKind;
              setKind(next);
              setChatModel('');
              setEmbeddingModel('');
            }}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            required
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Rôle" htmlFor="role">
          <select
            id="role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            required
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Label affiché" htmlFor="label">
          <input
            id="label"
            name="label"
            type="text"
            defaultValue={DEFAULT_LABELS[kind] ?? ''}
            key={kind}
            minLength={2}
            maxLength={80}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            required
          />
        </Field>

        <Field label="Priorité (1 = essayé en premier)" htmlFor="priority">
          <input
            id="priority"
            name="priority"
            type="number"
            defaultValue={100}
            min={1}
            max={1000}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            required
          />
        </Field>

        <Field
          label={
            <span className="flex items-center gap-2">
              Modèle chat
              {sourceBadge && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${sourceBadge.cls}`}>
                  {sourceBadge.label}
                </span>
              )}
            </span>
          }
          htmlFor="chatModel"
        >
          <input
            id="chatModel"
            name="chatModel"
            type="text"
            list={chatListId}
            value={chatModel}
            onChange={(e) => setChatModel(e.target.value)}
            placeholder="gpt-4o-mini, claude-3-5-sonnet…"
            autoComplete="off"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm font-mono"
          />
          <datalist id={chatListId}>
            {chatModels.map((m) => (
              <option key={m.id} value={m.id} />
            ))}
          </datalist>
          <p className="mt-1 text-xs text-stone-500">
            {chatModels.length > 0
              ? `${chatModels.length} modèles suggérés (cliquer pour ouvrir la liste).`
              : 'Saisir une clé API pour charger la liste live.'}
          </p>
        </Field>

        <Field label="Modèle embedding (si rôle embedding)" htmlFor="embeddingModel">
          <input
            id="embeddingModel"
            name="embeddingModel"
            type="text"
            list={embedListId}
            value={embeddingModel}
            onChange={(e) => setEmbeddingModel(e.target.value)}
            placeholder="text-embedding-3-small"
            autoComplete="off"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm font-mono"
          />
          <datalist id={embedListId}>
            {embedModels.map((m) => (
              <option key={m.id} value={m.id} />
            ))}
          </datalist>
        </Field>

        <Field label="Quota mensuel (€)" htmlFor="quotaMonthlyEur">
          <input
            id="quotaMonthlyEur"
            name="quotaMonthlyEur"
            type="number"
            step="0.01"
            min={0}
            placeholder="20"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Base API (optionnel, ex. Azure)" htmlFor="apiBase">
          <input
            id="apiBase"
            name="apiBase"
            type="url"
            value={apiBase}
            onChange={(e) => setApiBase(e.target.value)}
            placeholder={
              kind === 'ollama' ? 'http://localhost:11434' : 'https://api.openai.com/v1'
            }
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm font-mono"
          />
        </Field>
      </div>

      <Field label="Clé API" htmlFor="apiKey">
        <input
          id="apiKey"
          name="apiKey"
          type="password"
          autoComplete="new-password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm font-mono"
        />
        <p className="mt-1 text-xs text-stone-500">
          Stockée chiffrée AES-256-GCM. Laisser vide pour Ollama. La clé sert
          aussi à charger la liste live des modèles.
        </p>
      </Field>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            name="enabled"
            value="true"
            defaultChecked
            className="rounded border-stone-300"
          />
          Activé
        </label>
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            name="egressAllowed"
            value="true"
            className="rounded border-stone-300"
          />
          Egress externe autorisé (sinon : provider local uniquement)
        </label>
      </div>

      <div className="flex items-center gap-3 border-t border-stone-200 pt-4">
        <button
          type="submit"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Créer le provider
        </button>
        <a
          href="/admin/chat/providers"
          className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
        >
          Annuler
        </a>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: React.ReactNode;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-stone-700">
        {label}
      </label>
      {children}
    </div>
  );
}
