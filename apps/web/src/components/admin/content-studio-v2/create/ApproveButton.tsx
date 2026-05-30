'use client';

import { CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/admin/content-studio-v2/primitives';
import type { ContentDraft, ContentPost } from '@/lib/content-studio/types';
import { formatError } from '@/lib/content-studio-v2/errors/messages';

/**
 * CS v2 create-audit Phase 5 — explicit "Valider et préparer la publication"
 * action. Calls POST /api/admin/content-studio/drafts/:id/approve which
 * creates the `content_post` row that PublishActionGroup needs to unlock.
 *
 * Without this button, the only way to obtain a `postId` is a direct DB
 * write — i.e. the publish dropdown stays disabled forever. This is the
 * keystone of the audit gap G01.
 */

interface ApproveButtonProps {
  draft: ContentDraft | null;
  /** True when a primary media asset is bound to the draft. */
  hasMedia: boolean;
  /** True when brand_review returned at least one blocked violation. */
  brandBlocked?: boolean;
  /** Called with the created post on a successful approve. */
  onApproved: (post: ContentPost) => void;
}

export function ApproveButton({
  draft,
  hasMedia,
  brandBlocked = false,
  onApproved,
}: ApproveButtonProps) {
  const [submitting, setSubmitting] = useState(false);

  const captionEmpty = !draft?.caption?.trim();
  const alreadyApproved =
    !!draft && ['approved', 'scheduled', 'published', 'measured'].includes(draft.status);

  const disabled =
    !draft || !hasMedia || captionEmpty || brandBlocked || alreadyApproved || submitting;

  const disabledReason = !draft
    ? 'Sélectionnez une variante'
    : !hasMedia
      ? 'Attachez un visuel'
      : captionEmpty
        ? 'Ajoutez une caption'
        : brandBlocked
          ? 'Brand review bloque la publication'
          : alreadyApproved
            ? 'Déjà validé'
            : undefined;

  async function handleClick() {
    if (!draft) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/content-studio/drafts/${draft.id}/approve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      const json = (await res.json().catch(() => null)) as {
        post?: ContentPost;
        error?: { code?: string; message?: string };
      } | null;
      if (!res.ok || !json?.post) {
        // Surface the structured error envelope so formatError can map known
        // codes (no_media_attached, brand_review_blocked, …) to readable text.
        throw json?.error ?? new Error(`HTTP ${res.status}`);
      }
      onApproved(json.post);
      toast.success('Draft validé, prêt à publier.');
    } catch (err) {
      toast.error(`Validation : ${formatError(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Button
      type="button"
      variant="primary"
      size="md"
      disabled={disabled}
      loading={submitting}
      leftIcon={<CheckCircle size={16} />}
      onClick={handleClick}
      title={disabled ? disabledReason : undefined}
      aria-disabled={disabled ? 'true' : undefined}
      data-testid="approve-draft-button"
    >
      Valider et préparer la publication
    </Button>
  );
}
