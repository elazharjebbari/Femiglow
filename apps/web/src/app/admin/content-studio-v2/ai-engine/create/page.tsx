'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
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
} from '@/components/admin/content-studio-v2/ai-engine/GenerationResult';

interface BriefForm {
  objective: string;
  platform: string;
  format: string;
  tone: string;
  keyMessage: string;
  productFocus: string;
  trendReference: string;
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

type Phase = 'brief' | 'generating' | 'result' | 'error';

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
  const [errorMsg, setErrorMsg] = useState('');

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

  const handleGenerate = useCallback(async () => {
    setPhase('generating');
    setResult(null);
    setErrorMsg('');
    setTotalCost(undefined);

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
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erreur ${res.status}`);
      }

      const data = await res.json();

      simulateProgress((success) => {
        if (success) {
          setResult(data);
          setTotalCost(data.totalCostCents);
          setPhase('result');
        }
      });
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Erreur inconnue lors de la génération');
      setPhase('error');
    }
  }, [form, simulateProgress]);

  const handleRetry = useCallback(() => {
    handleGenerate();
  }, [handleGenerate]);

  const handleReset = useCallback(() => {
    setPhase('brief');
    setResult(null);
    setSteps([]);
    setTotalCost(undefined);
    setErrorMsg('');
  }, []);

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

      {phase === 'result' && result && (
        <GenerationResult
          result={result}
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
