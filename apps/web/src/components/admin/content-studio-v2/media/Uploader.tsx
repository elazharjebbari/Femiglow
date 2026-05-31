'use client';

import { useRef, useState } from 'react';
import { Upload, FileImage, FileVideo, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Dialog } from '../primitives';
import { ImageCropper } from './ImageCropper';
import type { ImageCropperResult } from './ImageCropper';
import { VideoTrimmer } from './VideoTrimmer';
import type { VideoTrimResult } from './VideoTrimmer';
import type { StudioV2MediaItem } from '@/lib/content-studio-v2/media/types';

interface Props {
  /** Default crop aspect ratio for images. */
  defaultRatio?: '1:1' | '4:5' | '9:16' | '16:9' | 'free';
  /** Called after the upload (and optional crop/trim) succeeds. */
  onUploaded: (media: StudioV2MediaItem) => void;
  /** Render-prop for the trigger button so the parent can style it. */
  trigger?: React.ReactNode;
}

type Stage =
  | { kind: 'idle' }
  | { kind: 'cropping'; file: File; previewUrl: string }
  | { kind: 'trimming'; file: File; previewUrl: string }
  | { kind: 'uploading'; file: File }
  | { kind: 'error'; message: string };

const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm';

export function Uploader({ defaultRatio = '4:5', onUploaded, trigger }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });

  function reset() {
    if (stage.kind === 'cropping' || stage.kind === 'trimming') {
      URL.revokeObjectURL(stage.previewUrl);
    }
    setStage({ kind: 'idle' });
  }

  function handleFile(file: File) {
    if (file.type.startsWith('image/')) {
      const previewUrl = URL.createObjectURL(file);
      setStage({ kind: 'cropping', file, previewUrl });
    } else if (file.type.startsWith('video/')) {
      const previewUrl = URL.createObjectURL(file);
      setStage({ kind: 'trimming', file, previewUrl });
    } else {
      setStage({ kind: 'error', message: `Type non supporté : ${file.type}` });
    }
  }

  async function confirmCrop(crop: ImageCropperResult) {
    if (stage.kind !== 'cropping') return;
    const file = stage.file;
    URL.revokeObjectURL(stage.previewUrl);
    setStage({ kind: 'uploading', file });
    const form = new FormData();
    form.append('file', file);
    form.append(
      'crop',
      JSON.stringify({
        x: crop.cropX,
        y: crop.cropY,
        width: crop.cropWidth,
        height: crop.cropHeight,
        rotation: crop.rotation,
        aspectRatio: crop.aspectRatio,
        alt: file.name.replace(/\.[^.]+$/, ''),
      }),
    );
    try {
      const res = await fetch('/api/admin/content-studio-v2/media/upload-and-crop', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const { media } = (await res.json()) as { media: StudioV2MediaItem };
      onUploaded(media);
      toast.success('Image importée avec succès');
      reset();
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Échec de l\'upload';
      setStage({ kind: 'error', message });
      toast.error(message);
    }
  }

  async function confirmTrim(trim: VideoTrimResult) {
    if (stage.kind !== 'trimming') return;
    const file = stage.file;
    URL.revokeObjectURL(stage.previewUrl);
    setStage({ kind: 'uploading', file });
    const form = new FormData();
    form.append('file', file);
    form.append(
      'trim',
      JSON.stringify({
        startSec: trim.startSec,
        endSec: trim.endSec,
        alt: file.name.replace(/\.[^.]+$/, ''),
      }),
    );
    try {
      const res = await fetch('/api/admin/content-studio-v2/media/upload-and-trim', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const { media } = (await res.json()) as { media: StudioV2MediaItem };
      onUploaded(media);
      toast.success('Vidéo importée avec succès');
      reset();
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Échec de l\'upload';
      setStage({ kind: 'error', message });
      toast.error(message);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
      trigger={trigger ?? <Button leftIcon={<Upload size={14} />}>Importer un média</Button>}
      title="Importer un média"
      description="Image (JPG / PNG / WebP, max 25 Mo) ou vidéo (MP4 / MOV / WebM, max 200 Mo, 90s)."
      size="lg"
    >
      {stage.kind === 'idle' ? (
        <div
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          onDragOver={(e) => e.preventDefault()}
          style={{
            border: '2px dashed var(--cs-border-strong)',
            borderRadius: 'var(--cs-radius-md)',
            padding: 48,
            textAlign: 'center',
            background: 'var(--cs-bg-sunken)',
            cursor: 'pointer',
          }}
          onClick={() => inputRef.current?.click()}
        >
          <div style={{ display: 'inline-flex', gap: 24, alignItems: 'center', marginBottom: 16 }}>
            <FileImage size={32} style={{ color: 'var(--cs-accent)' }} />
            <FileVideo size={32} style={{ color: 'var(--cs-clay)' }} />
          </div>
          <p style={{ fontFamily: 'var(--cs-font-display)', fontSize: 'var(--cs-text-lg)', color: 'var(--cs-fg-primary)' }}>
            Glissez un fichier ici
          </p>
          <p style={{ color: 'var(--cs-fg-secondary)', fontSize: 'var(--cs-text-sm)', marginTop: 4 }}>
            ou cliquez pour parcourir
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
        </div>
      ) : stage.kind === 'cropping' ? (
        <ImageCropper src={stage.previewUrl} defaultRatio={defaultRatio} onConfirm={confirmCrop} onCancel={reset} />
      ) : stage.kind === 'trimming' ? (
        <VideoTrimmer src={stage.previewUrl} onConfirm={confirmTrim} onCancel={reset} />
      ) : stage.kind === 'uploading' ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <div className="cs-spinner" style={{ width: 28, height: 28, margin: '0 auto 14px', borderRadius: '50%', border: '3px solid var(--cs-accent)', borderTopColor: 'transparent', animation: 'cs-spin 0.7s linear infinite' }} />
          <p style={{ color: 'var(--cs-fg-secondary)', fontSize: 'var(--cs-text-sm)' }}>
            Traitement de <strong>{stage.file.name}</strong>…
          </p>
        </div>
      ) : stage.kind === 'error' ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--cs-danger)' }}>
          <X size={28} style={{ marginBottom: 8 }} />
          <p style={{ fontFamily: 'var(--cs-font-display)' }}>Erreur</p>
          <p style={{ marginTop: 6, fontSize: 'var(--cs-text-sm)' }}>{stage.message}</p>
          <Button variant="ghost" onClick={reset} style={{ marginTop: 14 }}>Réessayer</Button>
        </div>
      ) : null}
    </Dialog>
  );
}
