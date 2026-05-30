'use client';

import { useState } from 'react';
import { Image as ImageIcon, Film, Layers, BookOpen } from 'lucide-react';
import type {
  ContentFormat,
  ContentObjective,
  ContentPillar,
  ContentPlatform,
  ContentIdea,
} from '@/lib/content-studio/types';
import {
  CONTENT_FORMATS,
  CONTENT_OBJECTIVES,
  CONTENT_PILLARS,
  CONTENT_PLATFORMS,
} from '@/lib/content-studio/types';
import { contentIdeaCreateSchema } from '@/lib/content-studio/schemas';
import { Button } from '@/components/admin/content-studio-v2/primitives';
import { ModelPicker } from './ModelPicker';

type FormatMeta = {
  value: ContentFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
  mediaSupport: 'image' | 'video' | 'both';
};

// `mediaSupport` indique quel(s) type(s) de média (image, vidéo) le format
// supporte côté génération. Reflète le contenu de MOCK_ASSETS dans
// `src/lib/content-studio/video-generation.ts` (seuls reel/story sont
// vidéo-capables).
const FORMAT_META: Record<ContentFormat, FormatMeta> = {
  post: {
    value: 'post',
    label: 'Post',
    description: 'Image carrée ou 4:5 — flux principal',
    icon: <ImageIcon size={18} />,
    mediaSupport: 'image',
  },
  story: {
    value: 'story',
    label: 'Story',
    description: '9:16 vertical — 24h',
    icon: <BookOpen size={18} />,
    mediaSupport: 'both',
  },
  reel: {
    value: 'reel',
    label: 'Reel',
    description: 'Vidéo 9:16 — viralité',
    icon: <Film size={18} />,
    mediaSupport: 'video',
  },
  carousel: {
    value: 'carousel',
    label: 'Carousel',
    description: 'Plusieurs images — éducatif',
    icon: <Layers size={18} />,
    mediaSupport: 'image',
  },
};

const MEDIA_SUPPORT_LABEL: Record<'image' | 'video' | 'both', string> = {
  image: 'Image',
  video: 'Vidéo',
  both: 'Image + Vidéo',
};

const PILLAR_LABEL: Record<ContentPillar, string> = {
  rituel: 'Rituel',
  produit: 'Produit',
  preuve: 'Preuve',
  journal: 'Journal',
  maison: 'Maison',
  reassurance: 'Réassurance',
  saison: 'Saison',
  coulisses: 'Coulisses',
};

const OBJECTIVE_LABEL: Record<ContentObjective, string> = {
  notoriete: 'Notoriété',
  consideration: 'Considération',
  conversion: 'Conversion',
  reassurance: 'Réassurance',
  fidelisation: 'Fidélisation',
};

const PLATFORM_LABEL: Record<ContentPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
};

interface IntentionFormProps {
  defaultValues?: {
    pillar?: ContentPillar;
    objective?: ContentObjective;
    platform?: ContentPlatform;
    format?: ContentFormat;
    prompt?: string;
    /** CS v2 Phase 2 — pre-select a text model id (otherwise picker uses suggestion). */
    model?: string;
  };
  /**
   * Called once an idea has been created via POST /ideas.
   * `model` is the text-generation model id picked in the ModelPicker; the
   * parent should forward it to POST /ideas/:id/generate.
   */
  onCreated?: (idea: ContentIdea, model?: string) => void;
  /** Called when the user picks a new format (synchronises preview pane). */
  onFormatChange?: (format: ContentFormat) => void;
  disabled?: boolean;
}

