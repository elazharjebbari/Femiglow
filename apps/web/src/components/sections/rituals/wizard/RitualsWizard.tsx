'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Fleuron } from '@/components/ui/Fleuron';
import { Kicker } from '@/components/ui/Kicker';
import { useDraftStorage } from '@/lib/rituals/hooks/use-draft-storage';
import { RITUAL_TAG_CATALOG, RITUAL_CITY_CATALOG } from '@/lib/schemas/rituals';

/**
 * Wizard de soumission d'un rituel — 3 étapes + confirmation.
 * Cf. docs/reviews-wall/execution/03-wizard-ui-specification.md
 *
 * Posture : un wizard sobre, prêt à être enrichi. Toutes les étapes 2 et 3
 * sont optionnelles ; l'étape 1 (body + signal) suffit à soumettre.
 */

type WizardStep = 1 | 2 | 3 | 'confirmation';
type Signal = 'oui' | 'hesite' | 'non';

interface PhotoUpload {
  tempId: string;
  status: 'uploading' | 'OK' | 'MANUAL_REVIEW' | 'REJECTED_FACE' | 'error';
  blobKey?: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  byteSize?: number;
  mime?: string;
  errorMessage?: string;
}

interface RitualsWizardProps {
  productKey: string;
  emailToken?: string | null;
  prefill?: { firstName?: string; city?: string };
  onClose: () => void;
  onBackToList: () => void;
}

const TAG_LABEL: Record<string, string> = {
  'ongles-plus-lisses': 'Ongles plus lisses',
  'plaque-souple': 'Plaque souple',
  'cuticules-apaisees': 'Cuticules apaisées',
  'plus-de-casse': 'Plus de casse',
  'eclat-naturel': 'Éclat naturel',
  'rituel-devenu-habitude': 'Rituel devenu habitude',
  'mains-detendues': 'Mains détendues',
  'fini-brillant': 'Fini brillant',
  halal: 'Halal',
};

