'use client';

import { useState } from 'react';
import * as RadixDropdown from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Calendar, Send, ClipboardSignature, Film, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Dialog } from '@/components/admin/content-studio-v2/primitives';
import { AutosaveIndicator } from './CaptionEditor';
import { MockModeBadge } from './MockModeBadge';
import { formatError } from '@/lib/content-studio-v2/errors/messages';
import { VideoPlayer, formatDuration } from '@/components/admin/content-studio-v2/media/VideoPlayer';
import type { StudioV2MediaItem } from '@/lib/content-studio-v2/media/types';
import type { AutosaveStatus } from '@/lib/content-studio-v2/state/StudioContext';

/** CS v2 Phase 7 G12 — Minimal preview slice surfaced inside the publish
 * confirmation dialogs (thumbnail + truncated caption + platform/format).
 * Optional: when omitted, the dialogs fall back to the pre-G12 minimal text. */
export interface PublishConfirmPreview {
  thumbnailUrl: string | null;
  caption: string;
  platform: string;
  format: string;
  /** Distinction vidéo vs image. Si vidéo, ConfirmPreview rend un mini player. */
  mediaKind?: 'image' | 'video' | null;
  /** URL du média complet (pour rendre le mini player vidéo). */
  mediaPreviewUrl?: string | null;
  /** Alt accessible. */
  mediaAlt?: string | null;
  /** Durée en secondes (vidéo). */
  durationSec?: number | null;
  /** Dimensions du média. */
  width?: number | null;
  height?: number | null;
}