export function IntentionForm({
  defaultValues,
  onCreated,
  onFormatChange,
  disabled,
}: IntentionFormProps) {
  const [pillar, setPillar] = useState<ContentPillar>(defaultValues?.pillar ?? 'rituel');
  const [objective, setObjective] = useState<ContentObjective>(
    defaultValues?.objective ?? 'consideration',
  );
  const [platform, setPlatform] = useState<ContentPlatform>(
    defaultValues?.platform ?? 'instagram',
  );
  const [format, setFormat] = useState<ContentFormat>(defaultValues?.format ?? 'post');
  const [prompt, setPrompt] = useState(
    defaultValues?.prompt ?? 'Présenter le rituel FemiGlow comme un geste lent du soir',
  );
  // CS v2 Phase 2 — null = use the registry suggestion for the current format.
  const [model, setModel] = useState<string | null>(defaultValues?.model ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  function pickFormat(next: ContentFormat) {
    setFormat(next);
    onFormatChange?.(next);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setServerError(null);
    const parsed = contentIdeaCreateSchema.safeParse({
      campaignId: null,
      pillar,
      objective,
      platform,
      format,
      prompt,
      ...(model ? { model } : {}),
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path.join('.')] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/content-studio/ideas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const json = (await res.json().catch(() => null)) as {
        idea?: ContentIdea;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.idea) {
        throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      }
      onCreated?.(json.idea, model ?? undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inattendue';
      setServerError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="cs-intention"
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: 18,
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius-md)',
      }}
    >
      <div>
        <p className="cs-eyebrow" style={{ fontSize: 11, color: 'var(--cs-fg-muted)' }}>
          Cadrage
        </p>
        <h3
          style={{
            fontFamily: 'var(--cs-font-display)',
            fontSize: 'var(--cs-text-lg)',
            fontWeight: 500,
            color: 'var(--cs-fg-primary)',
            letterSpacing: '-0.01em',
            margin: '4px 0 0',
          }}
        >
          Quelle intention ?
        </h3>
      </div>

      {/* Format — radio cards top-level */}
      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend
          style={{
            fontSize: 11,
            color: 'var(--cs-fg-muted)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Format
        </legend>
        <div
          role="radiogroup"
          aria-label="Format de contenu"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 8,
          }}
        >
          {CONTENT_FORMATS.map((value) => {
            const meta = FORMAT_META[value];
            const active = value === format;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => pickFormat(value)}
                data-format={value}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 6,
                  padding: '10px 12px',
                  background: active ? 'var(--cs-accent-bg)' : 'var(--cs-bg-sunken)',
                  border: active
                    ? '1px solid var(--cs-accent)'
                    : '1px solid var(--cs-border-hair)',
                  borderRadius: 'var(--cs-radius-sm)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all var(--cs-motion-fast) var(--cs-easing)',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    color: active ? 'var(--cs-accent)' : 'var(--cs-fg-primary)',
                    fontFamily: 'var(--cs-font-display)',
                    fontWeight: 500,
                    fontSize: 'var(--cs-text-sm)',
                  }}
                >
                  {meta.icon}
                  {meta.label}
                </span>
                <span style={{ fontSize: 11, color: 'var(--cs-fg-muted)', lineHeight: 1.4 }}>
                  {meta.description}
                </span>
                <span
                  data-cs-media-support={meta.mediaSupport}
                  aria-label={`Type de média : ${MEDIA_SUPPORT_LABEL[meta.mediaSupport]}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    marginTop: 2,
                    fontSize: 10,
                    fontWeight: 500,
                    color:
                      meta.mediaSupport === 'image'
                        ? 'var(--cs-fg-secondary)'
                        : 'var(--cs-accent)',
                    background:
                      meta.mediaSupport === 'image'
                        ? 'var(--cs-bg-base)'
                        : 'var(--cs-accent-bg)',
                    border:
                      meta.mediaSupport === 'image'
                        ? '1px solid var(--cs-border-hair)'
                        : '1px solid var(--cs-accent)',
                    borderRadius: 'var(--cs-radius-full)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {meta.mediaSupport === 'image' ? (
                    <ImageIcon size={10} />
                  ) : meta.mediaSupport === 'video' ? (
                    <Film size={10} />
                  ) : (
                    <>
                      <ImageIcon size={10} />
                      <Film size={10} />
                    </>
                  )}
                  {MEDIA_SUPPORT_LABEL[meta.mediaSupport]}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* CS v2 Phase 2 — Text model picker */}
      <label
        style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
        data-cs-section="text-model"
      >
        <span
          style={{
            fontSize: 11,
            color: 'var(--cs-fg-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Modèle de génération
        </span>
        <ModelPicker
          role="chat"
          format={format}
          value={model}
          onChange={setModel}
          disabled={submitting || disabled}
          testId="intention-form-model-picker"
        />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <SelectField
          label="Pilier"
          value={pillar}
          options={CONTENT_PILLARS.map((v) => ({ value: v, label: PILLAR_LABEL[v] }))}
          onChange={(v) => setPillar(v as ContentPillar)}
        />
        <SelectField
          label="Objectif"
          value={objective}
          options={CONTENT_OBJECTIVES.map((v) => ({ value: v, label: OBJECTIVE_LABEL[v] }))}
          onChange={(v) => setObjective(v as ContentObjective)}
        />
        <SelectField
          label="Plateforme"
          value={platform}
          options={CONTENT_PLATFORMS.map((v) => ({ value: v, label: PLATFORM_LABEL[v] }))}
          onChange={(v) => setPlatform(v as ContentPlatform)}
        />
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--cs-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Intention
        </span>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={4}
          aria-invalid={errors.prompt ? true : undefined}
          style={{
            padding: '10px 12px',
            background: 'var(--cs-bg-base)',
            border: errors.prompt ? '1px solid var(--cs-danger)' : '1px solid var(--cs-border)',
            borderRadius: 'var(--cs-radius-sm)',
            fontFamily: 'var(--cs-font-body)',
            fontSize: 'var(--cs-text-sm)',
            color: 'var(--cs-fg-primary)',
            resize: 'vertical',
          }}
        />
        {errors.prompt ? (
          <span style={{ color: 'var(--cs-danger)', fontSize: 12 }}>{errors.prompt}</span>
        ) : null}
      </label>

      {serverError ? (
        <p
          role="alert"
          style={{
            padding: 10,
            background: 'var(--cs-danger-bg)',
            color: 'var(--cs-danger)',
            borderRadius: 'var(--cs-radius-sm)',
            fontSize: 12,
            margin: 0,
          }}
        >
          {serverError}
        </p>
      ) : null}

      <Button type="submit" loading={submitting} disabled={disabled || submitting}>
        Enregistrer l&apos;idée
      </Button>
    </form>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        style={{
          fontSize: 11,
          color: 'var(--cs-fg-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          padding: '8px 10px',
          background: 'var(--cs-bg-base)',
          border: '1px solid var(--cs-border)',
          borderRadius: 'var(--cs-radius-sm)',
          fontFamily: 'var(--cs-font-body)',
          fontSize: 'var(--cs-text-sm)',
          color: 'var(--cs-fg-primary)',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
