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
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateCampaignDraft,
  finalizeCampaign,
  sendCampaignTest,
  saveWizardProgress,
} from '@/lib/admin/emails/wizard-actions';
import type { SaveWizardProgressInput } from '@/lib/admin/emails/campaigns-shared';
import type { ListmonkListLite, ListmonkTemplateLite } from '@/lib/admin/emails/campaigns-queries';
import { EntityCombobox, type ComboboxOption } from '@/components/admin/emails/common/EntityCombobox';
import { LeadEmailCombobox } from '@/components/admin/emails/common/combobox-wrappers';
import { Banner, DEFAULT_TIMEZONE } from '@/components/admin/emails/ui';
import { useCampaignAutosave, type AutosavePatch } from './use-campaign-autosave';
import { AutosaveIndicator } from './AutosaveIndicator';

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
  /** Étape de reprise (wizard_step déjà normalisé côté serveur) ; défaut 1. */
  initialStep?: number;
  /** Révision payload (`_rev`) connue au chargement — optimistic-lock ; défaut 0. */
  initialRev?: number;
  lists: ListmonkListLite[];
  templates: ListmonkTemplateLite[];
  audiences?: AudienceLite[];
  listmonkError: string | null;
  /** E-mail de l'admin de session — préremplit le champ test-send (UX-CAMP-001). */
  adminEmail?: string;
};

type Step = 1 | 2 | 3 | 4 | 5 | 6;

/** Borne défensive d'un numéro d'étape arbitraire vers le type Step (1..6). */
function clampStep(n: number): Step {
  if (!Number.isFinite(n)) return 1;
  return Math.min(6, Math.max(1, Math.trunc(n))) as Step;
}