interface PublishActionGroupProps {
  /** ID of the post derived from the current draft. May be null while not approved yet. */
  postId: string | null;
  /** CS v2 Phase 6 — mirrors the global mock-mode flag for inline badging. */
  mockMode?: boolean;
  /** CS v2 Phase 7 G12 — visual recap rendered inside the confirm dialogs. */
  preview?: PublishConfirmPreview | null;
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
  mockMode = false,
  preview,
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
        const json = (await res.json().catch(() => null)) as {
          error?: { code?: string; message?: string };
        } | null;
        // CS v2 Phase 6 — surface the structured error envelope (code+message)
        // so the catch block can map it through formatError().
        throw json?.error ?? new Error(`HTTP ${res.status}`);
      }
      const baseSuccess =
        target === 'now'
          ? 'Publication lancée'
          : target === 'schedule'
            ? 'Publication programmée'
            : 'Brouillon envoyé au provider';
      toast.success(mockMode ? `${baseSuccess} (mock)` : baseSuccess);
      onPublished?.(target);
      setMode(null);
    } catch (err) {
      // CS v2 Phase 6 — map known server codes to friendly messages.
      toast.error(`Publication : ${formatError(err)}`);
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
        {mockMode ? <MockModeBadge /> : null}
        {!postId ? (
          <span style={{ fontSize: 12, color: 'var(--cs-fg-muted)' }}>
            Validez le draft pour activer la publication.
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
        {preview ? <ConfirmPreview preview={preview} mockMode={mockMode} /> : null}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {preview ? <ConfirmPreview preview={preview} mockMode={mockMode} /> : null}
          {/* CS v2 Phase 7 polish — schedule presets */}
          <div
            style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
            aria-label="Raccourcis de programmation"
          >
            <Button
              variant="ghost"
              size="sm"
              type="button"
              data-testid="schedule-preset-1h"
              onClick={() => setScheduledAt(toLocalISO(addHours(new Date(), 1)))}
            >
              +1h
            </Button>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              data-testid="schedule-preset-tomorrow-9"
              onClick={() => setScheduledAt(toLocalISO(tomorrowAt(9)))}
            >
              Demain 9h
            </Button>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              data-testid="schedule-preset-monday-14"
              onClick={() => setScheduledAt(toLocalISO(nextMondayAt(14)))}
            >
              Lundi 14h
            </Button>
          </div>
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
            <span
              data-testid="schedule-timezone-label"
              style={{ fontSize: 11, color: 'var(--cs-fg-muted)' }}
            >
              Fuseau : {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </span>
          </label>
        </div>
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
        {preview ? <ConfirmPreview preview={preview} mockMode={mockMode} /> : null}
        <p style={{ margin: 0, color: 'var(--cs-fg-secondary)', fontSize: 'var(--cs-text-sm)' }}>
          Le draft sera créé côté provider, prêt à être publié manuellement.
        </p>
      </Dialog>
    </footer>
  );
}

/**
 * CS v2 Phase 7 G12 — visual recap rendered inside each publish confirmation
 * dialog. Shows a thumbnail (if any), a truncated caption, plateforme/format
 * tags, and the mock-mode hint when applicable.
 */
function ConfirmPreview({
  preview,
  mockMode,
}: {
  preview: PublishConfirmPreview;
  mockMode: boolean;
}) {
  const truncated =
    preview.caption.length > 140 ? `${preview.caption.slice(0, 140)}…` : preview.caption;
  const isVideo = preview.mediaKind === 'video' && Boolean(preview.mediaPreviewUrl);
  const mediaForPlayer: StudioV2MediaItem | null = isVideo
    ? {
        id: 'confirm-preview',
        kind: 'video',
        compartment: 'ai_generated',
        alt: preview.mediaAlt ?? '',
        slug: 'confirm-preview',
        thumbnailUrl: preview.thumbnailUrl,
        previewUrl: preview.mediaPreviewUrl as string,
        originalUrl: preview.mediaPreviewUrl as string,
        durationSec: preview.durationSec ?? null,
        width: preview.width ?? null,
        height: preview.height ?? null,
        createdAt: new Date().toISOString(),
      }
    : null;
  return (
    <div
      data-testid="publish-confirm-preview"
      style={{
        display: 'flex',
        gap: 12,
        marginBottom: 12,
        padding: 10,
        borderRadius: 'var(--cs-radius-sm)',
        background: 'var(--cs-bg-sunken)',
      }}
    >
      <div
        style={{
          width: 64,
          height: 80,
          borderRadius: 6,
          flexShrink: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {mediaForPlayer ? (
          <VideoPlayer media={mediaForPlayer} fit="cover" controls="none" compact />
        ) : preview.thumbnailUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={preview.thumbnailUrl}
            alt=""
            data-testid="publish-confirm-thumbnail-img"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              width: '100%',
              height: '100%',
              background: 'var(--cs-bg-base)',
              border: '1px dashed var(--cs-border)',
              borderRadius: 6,
            }}
          />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: 'var(--cs-fg-primary)',
            lineHeight: 1.4,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {truncated}
        </p>
        <div
          style={{
            marginTop: 6,
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            fontSize: 11,
            color: 'var(--cs-fg-muted)',
          }}
        >
          <span data-testid="publish-confirm-platform">📱 {preview.platform}</span>
          <span data-testid="publish-confirm-format">· {preview.format}</span>
          {mockMode ? <span style={{ color: 'var(--cs-warning)' }}>· Mode mock</span> : null}
        </div>
        {preview.mediaKind ? (
          <div
            data-testid="publish-confirm-media-meta"
            style={{
              marginTop: 4,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              color: 'var(--cs-fg-secondary)',
              fontFamily: 'var(--cs-font-mono, ui-monospace)',
            }}
          >
            {preview.mediaKind === 'video' ? (
              <Film size={11} aria-hidden style={{ color: 'var(--cs-accent)' }} />
            ) : (
              <ImageIcon size={11} aria-hidden style={{ color: 'var(--cs-accent)' }} />
            )}
            <span style={{ fontWeight: 600 }}>
              {preview.mediaKind === 'video' ? 'Vidéo' : 'Image'}
            </span>
            {preview.mediaKind === 'video' && preview.durationSec ? (
              <>
                <span aria-hidden style={{ opacity: 0.5 }}>·</span>
                <span>{formatDuration(preview.durationSec)}</span>
              </>
            ) : null}
            {preview.width && preview.height ? (
              <>
                <span aria-hidden style={{ opacity: 0.5 }}>·</span>
                <span>
                  {preview.width}×{preview.height}
                </span>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
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

// CS v2 Phase 7 polish — schedule preset helpers.
function addHours(d: Date, hours: number): Date {
  const out = new Date(d);
  out.setHours(out.getHours() + hours);
  out.setMinutes(Math.ceil(out.getMinutes() / 5) * 5, 0, 0);
  return out;
}

function tomorrowAt(hour: number): Date {
  const out = new Date();
  out.setDate(out.getDate() + 1);
  out.setHours(hour, 0, 0, 0);
  return out;
}

function nextMondayAt(hour: number): Date {
  const out = new Date();
  const day = out.getDay(); // 0=dim..6=sam
  const daysUntilMonday = (8 - day) % 7 || 7; // never today, always next Monday
  out.setDate(out.getDate() + daysUntilMonday);
  out.setHours(hour, 0, 0, 0);
  return out;
}
