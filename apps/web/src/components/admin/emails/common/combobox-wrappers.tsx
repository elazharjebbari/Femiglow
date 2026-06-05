'use client';

/**
 * Wrappers fins autour de `EntityCombobox`, chacun figeant `fetchSuggestions`
 * sur une route d'autocomplétion. Les chantiers surface (cockpit, wizard
 * campagne, templates, automations) importent ces wrappers en lecture seule.
 *
 * Toutes les routes renvoient une enveloppe JSON propre ; chaque `fetch`
 * transmet le `signal` d'AbortController (annulation du debounce → annulation
 * réseau) et `credentials: 'include'` (cookie de session admin).
 */
import { EntityCombobox, type ComboboxOption } from './EntityCombobox';

type WrapperProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  minChars?: number;
  allowFreeText?: boolean;
};

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { credentials: 'include', signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

function encode(q: string): string {
  return encodeURIComponent(q);
}

// ── TemplateCombobox — /api/admin/emails/templates/autocomplete ──────────────
// Route existante : renvoie TOUS les templates (système + custom) sans filtre
// serveur. On filtre côté client par slug/nom et on plafonne à 20.
export function TemplateCombobox(props: WrapperProps) {
  return (
    <EntityCombobox
      {...stripProps(props)}
      ariaLabel={props.ariaLabel ?? 'Template'}
      placeholder={props.placeholder ?? 'welcome'}
      fetchSuggestions={async (q, signal) => {
        const data = await getJson<{
          templates: Array<{ slug: string; name: string; source: string }>;
        }>('/api/admin/emails/templates/autocomplete', signal);
        const needle = q.toLowerCase();
        return data.templates
          .filter(
            (t) =>
              t.slug.toLowerCase().includes(needle) ||
              t.name.toLowerCase().includes(needle),
          )
          .slice(0, 20)
          .map<ComboboxOption>((t) => ({
            value: t.slug,
            label: t.slug,
            hint: t.source === 'system' ? 'système' : 'custom',
          }));
      }}
    />
  );
}

// ── TagCombobox — /api/admin/leads/tags/autocomplete ─────────────────────────
export function TagCombobox(props: WrapperProps) {
  return (
    <EntityCombobox
      {...stripProps(props)}
      ariaLabel={props.ariaLabel ?? 'Tag'}
      placeholder={props.placeholder ?? 'vip'}
      fetchSuggestions={async (q, signal) => {
        const data = await getJson<{ tags: Array<{ tag: string; count: number }> }>(
          '/api/admin/leads/tags/autocomplete',
          signal,
        );
        const needle = q.toLowerCase();
        return data.tags
          .filter((t) => t.tag.toLowerCase().includes(needle))
          .slice(0, 20)
          .map<ComboboxOption>((t) => ({
            value: t.tag,
            label: t.tag,
            hint: `${t.count} contact${t.count > 1 ? 's' : ''}`,
          }));
      }}
    />
  );
}

// ── RecipientCombobox — /api/admin/emails/transactional/recipients-autocomplete
export function RecipientCombobox(props: WrapperProps) {
  return (
    <EntityCombobox
      {...stripProps(props)}
      ariaLabel={props.ariaLabel ?? 'Destinataire'}
      placeholder={props.placeholder ?? 'client@exemple.test'}
      fetchSuggestions={async (q, signal) => {
        const data = await getJson<{ recipients: string[] }>(
          `/api/admin/emails/transactional/recipients-autocomplete?q=${encode(q)}`,
          signal,
        );
        return data.recipients.map<ComboboxOption>((email) => ({
          value: email,
          label: email,
        }));
      }}
    />
  );
}

// ── SourceCombobox — /api/admin/emails/transactional/sources ─────────────────
export function SourceCombobox(props: WrapperProps) {
  return (
    <EntityCombobox
      {...stripProps(props)}
      ariaLabel={props.ariaLabel ?? 'Source'}
      placeholder={props.placeholder ?? 'api.contact'}
      fetchSuggestions={async (q, signal) => {
        const data = await getJson<{ sources: string[] }>(
          `/api/admin/emails/transactional/sources?q=${encode(q)}`,
          signal,
        );
        return data.sources.map<ComboboxOption>((s) => ({ value: s, label: s }));
      }}
    />
  );
}

// ── LeadEmailCombobox — /api/admin/emails/leads/autocomplete ─────────────────
export function LeadEmailCombobox(props: WrapperProps) {
  return (
    <EntityCombobox
      {...stripProps(props)}
      ariaLabel={props.ariaLabel ?? 'Lead'}
      placeholder={props.placeholder ?? 'lead@exemple.test'}
      fetchSuggestions={async (q, signal) => {
        const data = await getJson<{
          leads: Array<{ email: string; name: string | null }>;
        }>(`/api/admin/emails/leads/autocomplete?q=${encode(q)}`, signal);
        return data.leads.map<ComboboxOption>((l) => ({
          value: l.email,
          label: l.email,
          hint: l.name ?? undefined,
        }));
      }}
    />
  );
}

/** Retire `ariaLabel`/`placeholder` (gérés par chaque wrapper avec un défaut). */
function stripProps(props: WrapperProps) {
  const { ariaLabel: _a, placeholder: _p, ...rest } = props;
  void _a;
  void _p;
  return rest;
}
