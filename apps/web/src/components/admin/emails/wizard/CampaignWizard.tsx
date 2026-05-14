'use client';

/**
 * CampaignWizard — MVP 6 étapes.
 *
 * Spec complète (A/B variant, test send, auto-save, focus management,
 * keyboard shortcuts, exhaustive validations) : cf.
 *   docs/emailing/06-wizard-specification.md
 *
 * Cette V1 se concentre sur le happy path :
 *   1. Nom interne
 *   2. Audience (multi-select listes Listmonk)
 *   3. Template (sélection optionnelle + édition body HTML inline)
 *   4. Sujet + preheader
 *   5. Planification (now / scheduled date)
 *   6. Récap + envoi
 *
 * State client uniquement. La persistance draft est faite via
 * updateCampaignDraft() à chaque step transition (pas auto-save debounced).
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateCampaignDraft,
  finalizeCampaign,
} from '@/lib/admin/emails/wizard-actions';
import type { ListmonkListLite, ListmonkTemplateLite } from '@/lib/admin/emails/campaigns-queries';

type AudienceLite = {
  id: string;
  name: string;
  slug: string;
  snapshotCount: number;
};

type WizardProps = {
  draftId: string;
  initial: {
    name: string;
    subject: string;
    preheader: string | null;
    audienceLinkIds: number[];
    audienceId?: string | null;
    listmonkTemplateId: number | null;
    scheduledFor: string | null;
    payloadJson: Record<string, unknown>;
  };
  lists: ListmonkListLite[];
  templates: ListmonkTemplateLite[];
  audiences?: AudienceLite[];
  listmonkError: string | null;
};

type Step = 1 | 2 | 3 | 4 | 5 | 6;

export function CampaignWizard({ draftId, initial, lists, templates, audiences = [], listmonkError }: WizardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // form state
  const [name, setName] = useState(initial.name);
  const [audienceIds, setAudienceIds] = useState<number[]>(initial.audienceLinkIds);
  const [audienceId, setAudienceId] = useState<string | null>(initial.audienceId ?? null);
  const [audiencePreviewSize, setAudiencePreviewSize] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState<number | null>(initial.listmonkTemplateId);
  const [subject, setSubject] = useState(initial.subject);
  const [preheader, setPreheader] = useState(initial.preheader ?? '');
  const [bodyHtml, setBodyHtml] = useState(
    typeof (initial.payloadJson as { body?: string })?.body === 'string'
      ? ((initial.payloadJson as { body: string }).body)
      : `<p>Bonjour,</p>\n<p>Découvre nos dernières actualités.</p>\n<p>L'équipe FemiGlow ✨</p>`,
  );
  const [scheduleMode, setScheduleMode] = useState<'now' | 'scheduled'>(
    initial.scheduledFor ? 'scheduled' : 'now',
  );
  const [scheduledFor, setScheduledFor] = useState<string>(initial.scheduledFor ?? '');
  const [ack, setAck] = useState(false);

  function persistDraft(): void {
    startTransition(async () => {
      try {
        await updateCampaignDraft({
          id: draftId,
          name,
          subject,
          preheader,
          audienceLinkIds: audienceIds,
          audienceId,
          listmonkTemplateId: templateId,
          scheduledFor: scheduleMode === 'scheduled' && scheduledFor ? new Date(scheduledFor).toISOString() : null,
          payloadJson: { body: bodyHtml },
        });
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function validate(s: Step): string | null {
    if (s === 1 && name.trim().length < 3) return 'Le nom doit faire au moins 3 caractères.';
    if (s === 2 && audienceIds.length === 0 && !audienceId) return 'Sélectionne au moins une liste OU une audience.';
    if (s === 3 && bodyHtml.trim().length < 10) return 'Le corps du mail est trop court.';
    if (s === 4 && subject.trim().length < 3) return 'Le sujet doit faire au moins 3 caractères.';
    if (s === 5 && scheduleMode === 'scheduled' && !scheduledFor) return 'Choisis une date.';
    if (s === 5 && scheduleMode === 'scheduled' && new Date(scheduledFor) <= new Date()) return 'La date doit être dans le futur.';
    return null;
  }

  function goNext(): void {
    const err = validate(step);
    if (err) {
      setErrorMsg(err);
      return;
    }
    setErrorMsg(null);
    persistDraft();
    setStep((s) => Math.min(6, s + 1) as Step);
  }

  function goPrev(): void {
    setErrorMsg(null);
    setStep((s) => Math.max(1, s - 1) as Step);
  }

  function submit(): void {
    if (!ack) {
      setErrorMsg('Coche la case de confirmation avant d\'envoyer.');
      return;
    }
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await finalizeCampaign({
          id: draftId,
          sendNow: scheduleMode === 'now',
          listmonkTemplateId: templateId ?? undefined,
          bodyHtml,
        });
        router.push(`/admin/emails/campaigns/${draftId}`);
        router.refresh();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const estimatedAudience = audienceIds.reduce(
    (s, id) => s + (lists.find((l) => l.id === id)?.subscriberCount ?? 0),
    0,
  );

  return (
    <div className="mx-auto max-w-3xl">
      {/* Progress */}
      <ol className="mb-6 flex items-center gap-2 text-xs">
        {([1, 2, 3, 4, 5, 6] as Step[]).map((n, i) => (
          <li key={n} className="flex flex-1 items-center">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full font-semibold ${
                n < step
                  ? 'bg-emerald-100 text-emerald-700'
                  : n === step
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-200 text-stone-500'
              }`}
            >
              {n < step ? '✓' : n}
            </span>
            <span className={`ml-2 ${n === step ? 'font-medium text-stone-900' : 'text-stone-500'}`}>
              {['Nom', 'Audience', 'Contenu', 'Sujet', 'Planif.', 'Vérif.'][i]}
            </span>
            {i < 5 ? <span className="mx-2 h-px flex-1 bg-stone-200" /> : null}
          </li>
        ))}
      </ol>

      {listmonkError ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          ⚠ Listmonk : {listmonkError}
        </div>
      ) : null}

      <div className="rounded-lg border border-stone-200 bg-white p-6">
        {/* Step 1 */}
        {step === 1 ? (
          <div>
            <h2 className="text-lg font-semibold text-stone-900">1. Nom interne</h2>
            <p className="mt-1 text-sm text-stone-600">
              Pour t'y retrouver dans la liste. Non visible des destinataires.
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Bienvenue printemps 2026"
              className="mt-4 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
              autoFocus
            />
            <p className="mt-1 text-xs text-stone-500">{name.length}/120</p>
          </div>
        ) : null}

        {/* Step 2 */}
        {step === 2 ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-stone-900">2. Audience</h2>
              <p className="mt-1 text-sm text-stone-600">
                Choisis une <strong>audience FemiGlow</strong> (segmentation par règles, snapshot dynamique au send)
                ou une <strong>liste Listmonk</strong> (statique, opt-in manuel).
              </p>
            </div>

            {/* Audiences FemiGlow */}
            <section>
              <h3 className="mb-2 text-sm font-medium text-stone-700">🎯 Audiences FemiGlow (M5.3)</h3>
              {audiences.length === 0 ? (
                <p className="rounded border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
                  Aucune audience définie. Crée-en une dans <code>/admin/emails/audiences/new</code>.
                </p>
              ) : (
                <ul className="space-y-2">
                  {audiences.map((a) => {
                    const checked = audienceId === a.id;
                    return (
                      <li key={a.id}>
                        <label className="flex items-center gap-3 rounded border border-stone-200 p-3 hover:bg-stone-50">
                          <input
                            type="radio"
                            name="audience-choice"
                            checked={checked}
                            onChange={() => {
                              setAudienceId(a.id);
                              setAudienceIds([]);
                              // Fetch live preview size
                              setAudiencePreviewSize(null);
                              fetch(`/api/admin/emails/audiences/${a.id}`, { credentials: 'include' })
                                .then((r) => r.ok ? r.json() : null)
                                .then((data) => {
                                  if (!data) return;
                                  return fetch('/api/admin/emails/audiences/preview-size', {
                                    method: 'POST',
                                    headers: { 'content-type': 'application/json' },
                                    credentials: 'include',
                                    body: JSON.stringify({
                                      rules: data.rules,
                                      exclusionFlags: data.exclusionFlags,
                                    }),
                                  });
                                })
                                .then((r) => r?.ok ? r.json() : null)
                                .then((data) => {
                                  if (data && typeof data.size === 'number') setAudiencePreviewSize(data.size);
                                })
                                .catch(() => setAudiencePreviewSize(null));
                            }}
                          />
                          <div className="flex-1">
                            <p className="font-medium text-stone-900">🎯 {a.name}</p>
                            <p className="text-xs text-stone-500">
                              slug <code className="font-mono">{a.slug}</code> · {a.snapshotCount} snapshot(s)
                            </p>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Listmonk lists */}
            <section>
              <h3 className="mb-2 text-sm font-medium text-stone-700">📋 Listes Listmonk (legacy)</h3>
              {lists.length === 0 ? (
                <p className="rounded border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
                  Aucune liste Listmonk. Crée-en une dans <code>/admin/emails/listmonk</code>.
                </p>
              ) : (
                <ul className="space-y-2">
                  {lists.map((l) => {
                    const checked = audienceIds.includes(l.id);
                    return (
                      <li key={l.id}>
                        <label className="flex items-center gap-3 rounded border border-stone-200 p-3 hover:bg-stone-50">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAudienceIds([...audienceIds, l.id]);
                                setAudienceId(null);
                              } else {
                                setAudienceIds(audienceIds.filter((id) => id !== l.id));
                              }
                            }}
                          />
                          <div className="flex-1">
                            <p className="font-medium text-stone-900">{l.name}</p>
                            <p className="text-xs text-stone-500">
                              {l.subscriberCount} contacts · {l.type} · opt-in {l.optin}
                            </p>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <p className="rounded bg-stone-50 p-3 text-sm">
              Envois estimés :{' '}
              <strong>
                {audienceId
                  ? (audiencePreviewSize ?? '…')
                  : estimatedAudience}
              </strong>
              {audienceId && audiencePreviewSize !== null && (
                <span className="ml-2 text-xs text-stone-500">(snapshot dynamique au moment du send)</span>
              )}
            </p>
          </div>
        ) : null}

        {/* Step 3 */}
        {step === 3 ? (
          <div>
            <h2 className="text-lg font-semibold text-stone-900">3. Contenu</h2>
            <p className="mt-1 text-sm text-stone-600">
              Corps HTML du mail. Tu peux partir d'un template existant ou éditer directement.
            </p>
            <label className="mt-4 block">
              <span className="block text-xs font-medium text-stone-600">Template Listmonk (optionnel)</span>
              <select
                value={templateId ?? ''}
                onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : null)}
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              >
                <option value="">— Aucun (corps libre) —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.type})
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block">
              <span className="block text-xs font-medium text-stone-600">Corps HTML</span>
              <textarea
                rows={10}
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 font-mono text-xs"
              />
            </label>
          </div>
        ) : null}

        {/* Step 4 */}
        {step === 4 ? (
          <div>
            <h2 className="text-lg font-semibold text-stone-900">4. Sujet & preheader</h2>
            <label className="mt-4 block">
              <span className="block text-xs font-medium text-stone-600">Sujet (idéal 30-50 chars)</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
                placeholder="✨ Découvre nos rituels printemps"
              />
              <span className="text-xs text-stone-500">{subject.length}/140</span>
            </label>
            <label className="mt-4 block">
              <span className="block text-xs font-medium text-stone-600">
                Preheader (visible juste après le sujet dans Gmail/Outlook)
              </span>
              <input
                type="text"
                value={preheader}
                onChange={(e) => setPreheader(e.target.value)}
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
                placeholder="Une sélection douce pour cette saison"
              />
              <span className="text-xs text-stone-500">{preheader.length}/200</span>
            </label>
            <div className="mt-6 rounded-md border border-stone-200 bg-stone-50 p-3">
              <p className="text-xs uppercase tracking-wider text-stone-500">Aperçu boîte de réception</p>
              <p className="mt-1 font-medium text-stone-900">FemiGlow</p>
              <p className="text-sm font-medium">{subject || '(sujet vide)'}</p>
              <p className="text-xs text-stone-600">{preheader || '(preheader vide)'}</p>
            </div>
          </div>
        ) : null}

        {/* Step 5 */}
        {step === 5 ? (
          <div>
            <h2 className="text-lg font-semibold text-stone-900">5. Planification</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label
                className={`cursor-pointer rounded border p-3 ${scheduleMode === 'now' ? 'border-stone-900 bg-stone-50' : 'border-stone-200'}`}
              >
                <input
                  type="radio"
                  name="schedule"
                  checked={scheduleMode === 'now'}
                  onChange={() => setScheduleMode('now')}
                  className="mr-2"
                />
                <span className="font-medium">Envoyer maintenant</span>
                <p className="mt-1 text-xs text-stone-500">Déclenchement immédiat à la validation.</p>
              </label>
              <label
                className={`cursor-pointer rounded border p-3 ${scheduleMode === 'scheduled' ? 'border-stone-900 bg-stone-50' : 'border-stone-200'}`}
              >
                <input
                  type="radio"
                  name="schedule"
                  checked={scheduleMode === 'scheduled'}
                  onChange={() => setScheduleMode('scheduled')}
                  className="mr-2"
                />
                <span className="font-medium">Planifier</span>
                <p className="mt-1 text-xs text-stone-500">Choisis date + heure.</p>
              </label>
            </div>
            {scheduleMode === 'scheduled' ? (
              <input
                type="datetime-local"
                value={scheduledFor.slice(0, 16)}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="mt-4 rounded-md border border-stone-300 px-3 py-2 text-sm"
              />
            ) : null}
            <p className="mt-4 rounded bg-stone-50 p-3 text-sm">
              Estimation envoi total : <strong>{estimatedAudience} emails</strong>
            </p>
          </div>
        ) : null}

        {/* Step 6 */}
        {step === 6 ? (
          <div>
            <h2 className="text-lg font-semibold text-stone-900">6. Vérification finale</h2>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <Field label="Nom" value={name} />
              <Field
                label="Audience"
                value={
                  audienceId
                    ? `🎯 ${audiences.find((a) => a.id === audienceId)?.name ?? audienceId.slice(0, 8)} · ~${audiencePreviewSize ?? '…'} envois (snapshot au send)`
                    : `${audienceIds.length} liste${audienceIds.length > 1 ? 's' : ''} · ~${estimatedAudience} envois`
                }
              />
              <Field label="Template" value={templateId ? `Listmonk #${templateId}` : 'Corps libre'} />
              <Field label="Sujet" value={subject} />
              <Field label="Preheader" value={preheader || '—'} />
              <Field
                label="Planification"
                value={
                  scheduleMode === 'now'
                    ? 'Envoi immédiat'
                    : scheduledFor
                      ? new Date(scheduledFor).toLocaleString('fr-FR')
                      : '(non choisi)'
                }
              />
            </dl>
            <div className="mt-6 rounded-md border border-stone-200 bg-white p-3">
              <p className="mb-2 text-xs uppercase tracking-wider text-stone-500">Aperçu corps</p>
              <iframe
                title="Aperçu"
                srcDoc={`<!doctype html><html><body style="font-family:system-ui;padding:1rem">${bodyHtml}</body></html>`}
                sandbox=""
                className="h-64 w-full rounded border border-stone-200 bg-white"
              />
            </div>
            <label className="mt-6 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              Je confirme avoir relu le contenu et que l'envoi est légitime.
            </label>
          </div>
        ) : null}

        {errorMsg ? (
          <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {errorMsg}
          </p>
        ) : null}
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={goPrev}
          disabled={step === 1 || pending}
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 disabled:opacity-40"
        >
          ← Précédent
        </button>
        {step < 6 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={pending}
            className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Suivant →
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!ack || pending}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {pending ? 'Envoi…' : scheduleMode === 'now' ? '📨 Envoyer maintenant' : '📅 Planifier'}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-xs uppercase tracking-wider text-stone-500">{label}</dt>
      <dd className="col-span-2 text-stone-800">{value || '—'}</dd>
    </>
  );
}
