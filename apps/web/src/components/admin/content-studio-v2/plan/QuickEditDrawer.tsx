'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ContentDraft, ContentPost } from '@/lib/content-studio/types';
import { Badge, Button, Input } from '../primitives';

interface QuickEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: ContentPost | null;
  draft: ContentDraft | undefined;
  /** Endpoint used to persist `scheduledAt`. Overridable in tests. */
  endpoint?: (postId: string) => string;
  fetcher?: typeof fetch;
  onUpdated?: (post: ContentPost) => void;
}

function toLocalInput(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function QuickEditDrawer({
  open,
  onOpenChange,
  post,
  draft,
  endpoint = (id) => `/api/admin/content-studio/posts/${id}/reschedule`,
  fetcher = typeof fetch === 'function' ? fetch.bind(globalThis) : undefined,
  onUpdated,
}: QuickEditDrawerProps) {
  const [scheduleInput, setScheduleInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setScheduleInput(toLocalInput(post?.scheduledAt ?? null));
  }, [post?.id, post?.scheduledAt]);

  async function handleSaveSchedule() {
    if (!post || !scheduleInput || !fetcher) return;
    const next = new Date(scheduleInput);
    if (Number.isNaN(next.getTime())) {
      toast.error('Date invalide.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetcher(endpoint(post.id), {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scheduledAt: next.toISOString() }),
      });
      if (!res.ok) throw new Error(`http_${res.status}`);
      const json = (await res.json().catch(() => null)) as { post?: ContentPost } | null;
      toast.success('Horaire mis à jour.');
      if (json?.post) onUpdated?.(json.post);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--cs-bg-overlay)',
            zIndex: 'var(--cs-z-modal)' as unknown as number,
          }}
        />
        <RadixDialog.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: 'min(420px, 95vw)',
            background: 'var(--cs-bg-elevated)',
            color: 'var(--cs-fg-primary)',
            borderLeft: '1px solid var(--cs-border)',
            boxShadow: 'var(--cs-shadow-lg)',
            zIndex: 'var(--cs-z-modal)' as unknown as number,
            display: 'flex',
            flexDirection: 'column',
          }}
          data-testid="quick-edit-drawer"
        >
          <header
            style={{
              padding: '18px 20px 14px',
              borderBottom: '1px solid var(--cs-border-hair)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <RadixDialog.Title
                style={{
                  fontFamily: 'var(--cs-font-display)',
                  fontSize: 'var(--cs-text-lg)',
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                Édition rapide
              </RadixDialog.Title>
              {draft ? (
                <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Badge tone="neutral" size="sm">
                    {draft.platform}
                  </Badge>
                  <Badge tone="neutral" size="sm">
                    {draft.format}
                  </Badge>
                  {post ? (
                    <Badge tone="accent" size="sm">
                      {post.status}
                    </Badge>
                  ) : null}
                </div>
              ) : null}
            </div>
            <RadixDialog.Close asChild>
              <button
                type="button"
                aria-label="Fermer"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 'var(--cs-radius-full)',
                  background: 'transparent',
                  color: 'var(--cs-fg-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <X size={16} />
              </button>
            </RadixDialog.Close>
          </header>

          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {draft ? (
              <section>
                <h3
                  style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--cs-fg-secondary)',
                    margin: '0 0 6px',
                  }}
                >
                  Caption
                </h3>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5 }}>
                  {draft.caption}
                </p>
                {draft.hashtags.length > 0 ? (
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--cs-fg-secondary)' }}>
                    {draft.hashtags.join(' ')}
                  </p>
                ) : null}
              </section>
            ) : null}

            <section>
              <label
                htmlFor="quick-edit-schedule"
                style={{
                  display: 'block',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--cs-fg-secondary)',
                  marginBottom: 6,
                }}
              >
                Horaire
              </label>
              <Input
                id="quick-edit-schedule"
                type="datetime-local"
                value={scheduleInput}
                onChange={(e) => setScheduleInput(e.target.value)}
                data-testid="quick-edit-schedule-input"
              />
            </section>
          </div>

          <footer
            style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--cs-border-hair)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            {draft ? (
              <Link
                href={`/admin/content-studio-v2/create/${draft.id}`}
                style={{ textDecoration: 'none' }}
              >
                <Button variant="ghost" size="sm" rightIcon={<ExternalLink size={14} />}>
                  Ouvrir en édition complète
                </Button>
              </Link>
            ) : (
              <span />
            )}
            <Button
              size="sm"
              loading={saving}
              onClick={handleSaveSchedule}
              disabled={!post || !scheduleInput}
              data-testid="quick-edit-save"
            >
              Enregistrer l’horaire
            </Button>
          </footer>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
