'use client';

import { useState } from 'react';
import * as RadixDropdown from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Calendar, Send, ClipboardSignature } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Dialog } from '@/components/admin/content-studio-v2/primitives';
import { AutosaveIndicator } from './CaptionEditor';
import type { AutosaveStatus } from '@/lib/content-studio-v2/state/StudioContext';

interface PublishActionGroupProps {
  /** ID of the post derived from the current draft. May be null while not approved yet. */
  postId: string | null;
  /** Autosave state from `useDraftAutosave` — passed in instead of recomputed
   * so this component does not need its own context wiring. */
  autosave: {
    status: AutosaveStatus;
    isDirty: boolean;
    lastSavedAt: number | null;
    error: string | null;
    flush: () => Promise<void>;
  };
  /** Disable all publish actions (e.g. brand violations blocked). */
  disabled?: boolean;
  /** Notified after a publish API call succeeds so the parent can reload. */
  onPublished?: (mode: 'now' | 'schedule' | 'draft') => void;
}

type ConfirmMode = 'now' | 'schedule' | 'draft' | null;

export function PublishActionGroup({
  postId,
  autosave,
  disabled,
  onPublished,
}: PublishActionGroupProps) {
  const [mode, setMode] = useState<ConfirmMode>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string>(() => defaultScheduledAt());

  const canPublish = Boolean(postId) && !disabled;

  async function executePublish(target: 'now' | 'schedule' | 'draft') {
    if (!postId) return;
    await autosave.flush();
    setSubmitting(true);
    try {
      const url = endpointFor(target, postId);
      const body =
        target === 'schedule'
          ? JSON.stringify({ scheduledAt: new Date(scheduledAt).toISOString() })
          : JSON.stringify({});
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      }
      toast.success(
        target === 'now'
          ? 'Publication lancée'
          : target === 'schedule'
            ? 'Publication programmée'
            : 'Brouillon envoyé au provider',
      );
      onPublished?.(target);
      setMode(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur publication';
      toast.error(`Publication : ${message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <footer
      aria-label="Publier"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '14px 18px',
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius-md)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <AutosaveIndicator
          status={autosave.status}
          isDirty={autosave.isDirty}
          lastSavedAt={autosave.lastSavedAt}
          error={autosave.error}
        />
        {!postId ? (
          <span style={{ fontSize: 12, color: 'var(--cs-fg-muted)' }}>
            Approuvez le draft pour activer la publication.
          </span>
        ) : null}
      </div>

      <RadixDropdown.Root>
        <RadixDropdown.Trigger asChild>
          <Button
            type="button"
            disabled={!canPublish}
            rightIcon={<ChevronDown size={14} />}
            aria-label="Options de publication"
          >
            Publier
          </Button>
        </RadixDropdown.Trigger>
        <RadixDropdown.Portal>
          <RadixDropdown.Content
            align="end"
            sideOffset={6}
            style={{
              minWidth: 240,
              background: 'var(--cs-bg-elevated)',
              border: '1px solid var(--cs-border)',
              borderRadius: 'var(--cs-radius-md)',
              boxShadow: 'var(--cs-shadow-md)',
              padding: 6,
              zIndex: 50,
            }}
          >
            <PublishOption
              icon={<Send size={14} />}
              label="Publier maintenant"
              description="Envoie immédiatement au provider."
              onSelect={() => setMode('now')}
            />
            <PublishOption
              icon={<Calendar size={14} />}
              label="Programmer"
              description="Choisir une date / heure."
              onSelect={() => setMode('schedule')}
            />
            <PublishOption
              icon={<ClipboardSignature size={14} />}
              label="Brouillon Postiz"
              description="Envoie au provider en mode review."
              onSelect={() => setMode('draft')}
            />
          </RadixDropdown.Content>
        </RadixDropdown.Portal>
      </RadixDropdown.Root>

      <Dialog
        open={mode === 'now'}
        onOpenChange={(open) => !open && setMode(null)}
        title="Publier maintenant ?"
        description="Le post sera envoyé immédiatement au provider configuré."
        footer={
          <>
            <Button variant="ghost" type="button" onClick={() => setMode(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              loading={submitting}
              onClick={() => {
                void executePublish('now');
              }}
            >
              Confirmer
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, color: 'var(--cs-fg-secondary)', fontSize: 'var(--cs-text-sm)' }}>
          Vérifie l&apos;aperçu une dernière fois. Cette action ne peut pas être annulée une fois le
          contenu publié côté plateforme.
        </p>
      </Dialog>

      <Dialog
        open={mode === 'schedule'}
        onOpenChange={(open) => !open && setMode(null)}
        title="Programmer la publication"
        description="Choisis la date et l'heure de publication."
        footer={
          <>
            <Button variant="ghost" type="button" onClick={() => setMode(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              loading={submitting}
              onClick={() => {
                void executePublish('schedule');
              }}
            >
              Programmer
            </Button>
          </>
        }
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--cs-fg-secondary)' }}>Date et heure</span>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
            min={defaultScheduledAt()}
            style={{
              padding: '10px 12px',
              background: 'var(--cs-bg-base)',
              border: '1px solid var(--cs-border)',
              borderRadius: 'var(--cs-radius-sm)',
              color: 'var(--cs-fg-primary)',
              fontFamily: 'var(--cs-font-body)',
              fontSize: 'var(--cs-text-sm)',
            }}
          />
        </label>
      </Dialog>

      <Dialog
        open={mode === 'draft'}
        onOpenChange={(open) => !open && setMode(null)}
        title="Envoyer en brouillon ?"
        description="Le contenu sera disponible côté provider pour validation interne."
        footer={
          <>
            <Button variant="ghost" type="button" onClick={() => setMode(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              loading={submitting}
              onClick={() => {
                void executePublish('draft');
              }}
            >
              Envoyer
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, color: 'var(--cs-fg-secondary)', fontSize: 'var(--cs-text-sm)' }}>
          Le draft sera créé côté provider, prêt à être publié manuellement.
        </p>
      </Dialog>
    </footer>
  );
}

function PublishOption({
  icon,
  label,
  description,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <RadixDropdown.Item
      onSelect={(event) => {
        // Prevent Radix from auto-closing before we open the dialog.
        event.preventDefault();
        onSelect();
      }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 'var(--cs-radius-sm)',
        cursor: 'pointer',
        outline: 'none',
      }}
      className="cs-dropdown-item"
    >
      <span
        style={{
          color: 'var(--cs-accent)',
          marginTop: 2,
          display: 'inline-flex',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--cs-text-sm)',
            fontWeight: 500,
            color: 'var(--cs-fg-primary)',
          }}
        >
          {label}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--cs-fg-muted)' }}>
          {description}
        </p>
      </div>
    </RadixDropdown.Item>
  );
}

function endpointFor(target: 'now' | 'schedule' | 'draft', postId: string): string {
  switch (target) {
    case 'now':
      return `/api/admin/content-studio/posts/${postId}/publish-now`;
    case 'schedule':
      return `/api/admin/content-studio/posts/${postId}/schedule`;
    case 'draft':
      return `/api/admin/content-studio/posts/${postId}/draft-on-provider`;
  }
}

function defaultScheduledAt(): string {
  // 1h from now, rounded to next 5min — formatted for <input type="datetime-local">.
  const target = new Date(Date.now() + 60 * 60 * 1000);
  target.setMinutes(Math.ceil(target.getMinutes() / 5) * 5, 0, 0);
  return toLocalISO(target);
}

function toLocalISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