export function CampaignWizard({ draftId, initial, initialStep = 1, initialRev = 0, lists, templates, audiences = [], listmonkError, adminEmail = '' }: WizardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(clampStep(initialStep));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // `useTransition`'s `pending` revient à false dès le premier `await` d'un
  // callback async (React 18) → inutilisable pour verrouiller la soumission de
  // finalisation (risque de double-envoi au double-clic). On suit donc l'état
  // d'envoi explicitement, posé AVANT l'await et levé en finally.
  const [sending, setSending] = useState(false);

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

  // UX-CAMP-007 — recherche d'audience / de liste (combobox filtrant la liste
  // affichée ; les radios/checkboxes restent la source de vérité de sélection).
  const [audienceQuery, setAudienceQuery] = useState('');
  const [listQuery, setListQuery] = useState('');

  // UX-CAMP-013 — état explicite du fetch d'estimation d'audience FemiGlow.
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  // UX-CAMP-001 — test-send (épreuve à une adresse).
  const [testEmail, setTestEmail] = useState(adminEmail);
  const [testSending, setTestSending] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // ── Autosave (F05 P3.2-c) ──────────────────────────────────────────────────
  // `updateCampaignDraft` reste le CHECKPOINT validé au passage d'étape (contrat
  // CMP-MSW-003/012). `saveWizardProgress` AJOUTE un filet debounced en cours de
  // frappe : patch partiel (U-033), optimistic-lock par `_rev`, et persistance du
  // `wizard_step` pour la reprise. `save` est mémoïsé (draftId stable) ; le hook
  // le lit via une ref → schedule/flush restent stables (pas de re-arm du debounce).
  const save = useCallback(
    (patch: AutosavePatch & { expectedRev?: number }) =>
      saveWizardProgress({ id: draftId, ...patch } as SaveWizardProgressInput),
    [draftId],
  );
  const autosave = useCampaignAutosave({ save, initialRev });

  /**
   * Patch d'autosave = état courant des champs persistables. On OMET `name` tant
   * qu'il fait < 3 caractères (le schéma exige min 3) → l'autosave d'un nom en
   * cours de frappe n'échoue jamais ; les autres champs continuent d'être sauvés.
   */
  function buildPatch(stepArg: Step): AutosavePatch {
    const patch: AutosavePatch = {
      subject,
      preheader,
      audienceLinkIds: audienceIds,
      audienceId: audienceId ?? null,
      listmonkTemplateId: templateId,
      scheduledFor:
        scheduleMode === 'scheduled' && scheduledFor ? new Date(scheduledFor).toISOString() : null,
      scheduleTimezone: DEFAULT_TIMEZONE,
      wizardStep: stepArg,
      payloadJson: { body: bodyHtml },
    };
    if (name.trim().length >= 3) patch.name = name;
    return patch;
  }

  // Filet debounced sur la frappe IN-STEP. Le passage d'étape (goNext/goPrev)
  // flush explicitement avec le nouveau `wizard_step` → `step` n'est PAS une dép
  // ici (sinon double-save juste après le flush). `didMount` évite un save au
  // montage : l'état initial est exactement celui de la DB.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    autosave.schedule(buildPatch(step));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, subject, preheader, audienceIds, audienceId, templateId, scheduleMode, scheduledFor, bodyHtml]);

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
    const next = Math.min(6, step + 1) as Step;
    setStep(next);
    // Checkpoint reprise : persiste tout de suite le wizard_step atteint (sinon
    // une fermeture < debounce perdrait le pointeur d'étape).
    autosave.schedule(buildPatch(next));
    void autosave.flush();
  }

  function goPrev(): void {
    setErrorMsg(null);
    const prev = Math.max(1, step - 1) as Step;
    setStep(prev);
    autosave.schedule(buildPatch(prev));
    void autosave.flush();
  }

  function submit(): void {
    if (!ack) {
      setErrorMsg('Coche la case de confirmation avant d\'envoyer.');
      return;
    }
    // UX-CAMP-011 — interdiction d'envoyer en masse sans connaître le nombre de
    // destinataires (estimation FemiGlow encore en cours / en échec).
    if (!estimateKnown) {
      setErrorMsg('Attends l\'estimation du nombre de destinataires avant d\'envoyer.');
      return;
    }
    // Garde anti double-soumission : un envoi déjà en cours ne peut pas être
    // relancé (le `sending` est posé synchroniquement avant tout await).
    if (sending) return;
    setErrorMsg(null);
    setSending(true);
    void (async () => {
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
        setSending(false);
      }
    })();
  }

  const estimatedAudience = audienceId
    ? (audiencePreviewSize ?? 0)
    : audienceIds.reduce(
        (s, id) => s + (lists.find((l) => l.id === id)?.subscriberCount ?? 0),
        0,
      );

  // UX-CAMP-013 — un fetch d'estimation centralisé qui expose loading/erreur.
  // L'oracle anti-faux-total : sur échec on laisse `audiencePreviewSize` à null
  // (jamais 0) et on lève `previewError` pour un message actionnable.
  async function loadAudiencePreview(id: string, signal?: AbortSignal): Promise<void> {
    setPreviewLoading(true);
    setPreviewError(false);
    try {
      const r = await fetch(`/api/admin/emails/audiences/${id}`, { credentials: 'include', signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const r2 = await fetch('/api/admin/emails/audiences/preview-size', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        signal,
        body: JSON.stringify({ rules: data.rules, exclusionFlags: data.exclusionFlags }),
      });
      if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
      const out = await r2.json();
      if (typeof out.size !== 'number') throw new Error('Réponse invalide');
      if (!signal?.aborted) setAudiencePreviewSize(out.size);
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) return;
      setAudiencePreviewSize(null);
      setPreviewError(true);
    } finally {
      if (!signal?.aborted) setPreviewLoading(false);
    }
  }

  // Hydrate preview size when an audience is already selected on mount (e.g.
  // user reloads or jumps directly to step 5/6 without re-touching the radio).
  useEffect(() => {
    if (!audienceId || audiencePreviewSize !== null) return;
    const controller = new AbortController();
    void loadAudiencePreview(audienceId, controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceId, audiencePreviewSize]);

  // UX-CAMP-007 — filtres de recherche appliqués aux listes affichées.
  const filteredAudiences = useMemo(() => {
    const q = audienceQuery.trim().toLowerCase();
    if (!q) return audiences;
    return audiences.filter(
      (a) => a.name.toLowerCase().includes(q) || a.slug.toLowerCase().includes(q),
    );
  }, [audiences, audienceQuery]);

  const filteredLists = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    if (!q) return lists;
    return lists.filter((l) => l.name.toLowerCase().includes(q));
  }, [lists, listQuery]);

  const selectedTemplate = templateId != null ? templates.find((t) => t.id === templateId) : undefined;

  // UX-CAMP-011 — l'estimation est-elle connue ? (bloque l'envoi sinon).
  const estimateKnown = audienceId ? audiencePreviewSize !== null : true;
  // Libellé chiffré pour la case de confirmation (jamais « … » : si inconnu, la
  // case ET le bouton d'envoi sont bloqués par `estimateKnown`).
  const confirmCountLabel = estimateKnown ? String(estimatedAudience) : '…';

  // UX-CAMP-001 — déclenche l'envoi de test (épreuve).
  function submitTest(): void {
    setTestFeedback(null);
    if (testSending) return;
    setTestSending(true);
    void (async () => {
      try {
        const res = await sendCampaignTest({ id: draftId, email: testEmail, subject, bodyHtml });
        if (res.ok) {
          setTestFeedback({ ok: true, msg: `Épreuve envoyée à ${res.email}.` });
        } else {
          setTestFeedback({ ok: false, msg: res.error });
        }
      } catch (err) {
        setTestFeedback({ ok: false, msg: err instanceof Error ? err.message : String(err) });
      } finally {
        setTestSending(false);
      }
    })();
  }

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

      {/* Conflit multi-onglets : un autre onglet/session a écrit ce brouillon.
          L'autosave est figé (jamais d'écrasement) → on invite à recharger. */}
      {autosave.status === 'conflict' ? (
        <Banner
          tone="danger"
          className="mb-4"
          data-testid="autosave-conflict"
          action={
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="font-medium underline"
            >
              Recharger
            </button>
          }
        >
          Cette campagne a été modifiée ailleurs (autre onglet ou session). Recharge la page pour
          repartir de la dernière version enregistrée — tes modifications non sauvegardées ici
          seront perdues.
        </Banner>
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
                <>
                  {/* UX-CAMP-007 — recherche d'audience : filtre la liste de radios
                      ci-dessous (les radios restent la source de sélection). */}
                  <div className="mb-3">
                    <EntityCombobox
                      value={audienceQuery}
                      onChange={setAudienceQuery}
                      ariaLabel="Rechercher une audience"
                      placeholder="Rechercher une audience…"
                      minChars={1}
                      allowFreeText
                      fetchSuggestions={async (q) => {
                        const needle = q.toLowerCase();
                        return audiences
                          .filter(
                            (a) =>
                              a.name.toLowerCase().includes(needle) ||
                              a.slug.toLowerCase().includes(needle),
                          )
                          .slice(0, 20)
                          .map<ComboboxOption>((a) => ({
                            value: a.name,
                            label: a.name,
                            hint: a.slug,
                          }));
                      }}
                    />
                  </div>
                  {filteredAudiences.length === 0 ? (
                    <p className="rounded border border-stone-200 bg-stone-50 p-3 text-xs text-stone-500">
                      Aucune audience ne correspond à « {audienceQuery} ».
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {filteredAudiences.map((a) => {
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
                                  setAudiencePreviewSize(null);
                                  void loadAudiencePreview(a.id);
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
                </>
              )}
            </section>

            {/* Listmonk lists */}
            <section>
              <h3 className="mb-2 text-sm font-medium text-stone-700">📋 Listes Listmonk (legacy)</h3>
              {lists.length === 0 ? (
                listmonkError ? (
                  // LMK-04 : ne PAS conseiller de « créer une liste » quand la
                  // vacuité vient d'une panne Listmonk — dire la vérité.
                  <p
                    role="alert"
                    className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
                  >
                    ⚠ Listmonk est indisponible — les listes ne peuvent pas être chargées (
                    {listmonkError}). Vous pouvez utiliser une audience FemiGlow ci-dessus.
                  </p>
                ) : (
                  <p className="rounded border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
                    Aucune liste Listmonk. Crée-en une dans <code>/admin/emails/listmonk</code>.
                  </p>
                )
              ) : (
                <>
                  <div className="mb-3">
                    <EntityCombobox
                      value={listQuery}
                      onChange={setListQuery}
                      ariaLabel="Rechercher une liste Listmonk"
                      placeholder="Rechercher une liste…"
                      minChars={1}
                      allowFreeText
                      fetchSuggestions={async (q) => {
                        const needle = q.toLowerCase();
                        return lists
                          .filter((l) => l.name.toLowerCase().includes(needle))
                          .slice(0, 20)
                          .map<ComboboxOption>((l) => ({
                            value: l.name,
                            label: l.name,
                            hint: `${l.subscriberCount} contacts`,
                          }));
                      }}
                    />
                  </div>
                  {filteredLists.length === 0 ? (
                    <p className="rounded border border-stone-200 bg-stone-50 p-3 text-xs text-stone-500">
                      Aucune liste ne correspond à « {listQuery} ».
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {filteredLists.map((l) => {
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
                </>
              )}
            </section>

            {/* UX-CAMP-013 — feedback d'erreur d'estimation (actionnable). */}
            {previewError ? (
              <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                Impossible d’estimer la taille de l’audience (API indisponible).{' '}
                {audienceId ? (
                  <button
                    type="button"
                    onClick={() => void loadAudiencePreview(audienceId)}
                    className="font-medium underline"
                  >
                    Réessayer
                  </button>
                ) : null}
              </p>
            ) : null}

            <p className="rounded bg-stone-50 p-3 text-sm">
              Envois estimés :{' '}
              <strong>
                {audienceId
                  ? previewLoading
                    ? '…'
                    : (audiencePreviewSize ?? '…')
                  : estimatedAudience}
              </strong>
              {audienceId && previewLoading ? (
                <span role="status" className="ml-2 text-xs text-stone-500">Estimation en cours…</span>
              ) : null}
              {audienceId && audiencePreviewSize !== null && !previewLoading && (
                <span className="ml-2 text-xs text-stone-500">(snapshot dynamique au moment du send)</span>
              )}
              {/* UX-CAMP-010 — annotation borne haute multi-listes (sur-comptage). */}
              {!audienceId && audienceIds.length > 1 && (
                <span className="ml-2 block text-xs text-amber-700">
                  ⚠ Borne haute : les doublons inter-listes ne sont pas déduits ici ; Listmonk dédoublonne à l’envoi.
                </span>
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
            {/* UX-CAMP-007 — template Listmonk via combobox recherchable. La
                valeur portée est le NOM du template (label visible) ; l'id réel
                est résolu en sélection. Un bouton « Aucun » remet en corps libre. */}
            <div className="mt-4">
              <span className="block text-xs font-medium text-stone-600">Template Listmonk (optionnel)</span>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1">
                  <EntityCombobox
                    value={selectedTemplate?.name ?? ''}
                    onChange={(v) => {
                      const match = templates.find((t) => t.name === v);
                      setTemplateId(match ? match.id : null);
                    }}
                    ariaLabel="Template Listmonk"
                    placeholder="Rechercher un template…"
                    minChars={0}
                    allowFreeText={false}
                    fetchSuggestions={async (q) => {
                      const needle = q.toLowerCase();
                      return templates
                        .filter((t) => !needle || t.name.toLowerCase().includes(needle))
                        .slice(0, 20)
                        .map<ComboboxOption>((t) => ({
                          value: t.name,
                          label: t.name,
                          hint: t.type,
                        }));
                    }}
                  />
                </div>
                {templateId != null ? (
                  <button
                    type="button"
                    onClick={() => setTemplateId(null)}
                    className="rounded-md border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
                  >
                    Aucun (corps libre)
                  </button>
                ) : null}
              </div>
              {selectedTemplate ? (
                <p className="mt-1 text-xs text-stone-500">
                  Template sélectionné : <strong>{selectedTemplate.name}</strong> (#{selectedTemplate.id}).
                  Le corps ci-dessous est inséré dans l’enveloppe du template à l’envoi.
                </p>
              ) : null}
            </div>

            {/* UX-CAMP-008 — aperçu du template Listmonk sélectionné. */}
            {selectedTemplate ? (
              <div className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-3">
                <p className="mb-2 text-xs uppercase tracking-wider text-stone-500">
                  Aperçu template « {selectedTemplate.name} »
                </p>
                <iframe
                  title="Aperçu template"
                  data-testid="template-preview"
                  srcDoc={`<!doctype html><html><body style="font-family:system-ui;padding:1rem"><p style="color:#78716c;font-size:12px">Sujet template : ${escapeHtml(selectedTemplate.subject || '(défini par la campagne)')}</p>${bodyHtml}</body></html>`}
                  sandbox=""
                  className="h-48 w-full rounded border border-stone-200 bg-white"
                />
              </div>
            ) : null}

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
              {audienceId && (
                <span className="ml-2 text-xs text-stone-500">(snapshot dynamique au moment du send)</span>
              )}
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

            {/* UX-CAMP-001 — Envoyer une épreuve (test-send). */}
            <div className="mt-6 rounded-md border border-stone-200 bg-stone-50 p-3">
              <p className="text-xs uppercase tracking-wider text-stone-500">Envoyer un test</p>
              <p className="mt-1 text-xs text-stone-600">
                Reçois une épreuve dans ta boîte avant l’envoi de masse. (Requiert un template Listmonk.)
              </p>
              <div className="mt-2 flex items-start gap-2">
                <div className="flex-1">
                  <LeadEmailCombobox
                    value={testEmail}
                    onChange={setTestEmail}
                    ariaLabel="Adresse e-mail du test"
                    placeholder="toi@femiglow-maroc.com"
                  />
                </div>
                <button
                  type="button"
                  onClick={submitTest}
                  disabled={testSending || testEmail.trim().length === 0}
                  className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 disabled:opacity-40"
                >
                  {testSending ? 'Envoi du test…' : 'Envoyer le test'}
                </button>
              </div>
              {testFeedback ? (
                <p
                  role={testFeedback.ok ? 'status' : 'alert'}
                  className={`mt-2 rounded-md border p-2 text-sm ${
                    testFeedback.ok
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-rose-200 bg-rose-50 text-rose-700'
                  }`}
                >
                  {testFeedback.msg}
                </p>
              ) : null}
            </div>

            {/* UX-CAMP-010/011 — confirmation chiffrée + garde estimation. */}
            {!estimateKnown ? (
              <p role="status" className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                ⏳ Estimation des destinataires en cours… l’envoi est bloqué tant que le nombre n’est pas connu.
              </p>
            ) : null}
            <label className="mt-6 flex items-start gap-2 text-sm">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              <span>
                Je confirme l’envoi à <strong data-testid="confirm-count">~{confirmCountLabel}</strong>{' '}
                destinataire{estimatedAudience > 1 ? 's' : ''} après relecture du contenu, et que cet envoi est
                légitime.
                {!audienceId && audienceIds.length > 1 ? (
                  <span className="block text-xs text-amber-700">
                    (borne haute multi-listes — doublons non déduits)
                  </span>
                ) : null}
              </span>
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
      <div className="mt-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={goPrev}
          disabled={step === 1 || pending}
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 disabled:opacity-40"
        >
          ← Précédent
        </button>
        <AutosaveIndicator status={autosave.status} savedAt={autosave.savedAt} />
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
            disabled={!ack || sending || pending || !estimateKnown}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {sending ? 'Envoi…' : scheduleMode === 'now' ? '📨 Envoyer maintenant' : '📅 Planifier'}
          </button>
        )}
      </div>
    </div>
  );
}

/** Échappement HTML minimal pour injection sûre dans le srcDoc d'aperçu. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-xs uppercase tracking-wider text-stone-500">{label}</dt>
      <dd className="col-span-2 text-stone-800">{value || '—'}</dd>
    </>
  );
}
