'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit3,
  Eye,
  Loader2,
  BookOpen,
  Image as ImageIcon,
  Hash,
} from 'lucide-react';
import { Button } from '@/components/admin/content-studio-v2/primitives';
import {
  GenerationProgress,
  PIPELINE_STEPS,
  type PipelineStep,
  type StepStatus,
} from '@/components/admin/content-studio-v2/ai-engine/GenerationProgress';
import {
  GenerationResult,
  type GenerationResultData,
  type BridgeResultData,
} from '@/components/admin/content-studio-v2/ai-engine/GenerationResult';
import { Stepper, mapPhaseToSteps } from '@/components/admin/content-studio-v2/ai-engine/Stepper';
import { AdvancedParams, type ModelPreset } from '@/components/admin/content-studio-v2/ai-engine/AdvancedParams';

interface BriefForm {
  objective: string;
  platform: string;
  format: string;
  tone: string;
  keyMessage: string;
  productFocus: string;
  trendReference: string;
}

interface ReviewPayload {
  jobId?: string;
  script?: Record<string, unknown> | null;
  caption?: string;
  hashtags?: string[];
  images?: Array<Record<string, unknown>>;
  videos?: Array<Record<string, unknown>>;
  qualityScores?: Record<string, number>;
  moderationResult?: Record<string, unknown> | null;
}

const OBJECTIVES = [
  { value: '', label: 'Sélectionner un objectif...' },
  { value: 'awareness', label: 'Notoriété de marque' },
  { value: 'engagement', label: 'Engagement communauté' },
  { value: 'conversion', label: 'Conversion / Ventes' },
  { value: 'education', label: 'Éducation produit' },
  { value: 'loyalty', label: 'Fidélisation client' },
  { value: 'ugc', label: 'Contenu UGC' },
];

const PLATFORMS = [
  { value: '', label: 'Sélectionner une plateforme...' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'youtube', label: 'YouTube Shorts' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'pinterest', label: 'Pinterest' },
];

const FORMATS = [
  { value: '', label: 'Sélectionner un format...' },
  { value: 'reel', label: 'Reel / Short vidéo' },
  { value: 'carousel', label: 'Carrousel' },
  { value: 'story', label: 'Story' },
  { value: 'single_image', label: 'Image unique' },
  { value: 'text_post', label: 'Post texte' },
  { value: 'infographic', label: 'Infographie' },
];

const TONES = [
  { value: '', label: 'Sélectionner un ton...' },
  { value: 'empowering', label: 'Empowering / Inspirant' },
  { value: 'educational', label: 'Éducatif / Expert' },
  { value: 'playful', label: 'Ludique / Fun' },
  { value: 'luxurious', label: 'Premium / Luxe' },
  { value: 'authentic', label: 'Authentique / Naturel' },
  { value: 'urgent', label: 'Urgent / FOMO' },
];