export function RitualsWizard({
  productKey,
  emailToken,
  prefill,
  onClose,
  onBackToList,
}: RitualsWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [body, setBody] = useState('');
  const [wouldRecommend, setWouldRecommend] = useState<Signal | null>(null);
  const [ritualTags, setRitualTags] = useState<string[]>([]);
  const [authorFirstName, setAuthorFirstName] = useState(prefill?.firstName ?? '');
  const [authorCity, setAuthorCity] = useState(prefill?.city ?? '');
  const [initiatedSinceMonth, setInitiatedSinceMonth] = useState<number | null>(null);
  const [initiatedSinceYear, setInitiatedSinceYear] = useState<number | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [photos, setPhotos] = useState<PhotoUpload[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [emojiToast, setEmojiToast] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);

  const draft = useDraftStorage();
  const draftLoaded = useRef(false);

  useEffect(() => {
    if (draftLoaded.current) return;
    if (draft.hasDraft) setShowResumeModal(true);
    draftLoaded.current = true;
  }, [draft.hasDraft]);

  // Auto-save toutes les 15 sec
  useEffect(() => {
    if (step === 'confirmation') return;
    const id = setInterval(() => {
      draft.save({
        body,
        wouldRecommend,
        ritualTags,
        authorFirstName,
        authorCity,
        initiatedSinceMonth,
        initiatedSinceYear,
        isAnonymous,
      });
    }, 15000);
    return () => clearInterval(id);
  }, [
    body,
    wouldRecommend,
    ritualTags,
    authorFirstName,
    authorCity,
    initiatedSinceMonth,
    initiatedSinceYear,
    isAnonymous,
    step,
    draft,
  ]);

  const wordCount = useMemo(() => body.trim().split(/\s+/).filter(Boolean).length, [body]);
  const charCount = body.length;
  const canSubmitStep1 = charCount >= 50 && charCount <= 600 && wouldRecommend !== null;

  const handleBodyChange = (raw: string) => {
    // Strip emoji à la frappe + toast
    const cleaned = raw.replace(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{FE0F}\u{200D}]/gu,
      '',
    );
    if (cleaned !== raw) {
      setEmojiToast(true);
      setTimeout(() => setEmojiToast(false), 2200);
    }
    setBody(cleaned);
  };

  const toggleTag = (tag: string) => {
    setRitualTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 3) return prev;
      return [...prev, tag];
    });
  };

  const uploadPhoto = async (file: File): Promise<void> => {
    const tempId = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setPhotos((prev) => [...prev, { tempId, status: 'uploading' }]);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/rituals/upload-photo', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: { code?: string; message?: string };
        };
        setPhotos((prev) =>
          prev.map((p) =>
            p.tempId === tempId
              ? {
                  ...p,
                  status: 'error',
                  errorMessage: err.error?.message ?? `Erreur ${res.status}`,
                }
              : p,
          ),
        );
        return;
      }
      const json = (await res.json()) as {
        data: {
          blobKey: string;
          thumbUrl: string;
          width: number;
          height: number;
          byteSize: number;
          mime: string;
          facesStatus: 'OK' | 'MANUAL_REVIEW' | 'REJECTED_FACE' | 'PENDING_CHECK';
        };
      };
      const status: PhotoUpload['status'] =
        json.data.facesStatus === 'OK'
          ? 'OK'
          : json.data.facesStatus === 'REJECTED_FACE'
            ? 'REJECTED_FACE'
            : 'MANUAL_REVIEW';
      setPhotos((prev) =>
        prev.map((p) =>
          p.tempId === tempId
            ? {
                ...p,
                status,
                blobKey: json.data.blobKey,
                thumbUrl: json.data.thumbUrl,
                width: json.data.width,
                height: json.data.height,
                byteSize: json.data.byteSize,
                mime: json.data.mime,
              }
            : p,
        ),
      );
    } catch (e) {
      setPhotos((prev) =>
        prev.map((p) =>
          p.tempId === tempId
            ? {
                ...p,
                status: 'error',
                errorMessage: e instanceof Error ? e.message : String(e),
              }
            : p,
        ),
      );
    }
  };

  const removePhoto = (tempId: string) => {
    setPhotos((prev) => prev.filter((p) => p.tempId !== tempId));
  };

  const submit = async () => {
    if (!wouldRecommend) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const initiatedSince =
        initiatedSinceMonth && initiatedSinceYear
          ? `${initiatedSinceYear}-${String(initiatedSinceMonth).padStart(2, '0')}`
          : null;
      const photosPayload = photos
        .filter(
          (p): p is PhotoUpload & { blobKey: string } =>
            (p.status === 'OK' || p.status === 'MANUAL_REVIEW') &&
            !!p.blobKey,
        )
        .map((p) => ({
          blobKey: p.blobKey,
          width: p.width!,
          height: p.height!,
          byteSize: p.byteSize!,
          mime: p.mime as 'image/jpeg' | 'image/png' | 'image/heic' | 'image/webp',
        }));
      const res = await fetch('/api/rituals/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productKey,
          body,
          wouldRecommend,
          ritualTags,
          authorFirstName: authorFirstName || null,
          authorCity: authorCity || null,
          initiatedSince,
          isAnonymous,
          language: 'fr',
          photos: photosPayload,
          emailToken: emailToken ?? null,
          consentMarketing: false,
        }),
      });
      if (res.status === 429) {
        const json = await res.json();
        throw new Error(json.error?.message ?? 'rate limit');
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`);
      }
      draft.clear();
      setStep('confirmation');
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const restoreDraft = () => {
    const payload = draft.restore();
    if (payload) {
      setBody(payload.body);
      setWouldRecommend(payload.wouldRecommend);
      setRitualTags(payload.ritualTags);
      setAuthorFirstName(payload.authorFirstName);
      setAuthorCity(payload.authorCity);
      setInitiatedSinceMonth(payload.initiatedSinceMonth);
      setInitiatedSinceYear(payload.initiatedSinceYear);
      setIsAnonymous(payload.isAnonymous);
    }
    setShowResumeModal(false);
  };

  return (
    <div className="flex h-full flex-col" data-testid="rituals-wizard">
      <header className="border-b border-encre/10 px-6 pb-4 pt-6">
        <button
          type="button"
          onClick={onBackToList}
          className="mb-3 text-xs font-medium text-encre/70 hover:text-encre"
        >
          ← Revenir aux rituels
        </button>
        <div className="flex items-baseline justify-between">
          <Kicker tone="sauge">PARTAGER MON RITUEL</Kicker>
          <span className="font-inter text-xs text-encre/60">
            {step === 'confirmation' ? '' : `${step} sur 3`}
          </span>
        </div>
        <h2 className="mt-1 font-cormorant text-2xl font-light text-encre">
          {step === 1 && 'Étape 1 — Votre voix'}
          {step === 2 && 'Étape 2 — Vos mots-clés'}
          {step === 3 && 'Étape 3 — Votre signature'}
          {step === 'confirmation' && 'La maison reçoit votre rituel.'}
        </h2>
        {step !== 'confirmation' && <Fleuron size="sm" tone="champagne" className="my-3" />}
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {step === 1 && (
          <Step1
            body={body}
            onBodyChange={handleBodyChange}
            wouldRecommend={wouldRecommend}
            onSignalChange={setWouldRecommend}
            charCount={charCount}
            wordCount={wordCount}
            emojiToast={emojiToast}
            canSubmit={canSubmitStep1}
            onContinue={() => setStep(2)}
            onSubmitNow={submit}
            submitting={submitting}
            submitError={submitError}
          />
        )}

        {step === 2 && (
          <Step2
            ritualTags={ritualTags}
            onToggleTag={toggleTag}
            photos={photos}
            onUploadPhoto={uploadPhoto}
            onRemovePhoto={removePhoto}
            onContinue={() => setStep(3)}
            onSkip={submit}
            onBack={() => setStep(1)}
            submitting={submitting}
            submitError={submitError}
          />
        )}

        {step === 3 && (
          <Step3
            firstName={authorFirstName}
            onFirstNameChange={setAuthorFirstName}
            city={authorCity}
            onCityChange={setAuthorCity}
            month={initiatedSinceMonth}
            onMonthChange={setInitiatedSinceMonth}
            year={initiatedSinceYear}
            onYearChange={setInitiatedSinceYear}
            anonymous={isAnonymous}
            onAnonymousChange={setIsAnonymous}
            onSubmit={submit}
            onBack={() => setStep(2)}
            submitting={submitting}
            submitError={submitError}
          />
        )}

        {step === 'confirmation' && <ConfirmationView onClose={onClose} />}
      </div>

      {showResumeModal && (
        <DraftResumeModal
          onResume={restoreDraft}
          onRestart={() => {
            draft.clear();
            setShowResumeModal(false);
          }}
          onLater={() => setShowResumeModal(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Étape 1 — body + signal
// ---------------------------------------------------------------------------

function Step1({
  body,
  onBodyChange,
  wouldRecommend,
  onSignalChange,
  charCount,
  wordCount,
  emojiToast,
  canSubmit,
  onContinue,
  onSubmitNow,
  submitting,
  submitError,
}: {
  body: string;
  onBodyChange: (next: string) => void;
  wouldRecommend: Signal | null;
  onSignalChange: (s: Signal) => void;
  charCount: number;
  wordCount: number;
  emojiToast: boolean;
  canSubmit: boolean;
  onContinue: () => void;
  onSubmitNow: () => void;
  submitting: boolean;
  submitError: string | null;
}) {
  const tooShort = charCount > 0 && charCount < 50;
  const tooLong = charCount > 600;
  const counterText = tooLong
    ? `${wordCount} mots — au-delà de trois cents, l’attention se perd.`
    : tooShort
      ? `${wordCount} / 50 mots`
      : charCount === 0
        ? '0 / 50 mots'
        : `${wordCount} mots — suffisamment dense pour être lue.`;

  return (
    <div className="space-y-8" data-testid="wizard-step-1">
      <div>
        <label htmlFor="ritual-body" className="block font-cormorant text-lg text-encre">
          Qu&apos;est-ce que le rituel a changé pour vous ?
        </label>
        <div className="mt-3">
          <textarea
            id="ritual-body"
            data-testid="wizard-body"
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            rows={6}
            className="w-full resize-y border-[1.5px] border-sauge-soft bg-white p-4 font-cormorant text-base leading-relaxed text-encre focus:border-sauge-dark focus:outline-none"
            placeholder="Décrivez ce que vous avez remarqué. Cinquante mots suffisent."
            aria-describedby="ritual-body-counter"
          />
          <p
            id="ritual-body-counter"
            data-testid="wizard-body-counter"
            className={`mt-2 text-xs ${
              tooLong ? 'text-rose-700' : tooShort ? 'text-encre/60' : 'text-sauge-dark'
            }`}
          >
            {counterText}
          </p>
        </div>
        {emojiToast && (
          <p
            role="status"
            aria-live="polite"
            data-testid="wizard-emoji-toast"
            className="mt-2 inline-block bg-sauge-soft px-3 py-1 font-cormorant text-sm italic text-encre"
          >
            Les émoticônes ne sont pas dans notre grammaire.
          </p>
        )}
      </div>

      <fieldset>
        <legend className="block font-cormorant text-lg text-encre">
          Recommanderiez-vous ce rituel à une amie ?
        </legend>
        <div className="mt-3 space-y-2">
          {(['oui', 'hesite', 'non'] as Signal[]).map((value) => {
            const label =
              value === 'oui'
                ? 'Oui, sans hésiter'
                : value === 'hesite'
                  ? 'J’hésite'
                  : 'Pas pour moi';
            const checked = wouldRecommend === value;
            return (
              <label
                key={value}
                data-testid={`wizard-signal-${value}`}
                className={`flex cursor-pointer items-center gap-3 border-[1.5px] px-5 py-4 transition-colors ${
                  checked
                    ? 'border-sauge-dark bg-sauge-soft'
                    : 'border-sauge-soft bg-white hover:bg-sauge-soft/50'
                }`}
              >
                <input
                  type="radio"
                  name="wouldRecommend"
                  value={value}
                  checked={checked}
                  onChange={() => onSignalChange(value)}
                  className="h-4 w-4 accent-sauge-dark"
                />
                <span className="font-inter text-sm text-encre">{label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {submitError && (
        <p
          role="alert"
          className="bg-rose-50 p-3 text-sm text-rose-900"
          data-testid="wizard-submit-error"
        >
          {submitError}
        </p>
      )}

      <div className="space-y-3">
        {canSubmit && (
          <button
            type="button"
            onClick={onSubmitNow}
            disabled={submitting}
            data-testid="wizard-submit-now"
            className="text-sm font-medium text-encre/70 underline hover:text-encre disabled:opacity-50"
          >
            Soumettre tel quel →
          </button>
        )}
        <button
          type="button"
          onClick={onContinue}
          disabled={!canSubmit || submitting}
          data-testid="wizard-continue-1"
          className="block w-full bg-encre py-4 font-inter text-sm font-medium text-creme transition-colors hover:bg-encre-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continuer →
        </button>
        <p className="text-center text-xs italic text-encre/60">
          Vous pouvez partager dès maintenant. Les détails sont facultatifs.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Étape 2 — tags + photos (photos skipped pour P2.2 minimal)
// ---------------------------------------------------------------------------

function Step2({
  ritualTags,
  onToggleTag,
  photos,
  onUploadPhoto,
  onRemovePhoto,
  onContinue,
  onSkip,
  onBack,
  submitting,
  submitError,
}: {
  ritualTags: string[];
  onToggleTag: (tag: string) => void;
  photos: PhotoUpload[];
  onUploadPhoto: (file: File) => Promise<void>;
  onRemovePhoto: (tempId: string) => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack: () => void;
  submitting: boolean;
  submitError: string | null;
}) {
  const limitReached = ritualTags.length >= 3;
  const photoLimitReached = photos.length >= 3;
  const hasFaceRejected = photos.some((p) => p.status === 'REJECTED_FACE');
  return (
    <div className="space-y-8" data-testid="wizard-step-2">
      <fieldset>
        <legend className="block font-cormorant text-lg text-encre">
          Que diriez-vous en trois mots ?{' '}
          <span className="text-xs italic text-encre/60">(jusqu’à trois)</span>
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {RITUAL_TAG_CATALOG.map((tag) => {
            const checked = ritualTags.includes(tag);
            const disabled = !checked && limitReached;
            return (
              <label
                key={tag}
                data-testid={`wizard-tag-${tag}`}
                className={`flex cursor-pointer items-center gap-3 border-[1.5px] px-4 py-3 transition-colors ${
                  checked
                    ? 'border-sauge-dark bg-sauge-soft'
                    : disabled
                      ? 'cursor-not-allowed border-sauge-soft bg-stone-50 opacity-40'
                      : 'border-sauge-soft bg-white hover:bg-sauge-soft/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onToggleTag(tag)}
                  className="h-4 w-4 accent-sauge-dark"
                />
                <span className="font-inter text-sm text-encre">
                  {TAG_LABEL[tag] ?? tag}
                </span>
              </label>
            );
          })}
        </div>
        {limitReached && (
          <p className="mt-2 text-xs italic text-encre/60">Trois suffisent.</p>
        )}
      </fieldset>

      <fieldset>
        <legend className="block font-cormorant text-lg text-encre">
          Une photo de vos mains ?{' '}
          <span className="text-xs italic text-encre/60">(jusqu’à trois)</span>
        </legend>

        {photos.length > 0 && (
          <ul
            role="list"
            className="mt-3 grid grid-cols-3 gap-3"
            data-testid="wizard-photos-list"
          >
            {photos.map((p) => (
              <li
                key={p.tempId}
                className={`relative aspect-square border ${
                  p.status === 'REJECTED_FACE'
                    ? 'border-rose-500'
                    : p.status === 'MANUAL_REVIEW'
                      ? 'border-amber-500'
                      : p.status === 'error'
                        ? 'border-rose-700'
                        : 'border-sauge-soft'
                } bg-creme p-1`}
              >
                {p.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.thumbUrl}
                    alt={`Photo ${p.tempId}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span
                    className="flex h-full w-full items-center justify-center text-xs italic text-encre/60"
                    aria-live="polite"
                  >
                    {p.status === 'uploading'
                      ? 'Envoi…'
                      : p.errorMessage ?? 'Erreur'}
                  </span>
                )}
                {p.status === 'REJECTED_FACE' && (
                  <span className="absolute bottom-1 left-1 right-1 bg-rose-700 px-1 py-0.5 text-center text-[10px] text-white">
                    Visage détecté
                  </span>
                )}
                {p.status === 'MANUAL_REVIEW' && (
                  <span className="absolute bottom-1 left-1 right-1 bg-amber-600 px-1 py-0.5 text-center text-[10px] text-white">
                    En relecture
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onRemovePhoto(p.tempId)}
                  aria-label="Retirer cette photo"
                  className="absolute right-0 top-0 inline-flex h-6 w-6 items-center justify-center bg-white/90 text-xs text-encre hover:bg-rose-100"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {!photoLimitReached && (
          <label
            className="mt-3 flex cursor-pointer flex-col items-center justify-center border-[1.5px] border-dashed border-sauge-soft bg-white p-6 text-center hover:border-sauge-dark"
            data-testid="wizard-photo-drop"
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onUploadPhoto(file);
                e.target.value = '';
              }}
              className="sr-only"
              data-testid="wizard-photo-input"
            />
            <span className="font-cormorant text-base italic text-encre/70">
              + Glisser ou choisir une photo
            </span>
            <span className="mt-1 text-xs text-encre/60">
              JPEG / PNG / WebP / HEIC · 5 Mo max · {3 - photos.length} restantes
            </span>
          </label>
        )}

        <p className="mt-3 text-xs italic text-encre/60">
          Mains, gestes, table de soin. Pour préserver l’intimité de la maison,
          nous ne publions pas de visage de face.
        </p>

        {hasFaceRejected && (
          <p
            role="alert"
            className="mt-2 bg-rose-50 p-2 text-xs text-rose-900"
            data-testid="wizard-face-rejected-notice"
          >
            Une de vos photos contient un visage. Voudriez-vous la remplacer ?
          </p>
        )}
      </fieldset>

      {submitError && (
        <p role="alert" className="bg-rose-50 p-3 text-sm text-rose-900">
          {submitError}
        </p>
      )}

      <div className="space-y-3">
        <button
          type="button"
          onClick={onContinue}
          disabled={submitting}
          data-testid="wizard-continue-2"
          className="block w-full bg-encre py-4 font-inter text-sm font-medium text-creme transition-colors hover:bg-encre-soft disabled:opacity-50"
        >
          Continuer →
        </button>
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="font-medium text-encre/70 hover:text-encre"
          >
            ← Retour
          </button>
          <button
            type="button"
            onClick={onSkip}
            disabled={submitting}
            data-testid="wizard-skip-2"
            className="font-medium text-encre/70 hover:text-encre"
          >
            Passer cette étape →
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Étape 3 — signature
// ---------------------------------------------------------------------------

function Step3({
  firstName,
  onFirstNameChange,
  city,
  onCityChange,
  month,
  onMonthChange,
  year,
  onYearChange,
  anonymous,
  onAnonymousChange,
  onSubmit,
  onBack,
  submitting,
  submitError,
}: {
  firstName: string;
  onFirstNameChange: (next: string) => void;
  city: string;
  onCityChange: (next: string) => void;
  month: number | null;
  onMonthChange: (next: number | null) => void;
  year: number | null;
  onYearChange: (next: number | null) => void;
  anonymous: boolean;
  onAnonymousChange: (next: boolean) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
  submitError: string | null;
}) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2023 }, (_, i) => 2024 + i);
  return (
    <div className="space-y-6" data-testid="wizard-step-3">
      <p className="font-cormorant text-lg text-encre">
        Comment souhaitez-vous signer ?
      </p>

      <div className="space-y-4">
        <label className="block">
          <span className="block text-sm text-encre">Prénom</span>
          <input
            type="text"
            value={firstName}
            onChange={(e) => onFirstNameChange(e.target.value)}
            maxLength={30}
            data-testid="wizard-first-name"
            className="mt-1 w-full border-[1.5px] border-sauge-soft bg-white px-3 py-2 font-inter text-sm text-encre focus:border-sauge-dark focus:outline-none"
            autoComplete="given-name"
          />
        </label>

        <label className="block">
          <span className="block text-sm text-encre">Ville</span>
          <select
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            data-testid="wizard-city"
            className="mt-1 w-full border-[1.5px] border-sauge-soft bg-white px-3 py-2 font-inter text-sm text-encre focus:border-sauge-dark focus:outline-none"
          >
            <option value="">— Choisir —</option>
            {RITUAL_CITY_CATALOG.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="block text-sm text-encre">Initiée depuis</span>
          <div className="mt-1 grid grid-cols-2 gap-3">
            <select
              value={month ?? ''}
              onChange={(e) => onMonthChange(e.target.value ? Number(e.target.value) : null)}
              data-testid="wizard-month"
              className="border-[1.5px] border-sauge-soft bg-white px-3 py-2 font-inter text-sm text-encre focus:border-sauge-dark focus:outline-none"
            >
              <option value="">— Mois —</option>
              {[
                'Janvier',
                'Février',
                'Mars',
                'Avril',
                'Mai',
                'Juin',
                'Juillet',
                'Août',
                'Septembre',
                'Octobre',
                'Novembre',
                'Décembre',
              ].map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={year ?? ''}
              onChange={(e) => onYearChange(e.target.value ? Number(e.target.value) : null)}
              data-testid="wizard-year"
              className="border-[1.5px] border-sauge-soft bg-white px-3 py-2 font-inter text-sm text-encre focus:border-sauge-dark focus:outline-none"
            >
              <option value="">— Année —</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 border-[1.5px] border-sauge-soft bg-white p-4 hover:bg-sauge-soft/40">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => onAnonymousChange(e.target.checked)}
            className="mt-1 h-4 w-4 accent-sauge-dark"
            data-testid="wizard-anonymous"
          />
          <span className="font-inter text-sm text-encre">
            Signer anonymement
            <span className="mt-1 block text-xs italic text-encre/60">
              (la maison gardera votre prénom en mémoire, mais publiera « Une initiée,
              {city ? ` ${city}` : ' votre ville'} »)
            </span>
          </span>
        </label>
      </div>

      {submitError && (
        <p role="alert" className="bg-rose-50 p-3 text-sm text-rose-900">
          {submitError}
        </p>
      )}

      <div className="space-y-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          data-testid="wizard-submit-final"
          className="block w-full bg-encre py-4 font-inter text-sm font-medium text-creme transition-colors hover:bg-encre-soft disabled:opacity-50"
        >
          {submitting ? 'Partage en cours…' : 'Partager mon rituel →'}
        </button>
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="font-medium text-encre/70 hover:text-encre"
          >
            ← Retour
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            data-testid="wizard-skip-3"
            className="font-medium text-encre/70 hover:text-encre"
          >
            Passer cette étape →
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirmation
// ---------------------------------------------------------------------------

function ConfirmationView({ onClose }: { onClose: () => void }) {
  return (
    <div className="py-16 text-center" data-testid="wizard-confirmation">
      <Fleuron size="md" tone="champagne" className="mb-6" />
      <p className="font-cormorant text-xl italic text-encre">
        Nous l’ouvrirons sous 24 à 48 heures.
      </p>
      <p className="mt-3 font-cormorant text-base italic text-encre/80">
        Vous recevrez un mot quand il sera publié.
      </p>
      <p className="mt-6 text-xs text-encre/60">Avec soin,</p>
      <p className="mt-1 font-inter text-sm font-medium text-encre">
        Souheila · FemiGlow
      </p>
      <Fleuron size="sm" tone="champagne" className="my-6" />
      <button
        type="button"
        onClick={onClose}
        className="border-t border-sauge-dark/40 pt-2 font-inter text-sm font-medium text-encre hover:text-sauge-dark"
      >
        Continuer la lecture
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal de reprise de brouillon
// ---------------------------------------------------------------------------

function DraftResumeModal({
  onResume,
  onRestart,
  onLater,
}: {
  onResume: () => void;
  onRestart: () => void;
  onLater: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Reprendre votre rituel ?"
      data-testid="wizard-draft-resume-modal"
      className="absolute inset-0 z-10 flex items-center justify-center bg-encre/40 p-4"
    >
      <div className="max-w-sm space-y-4 bg-creme p-6 shadow-lg">
        <Fleuron size="sm" tone="champagne" />
        <h3 className="font-cormorant text-lg text-encre">
          La maison a gardé votre rituel en mémoire.
        </h3>
        <p className="text-sm text-encre/70">Voulez-vous le reprendre ou recommencer ?</p>
        <div className="space-y-2">
          <button
            type="button"
            onClick={onResume}
            data-testid="wizard-draft-resume"
            className="block w-full bg-encre py-3 text-sm font-medium text-creme hover:bg-encre-soft"
          >
            Reprendre
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="block w-full text-sm font-medium text-encre/70 hover:text-encre"
          >
            Recommencer →
          </button>
          <button
            type="button"
            onClick={onLater}
            className="block w-full text-xs font-medium text-encre/50 hover:text-encre"
          >
            Plus tard →
          </button>
        </div>
      </div>
    </div>
  );
}