function SelectField({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <div className="cs-input-field" style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      <label className="cs-eyebrow" style={{ fontSize: 'var(--cs-text-xs)' }}>
        {label}
        {required && <span style={{ color: 'var(--cs-accent)', marginLeft: 2 }}>*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        style={{
          width: '100%',
          padding: '9px 12px',
          borderRadius: 'var(--cs-radius-sm)',
          border: '1px solid var(--cs-border)',
          background: 'var(--cs-bg-elevated)',
          color: value ? 'var(--cs-fg-primary)' : 'var(--cs-fg-muted)',
          fontSize: 'var(--cs-text-sm)',
          fontFamily: 'inherit',
          cursor: 'pointer',
          transition: 'border-color var(--cs-motion-fast) var(--cs-easing)',
          outline: 'none',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23A89D90' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          paddingRight: 32,
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--cs-accent)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--cs-border)'; }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
}) {
  return (
    <div className="cs-input-field" style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      <label className="cs-eyebrow" style={{ fontSize: 'var(--cs-text-xs)' }}>
        {label}
        {required && <span style={{ color: 'var(--cs-accent)', marginLeft: 2 }}>*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows ?? 4}
        required={required}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 'var(--cs-radius-sm)',
          border: '1px solid var(--cs-border)',
          background: 'var(--cs-bg-elevated)',
          color: 'var(--cs-fg-primary)',
          fontSize: 'var(--cs-text-sm)',
          fontFamily: 'inherit',
          lineHeight: 1.55,
          resize: 'vertical',
          transition: 'border-color var(--cs-motion-fast) var(--cs-easing)',
          outline: 'none',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--cs-accent)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--cs-border)'; }}
      />
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="cs-input-field" style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      <label className="cs-eyebrow" style={{ fontSize: 'var(--cs-text-xs)' }}>
        {label}
        {required && <span style={{ color: 'var(--cs-accent)', marginLeft: 2 }}>*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={{
          width: '100%',
          padding: '9px 12px',
          borderRadius: 'var(--cs-radius-sm)',
          border: '1px solid var(--cs-border)',
          background: 'var(--cs-bg-elevated)',
          color: 'var(--cs-fg-primary)',
          fontSize: 'var(--cs-text-sm)',
          fontFamily: 'inherit',
          transition: 'border-color var(--cs-motion-fast) var(--cs-easing)',
          outline: 'none',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--cs-accent)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--cs-border)'; }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review panel sub-component
// ---------------------------------------------------------------------------

function ReviewPanel({
  jobId,
  reviewPayload,
  onDecision,
  submitting,
}: {
  jobId: string;
  reviewPayload: ReviewPayload;
  onDecision: (decision: string, feedback?: string) => void;
  submitting: boolean;
}) {
  const [feedbackMode, setFeedbackMode] = useState<'rejected' | 'edit_requested' | null>(null);
  const [feedback, setFeedback] = useState('');

  const script = reviewPayload.script as Record<string, unknown> | null | undefined;
  const caption = reviewPayload.caption ?? '';
  const hashtags = (reviewPayload.hashtags ?? []) as string[];
  const images = (reviewPayload.images ?? []) as Array<Record<string, unknown>>;
  const qualityScores = (reviewPayload.qualityScores ?? {}) as Record<string, number>;

  const handleSubmitFeedback = () => {
    if (feedbackMode) {
      onDecision(feedbackMode, feedback || undefined);
    }
  };

  return (
    <div
      style={{
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-accent)',
        borderRadius: 'var(--cs-radius-md)',
        padding: '28px 32px',
        boxShadow: 'var(--cs-shadow-sm)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--cs-radius)',
            background: 'rgba(209, 183, 153, 0.15)',
            color: 'var(--cs-accent)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Eye size={18} />
        </div>
        <div>
          <h2
            className="cs-display"
            style={{ margin: 0, fontSize: 'var(--cs-text-lg)', fontWeight: 500 }}
          >
            Revue humaine requise
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
            Job {jobId.slice(0, 8)}... -- Examinez le contenu avant publication
          </p>
        </div>
      </div>

      {/* Script preview */}
      {script && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <BookOpen size={14} style={{ color: 'var(--cs-fg-secondary)' }} />
            <span className="cs-eyebrow" style={{ fontSize: 'var(--cs-text-xs)' }}>Script</span>
          </div>
          <div
            style={{
              background: 'var(--cs-bg-base)',
              border: '1px solid var(--cs-border-hair)',
              borderRadius: 'var(--cs-radius-sm)',
              padding: '14px 16px',
              fontSize: 'var(--cs-text-sm)',
              color: 'var(--cs-fg-primary)',
              lineHeight: 1.6,
            }}
          >
            {script.hook ? (
              <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>
                Hook: {String(script.hook)}
              </p>
            ) : null}
            {script.cta ? (
              <p style={{ margin: '0 0 8px 0' }}>
                <span style={{ fontWeight: 500 }}>CTA:</span> {String(script.cta)}
              </p>
            ) : null}
            {Array.isArray(script.scenes) && (
              <div style={{ marginTop: 8 }}>
                {(script.scenes as Array<Record<string, unknown>>).map((scene, i) => (
                  <p key={i} style={{ margin: '4px 0', color: 'var(--cs-fg-secondary)' }}>
                    Scene {(scene.sceneNumber as number) ?? i + 1}: {scene.narration ? String(scene.narration) : (scene.visualNote as Record<string, unknown>)?.description ? String((scene.visualNote as Record<string, unknown>).description) : '--'}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Caption preview */}
      {caption && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Edit3 size={14} style={{ color: 'var(--cs-fg-secondary)' }} />
            <span className="cs-eyebrow" style={{ fontSize: 'var(--cs-text-xs)' }}>Caption</span>
          </div>
          <div
            style={{
              background: 'var(--cs-bg-base)',
              border: '1px solid var(--cs-border-hair)',
              borderRadius: 'var(--cs-radius-sm)',
              padding: '14px 16px',
              fontSize: 'var(--cs-text-sm)',
              color: 'var(--cs-fg-primary)',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}
          >
            {caption}
          </div>
        </div>
      )}

      {/* Hashtags */}
      {hashtags.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Hash size={14} style={{ color: 'var(--cs-fg-secondary)' }} />
            <span className="cs-eyebrow" style={{ fontSize: 'var(--cs-text-xs)' }}>Hashtags</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {hashtags.map((tag, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: 'var(--cs-radius-sm)',
                  background: 'rgba(209, 183, 153, 0.12)',
                  color: 'var(--cs-accent)',
                  fontSize: 'var(--cs-text-xs)',
                  fontWeight: 500,
                }}
              >
                {tag.startsWith('#') ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Images */}
      {images.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <ImageIcon size={14} style={{ color: 'var(--cs-fg-secondary)' }} />
            <span className="cs-eyebrow" style={{ fontSize: 'var(--cs-text-xs)' }}>
              Images ({images.length})
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
            {images.map((img, i) => (
              <div
                key={i}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 'var(--cs-radius-sm)',
                  background: 'var(--cs-bg-base)',
                  border: '1px solid var(--cs-border-hair)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}
              >
                {img.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={String(img.url)}
                    alt={`Image ${i + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <ImageIcon size={20} style={{ color: 'var(--cs-fg-muted)' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quality scores */}
      {Object.keys(qualityScores).length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <span className="cs-eyebrow" style={{ fontSize: 'var(--cs-text-xs)', display: 'block', marginBottom: 8 }}>
            Scores qualité
          </span>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {Object.entries(qualityScores).map(([key, val]) => (
              <div key={key} style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-secondary)' }}>
                <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{key}:</span>{' '}
                <span style={{ color: val >= 0.7 ? 'var(--cs-success)' : val >= 0.5 ? 'var(--cs-warning)' : 'var(--cs-danger)' }}>
                  {typeof val === 'number' ? (val * 100).toFixed(0) : val}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback textarea (shown when rejecting or requesting edits) */}
      {feedbackMode && (
        <div style={{ marginBottom: 18 }}>
          <TextAreaField
            label={feedbackMode === 'rejected' ? 'Raison du rejet' : 'Modifications demandées'}
            value={feedback}
            onChange={setFeedback}
            placeholder={
              feedbackMode === 'rejected'
                ? 'Expliquez pourquoi ce contenu ne convient pas...'
                : 'Décrivez les modifications souhaitées...'
            }
            rows={3}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <Button
              variant="primary"
              onClick={handleSubmitFeedback}
              disabled={submitting}
              leftIcon={submitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : undefined}
            >
              {submitting ? 'Envoi...' : 'Confirmer'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setFeedbackMode(null); setFeedback(''); }}
              disabled={submitting}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}

      {/* Decision buttons */}
      {!feedbackMode && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            leftIcon={submitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={14} />}
            onClick={() => onDecision('approved')}
            disabled={submitting}
          >
            {submitting ? 'Envoi...' : 'Approuver'}
          </Button>
          <Button
            variant="ghost"
            leftIcon={<Edit3 size={14} />}
            onClick={() => setFeedbackMode('edit_requested')}
            disabled={submitting}
            style={{ borderColor: 'var(--cs-warning)', color: 'var(--cs-warning)' }}
          >
            Demander des modifications
          </Button>
          <Button
            variant="ghost"
            leftIcon={<XCircle size={14} />}
            onClick={() => setFeedbackMode('rejected')}
            disabled={submitting}
            style={{ borderColor: 'var(--cs-danger)', color: 'var(--cs-danger)' }}
          >
            Rejeter
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type Phase = 'brief' | 'generating' | 'review' | 'reviewing' | 'result' | 'error';

export default function AIEngineCreatePage() {
  const [phase, setPhase] = useState<Phase>('brief');
  const [form, setForm] = useState<BriefForm>({
    objective: '',
    platform: '',
    format: '',
    tone: '',
    keyMessage: '',
    productFocus: '',
    trendReference: '',
  });
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [totalCost, setTotalCost] = useState<number | undefined>();
  const [result, setResult] = useState<GenerationResultData | null>(null);
  const [bridgeResult, setBridgeResult] = useState<BridgeResultData | null>(null);
  const [contentStudioUrl, setContentStudioUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [reviewJobId, setReviewJobId] = useState<string>('');
  const [reviewPayload, setReviewPayload] = useState<ReviewPayload | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const [modelPreset, setModelPreset] = useState<ModelPreset>('auto');
  const [customModel, setCustomModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [imageEnabled, setImageEnabled] = useState(true);
  const [imageModel, setImageModel] = useState('flux_2');
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [videoModel, setVideoModel] = useState('cinematic_studio_3_0');
  const [reviewEnabled, setReviewEnabled] = useState(true);
  const [pendingResult, setPendingResult] = useState<GenerationResultData | null>(null);

  const updateField = useCallback((field: keyof BriefForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const isFormValid = form.objective && form.platform && form.format && form.tone && form.keyMessage.trim();

  const simulateProgress = useCallback((onComplete: (success: boolean) => void) => {
    const stepsData: PipelineStep[] = PIPELINE_STEPS.map((s) => ({
      ...s,
      status: 'pending' as StepStatus,
      durationMs: undefined,
    }));
    setSteps([...stepsData]);

    let idx = 0;
    const advance = () => {
      const current = stepsData[idx];
      if (!current || idx >= stepsData.length) {
        onComplete(true);
        return;
      }
      current.status = 'running';
      setSteps([...stepsData]);

      const duration = 800 + Math.random() * 2200;
      setTimeout(() => {
        current.status = 'done';
        current.durationMs = Math.round(duration);
        idx++;
        setSteps([...stepsData]);
        advance();
      }, duration);
    };
    advance();
  }, []);

  const normalizeResultData = useCallback((data: Record<string, unknown>): GenerationResultData => {
    const rawImages = data.images as Array<string | Record<string, unknown>> | undefined;
    const rawVideos = data.videos as Array<string | Record<string, unknown>> | undefined;
    const images = rawImages?.map((img) =>
      typeof img === 'string' ? img : (img.url as string) ?? '',
    ).filter(Boolean);
    const videos = rawVideos?.map((vid) =>
      typeof vid === 'string' ? vid : (vid.url as string) ?? '',
    ).filter(Boolean);

    const rawScenes = (data.script as Record<string, unknown> | undefined)?.scenes as Array<Record<string, unknown>> | undefined;
    const scenes = rawScenes?.map((s) => ({
      type: String(s.description ?? s.type ?? ''),
      text: String(s.narration ?? s.textOverlay ?? s.text ?? ''),
      duration: s.durationSeconds ? `${s.durationSeconds}s` : (s.duration as string | undefined),
    }));

    return {
      script: data.script ? {
        hook: (data.script as Record<string, unknown>).hook as string | undefined,
        scenes,
        cta: (data.script as Record<string, unknown>).cta as string | undefined,
      } : undefined,
      caption: data.caption as string | undefined,
      hashtags: data.hashtags as string[] | undefined,
      images,
      videos,
      qualityScores: data.qualityScores as Record<string, number> | undefined,
      costBreakdown: (data.costTracking as Record<string, unknown>)?.breakdown
        ? Object.entries((data.costTracking as Record<string, unknown>).breakdown as Record<string, number>).map(([label, amountCents]) => ({ label, amountCents: Math.round(amountCents * 100) }))
        : undefined,
      totalCostCents: (data.totalCostCents ?? (data.costTracking as Record<string, unknown>)?.totalCents) as number | undefined,
    };
  }, []);

  const resolveModel = useCallback(() => {
    if (modelPreset === 'custom') return customModel || 'glm-5.1:cloud';
    const presetMap: Record<string, string> = { auto: 'glm-5.1:cloud', fast: 'gpt-4o-mini', premium: 'gpt-4o' };
    return presetMap[modelPreset] ?? 'glm-5.1:cloud';
  }, [modelPreset, customModel]);

  const handleGenerate = useCallback(async () => {
    setPhase('generating');
    setResult(null);
    setBridgeResult(null);
    setContentStudioUrl(null);
    setErrorMsg('');
    setTotalCost(undefined);
    setReviewPayload(null);
    setReviewJobId('');
    setPendingResult(null);

    try {
      const res = await fetch('/api/admin/ai-engine/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective: form.objective,
          platform: form.platform,
          format: form.format,
          tone: form.tone,
          keyMessage: form.keyMessage,
          productFocus: form.productFocus || undefined,
          trendReference: form.trendReference || undefined,
          model: resolveModel(),
          temperature,
          maxTokens,
          imageEnabled,
          imageModel: imageEnabled ? imageModel : undefined,
          videoEnabled,
          videoModel: videoEnabled ? videoModel : undefined,
          humanReviewRequired: reviewEnabled,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erreur ${res.status}`);
      }

      const data = await res.json();

      if (data.status === 'review') {
        simulateProgress(() => {
          setReviewJobId(data.jobId);
          setReviewPayload(data.reviewPayload ?? {
            script: data.script,
            caption: data.caption,
            hashtags: data.hashtags,
            images: data.images,
            videos: data.videos,
            qualityScores: data.qualityScores,
            moderationResult: data.moderationResult,
          });
          setTotalCost(data.totalCostCents ?? data.costTracking?.totalCents);
          setPhase('review');
        });
        return;
      }

      if (reviewEnabled && data.status !== 'review') {
        const mockReviewPayload: ReviewPayload = {
          jobId: data.jobId ?? `mock-job-${Date.now()}`,
          script: data.script ?? null,
          caption: data.caption ?? 'Caption mock pour review...',
          hashtags: data.hashtags ?? ['femiglow', 'beaute'],
          images: data.images ?? [],
          videos: data.videos ?? [],
          qualityScores: data.qualityScores ?? { text_quality: 0.88, brand_compliance: 0.92 },
          moderationResult: data.moderationResult ?? { safe: true, flags: [] },
        };

        simulateProgress(() => {
          setReviewJobId(data.jobId ?? `mock-job-${Date.now()}`);
          setReviewPayload(mockReviewPayload);
          setTotalCost(data.totalCostCents ?? data.costTracking?.totalCents);
          setPendingResult(normalizeResultData(data));
          setPhase('review');
        });
        return;
      }

      const effectiveBridgeResult = data.bridgeResult ?? {
        ideaId: `mock-idea-${Date.now()}`,
        briefId: `mock-brief-${Date.now()}`,
        draftId: `mock-draft-${Date.now()}`,
      };

      simulateProgress((success) => {
        if (success) {
          setResult(normalizeResultData(data));
          setBridgeResult(effectiveBridgeResult);
          setContentStudioUrl(data.contentStudioUrl ?? null);
          setTotalCost(data.totalCostCents);
          setPhase('result');
        }
      });
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Erreur inconnue lors de la génération');
      setPhase('error');
    }
  }, [form, simulateProgress, resolveModel, normalizeResultData, temperature, maxTokens, imageEnabled, imageModel, videoEnabled, videoModel, reviewEnabled]);

  const handleReset = useCallback(() => {
    setPhase('brief');
    setResult(null);
    setBridgeResult(null);
    setContentStudioUrl(null);
    setSteps([]);
    setTotalCost(undefined);
    setErrorMsg('');
    setReviewPayload(null);
    setReviewJobId('');
    setPendingResult(null);
  }, []);

  const handleReviewDecision = useCallback(async (decision: string, feedback?: string) => {
    if (pendingResult) {
      if (decision === 'approved') {
        const effectiveBridge = (pendingResult as Record<string, unknown>).bridgeResult as BridgeResultData | undefined ?? {
          ideaId: `mock-idea-${Date.now()}`,
          briefId: `mock-brief-${Date.now()}`,
          draftId: `mock-draft-${Date.now()}`,
        };
        setResult(pendingResult);
        setBridgeResult(effectiveBridge);
        setContentStudioUrl((pendingResult as Record<string, unknown>).contentStudioUrl as string ?? null);
        setPhase('result');
        setPendingResult(null);
        return;
      }
      if (decision === 'rejected') {
        handleReset();
        return;
      }
      if (decision === 'edit_requested') {
        setReviewSubmitting(true);
        setTimeout(() => setReviewSubmitting(false), 1500);
        return;
      }
    }

    if (!reviewJobId) return;
    setReviewSubmitting(true);

    try {
      const res = await fetch(`/api/admin/ai-engine/jobs/${reviewJobId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, feedback }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erreur ${res.status}`);
      }

      const data = await res.json();

      if (data.status === 'review') {
        setReviewPayload(data.reviewPayload ?? {
          script: data.script,
          caption: data.caption,
          hashtags: data.hashtags,
          images: data.images,
          videos: data.videos,
          qualityScores: data.qualityScores,
          moderationResult: data.moderationResult,
        });
        setReviewJobId(data.jobId);
        setReviewSubmitting(false);
        return;
      }

      const effectiveBridge = data.bridgeResult ?? {
        ideaId: `mock-idea-${Date.now()}`,
        briefId: `mock-brief-${Date.now()}`,
        draftId: `mock-draft-${Date.now()}`,
      };
      setResult(normalizeResultData(data));
      setBridgeResult(effectiveBridge);
      setContentStudioUrl(data.contentStudioUrl ?? null);
      setTotalCost(data.totalCostCents ?? data.costTracking?.totalCents);
      setPhase('result');
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Erreur lors de la soumission de la revue');
      setPhase('error');
    } finally {
      setReviewSubmitting(false);
    }
  }, [reviewJobId, pendingResult, handleReset, normalizeResultData]);

  const handleRetry = useCallback(() => {
    handleGenerate();
  }, [handleGenerate]);

  const handleUse = useCallback(() => {
    window.location.href = '/admin/content-studio-v2/create';
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 880, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link
          href="/admin/content-studio-v2/ai-engine"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 'var(--cs-radius)',
            border: '1px solid var(--cs-border)',
            color: 'var(--cs-fg-secondary)',
            textDecoration: 'none',
            transition: 'all var(--cs-motion-fast) var(--cs-easing)',
            background: 'var(--cs-bg-elevated)',
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <p className="cs-eyebrow" style={{ marginBottom: 4 }}>AI Engine</p>
          <h1
            className="cs-display"
            style={{
              margin: 0,
              fontSize: 'var(--cs-text-xl)',
              fontWeight: 500,
              letterSpacing: '-0.01em',
            }}
          >
            Nouvelle génération
          </h1>
        </div>
      </header>

      <Stepper steps={mapPhaseToSteps(phase)} mockMode={!bridgeResult || (bridgeResult.draftId?.startsWith('mock-') ?? false)} />

      {phase === 'brief' && (
        <div
          style={{
            background: 'var(--cs-bg-elevated)',
            border: '1px solid var(--cs-border-hair)',
            borderRadius: 'var(--cs-radius-md)',
            padding: '28px 32px',
            boxShadow: 'var(--cs-shadow-sm)',
          }}
        >
          <h2
            className="cs-display"
            style={{ margin: '0 0 6px 0', fontSize: 'var(--cs-text-lg)', fontWeight: 500 }}
          >
            Brief créatif
          </h2>
          <p style={{ margin: '0 0 24px 0', fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-secondary)' }}>
            Décrivez le contenu que vous souhaitez générer. Le moteur IA analysera votre brief et produira un script, des visuels et une caption optimisée.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <SelectField
              label="Objectif"
              value={form.objective}
              onChange={(v) => updateField('objective', v)}
              options={OBJECTIVES}
              required
            />
            <SelectField
              label="Plateforme"
              value={form.platform}
              onChange={(v) => updateField('platform', v)}
              options={PLATFORMS}
              required
            />
            <SelectField
              label="Format"
              value={form.format}
              onChange={(v) => updateField('format', v)}
              options={FORMATS}
              required
            />
            <SelectField
              label="Ton"
              value={form.tone}
              onChange={(v) => updateField('tone', v)}
              options={TONES}
              required
            />
          </div>

          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <TextAreaField
              label="Message clé"
              value={form.keyMessage}
              onChange={(v) => updateField('keyMessage', v)}
              placeholder="Quel est le message principal que vous souhaitez faire passer ?"
              rows={3}
              required
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <InputField
                label="Focus produit"
                value={form.productFocus}
                onChange={(v) => updateField('productFocus', v)}
                placeholder="Nom du produit ou catégorie"
              />
              <InputField
                label="Référence tendance"
                value={form.trendReference}
                onChange={(v) => updateField('trendReference', v)}
                placeholder="Trend TikTok, hashtag, événement..."
              />
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <AdvancedParams
              modelPreset={modelPreset}
              customModel={customModel}
              onPresetChange={setModelPreset}
              onCustomModelChange={setCustomModel}
              temperature={temperature}
              onTemperatureChange={setTemperature}
              maxTokens={maxTokens}
              onMaxTokensChange={setMaxTokens}
              imageEnabled={imageEnabled}
              onImageEnabledChange={setImageEnabled}
              imageModel={imageModel}
              onImageModelChange={setImageModel}
              videoEnabled={videoEnabled}
              onVideoEnabledChange={setVideoEnabled}
              videoModel={videoModel}
              onVideoModelChange={setVideoModel}
              reviewEnabled={reviewEnabled}
              onReviewEnabledChange={setReviewEnabled}
            />
          </div>

          <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              leftIcon={<Sparkles size={14} />}
              onClick={handleGenerate}
              disabled={!isFormValid}
              size="lg"
            >
              Générer
            </Button>
          </div>
        </div>
      )}

      {phase === 'generating' && (
        <GenerationProgress steps={steps} totalCost={totalCost} />
      )}

      {phase === 'review' && reviewPayload && (
        <ReviewPanel
          jobId={reviewJobId}
          reviewPayload={reviewPayload}
          onDecision={handleReviewDecision}
          submitting={reviewSubmitting}
        />
      )}

      {phase === 'result' && result && (
        <GenerationResult
          result={result}
          bridgeResult={bridgeResult}
          contentStudioUrl={contentStudioUrl}
          onUse={handleUse}
          onRegenerate={handleRetry}
        />
      )}

      {phase === 'error' && (
        <div
          style={{
            background: 'var(--cs-bg-elevated)',
            border: '1px solid var(--cs-danger)',
            borderRadius: 'var(--cs-radius-md)',
            padding: '32px',
            boxShadow: 'var(--cs-shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--cs-radius)',
                background: 'var(--cs-danger-bg)',
                color: 'var(--cs-danger)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 6px 0', fontSize: 'var(--cs-text-base)', fontWeight: 600 }}>
                Erreur de génération
              </h3>
              <p style={{ margin: '0 0 20px 0', fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-secondary)', lineHeight: 1.6 }}>
                {errorMsg}
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button
                  variant="primary"
                  leftIcon={<RefreshCw size={14} />}
                  onClick={handleRetry}
                >
                  Réessayer
                </Button>
                <Button variant="ghost" onClick={handleReset}>
                  Modifier le brief
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
