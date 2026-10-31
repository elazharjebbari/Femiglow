/**
 * MediaSetEditorDrawer — édition d'une cellule (slot × audience × langue).
 *
 * Le formulaire part du brouillon de la cellule, sinon de sa version
 * publiée (ou programmée) : modifier puis enregistrer crée un brouillon.
 *
 *  - Images : `MediaPickerDrawer` (médiathèque), liste triable plafonnée au
 *    `maxItems` de la politique (`single` = 1), version mobile 3:4, alt
 *    FR/AR/EN, point focal, cadrage (`SortableMediaList`).
 *  - « Images sans texte » (`crossLocale`), notes.
 *  - Cycle de vie : Enregistrer le brouillon (`PUT /draft` + `If-Match` =
 *    `updatedAt` du brouillon chargé), Publier, Programmer (`ScheduleDialog`),
 *    Annuler la programmation, Dépublier, Abandonner le brouillon
 *    (confirmation dans la page), Historique (restaurer → brouillon),
 *    Copier vers…, Aperçu.
 *  - 409 → `MediaSetConflictDialog` ; 422 → problèmes affichés en ligne.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.7
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { slotMaxItems } from '@/lib/components/media-variants/policy';
import { useToast } from '@/components/admin/legal/Toast';
import { MediaPickerDrawer, type PickedMedia } from '../MediaPickerDrawer';
import { ScheduleDialog } from '../fields/ScheduleDialog';
import { MediaSetApiError, type MediaSetsApi } from './api';
import {
  emptyForm,
  formFingerprint,
  formFromSet,
  newUid,
  toDraftPayload,
  type EditorForm,
  type EditorItem,
} from './editor-model';
import {
  STUCK_REASON_LABEL,
  WILDCARD,
  cellTitle,
  coverageCellFor,
  formatParis,
  indexSets,
  inheritanceFor,
  matrixRows,
  slotDescription,
  statusPills,
  tupleKey,
  type TupleSets,
} from './model';
import { CopyToDialog } from './CopyToDialog';
import { MediaSetConflictDialog, type MediaSetConflictState } from './MediaSetConflictDialog';
import { MediaSetHistoryPanel } from './MediaSetHistoryPanel';
import { MediaSetPreviewDialog } from './MediaSetPreviewDialog';
import { SortableMediaList } from './SortableMediaList';
import type {
  AdminMediaSetJson,
  MediaSetHistoryEntryJson,
  MediaSetIssueJson,
  MediaSetsListResponse,
  MediaSetTuple,
} from './types';
import { Pill, btn } from './ui';

const IMAGE_ONLY = ['image'] as const;

/** Problème de validation, rattaché à une image par son identité (uid) et non par son rang. */
export type ItemIssue = MediaSetIssueJson & { uid?: string };

/** `items[i]` → uid de l'image envoyée en position `i` (stable après réordonnancement). */
function attachIssues(issues: MediaSetIssueJson[], sentUids: readonly string[]): ItemIssue[] {
  return issues.map((iss) =>
    iss.path[0] === 'items' && typeof iss.path[1] === 'number' && sentUids[iss.path[1]]
      ? { ...iss, uid: sentUids[iss.path[1]] }
      : iss,
  );
}

type PickerTarget = { mode: 'add' } | { mode: 'mobile'; uid: string };

type PendingConfirm =
  | { kind: 'discard' }
  | { kind: 'unpublish' }
  | { kind: 'close' }
  | { kind: 'restore'; entry: MediaSetHistoryEntryJson };

const CONFIRM_TEXT: Record<PendingConfirm['kind'], { message: string; action: string }> = {
  discard: {
    message:
      'Abandonner le brouillon ? Ses images et réglages sont supprimés (il reste restaurable depuis l’historique).',
    action: 'Abandonner le brouillon',
  },
  unpublish: {
    message:
      'Dépublier cette cellule ? Les visiteuses verront aussitôt le niveau de repli suivant (autre langue, défaut ou galerie actuelle).',
    action: 'Dépublier',
  },
  close: {
    message: 'Des modifications ne sont pas enregistrées. Fermer sans enregistrer ?',
    action: 'Fermer sans enregistrer',
  },
  restore: {
    message: 'Restaurer cette version en brouillon ? Le brouillon actuel et vos modifications non enregistrées seront remplacés.',
    action: 'Restaurer en brouillon',
  },
};

interface Props {
  /** Cellule ouverte ; `null` = tiroir fermé. */
  tuple: MediaSetTuple | null;
  data: MediaSetsListResponse;
  api: MediaSetsApi;
  /** Page publique de l'aperçu (`kit`). */
  pagePath: string;
  activeLegacySlots: ReadonlySet<string>;
  onClose: () => void;
  /** Recharge la liste ; renvoie la nouvelle réponse (ou `null` en cas d'échec). */
  onRefresh: () => Promise<MediaSetsListResponse | null>;
}

function thumbIndex(sets: readonly AdminMediaSetJson[]): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const s of sets) {
    for (const i of s.items) {
      if (i.media) map.set(i.mediaId, i.media.thumbUrl);
      if (i.mobileMediaId && i.mobileMedia) map.set(i.mobileMediaId, i.mobileMedia.thumbUrl);
    }
  }
  return map;
}

function baseSet(entry: TupleSets | undefined): AdminMediaSetJson | null {
  return entry?.draft ?? entry?.published ?? entry?.scheduled ?? null;
}

function sourceKeyOf(entry: TupleSets | undefined): string {
  const s = baseSet(entry);
  return s ? `${s.id}@${s.updatedAt}` : 'none';
}

export function MediaSetEditorDrawer({
  tuple,
  data,
  api,
  pagePath,
  activeLegacySlots,
  onClose,
  onRefresh,
}: Props): JSX.Element {
  const toast = useToast();
  const open = tuple !== null;
  const key = tuple ? tupleKey(tuple) : '';

  const setsByTuple = useMemo(() => indexSets(data.sets), [data.sets]);
  const thumbs = useMemo(() => thumbIndex(data.sets), [data.sets]);
  const rows = useMemo(() => matrixRows(data.dimensions), [data.dimensions]);
  const entry = tuple ? setsByTuple.get(key) : undefined;
  const draft = entry?.draft ?? null;
  const published = entry?.published ?? null;
  const scheduled = entry?.scheduled ?? null;
  const slotPolicy = tuple ? data.policy.slots.find((s) => s.key === tuple.slot) : undefined;
  const maxItems = slotPolicy ? slotMaxItems(slotPolicy) : 1;
  const stuck = data.stuckScheduled.find((s) => scheduled && s.setId === scheduled.id) ?? null;
  const stuckIds = useMemo(() => new Set(data.stuckScheduled.map((s) => s.setId)), [data.stuckScheduled]);

  const [form, setForm] = useState<EditorForm>(emptyForm);
  const [baseline, setBaseline] = useState<string>(() => formFingerprint(emptyForm()));
  const [loadedSource, setLoadedSource] = useState<string>('none');
  /** `updatedAt` du brouillon sur lequel repose le formulaire (If-Match). */
  const [ifMatch, setIfMatch] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<ItemIssue[]>([]);
  const [conflict, setConflict] = useState<MediaSetConflictState | null>(null);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  /**
   * Dernier brouillon enregistré depuis ce tiroir (réponse du `PUT`), en
   * attendant que la liste rechargée le reflète : sert de cible (et
   * d'`If-Match`) si la publication ou la programmation qui suit échoue.
   */
  const [localDraft, setLocalDraft] = useState<AdminMediaSetJson | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  /** Cellule courante : une réponse arrivée après un changement de cellule est ignorée. */
  const keyRef = useRef(key);
  keyRef.current = key;
  /** Ordre des images (uid) au moment de l'envoi : rattache les erreurs 422 `items[i]`. */
  const sentUidsRef = useRef<string[]>([]);

  const dirty = formFingerprint(form) !== baseline;
  const currentDraft =
    localDraft && (!draft || Date.parse(localDraft.updatedAt) >= Date.parse(draft.updatedAt))
      ? localDraft
      : draft;

  const resetFrom = useCallback(
    (e: TupleSets | undefined, thumbMap: ReadonlyMap<string, string | null>) => {
      const next = formFromSet(baseSet(e), thumbMap);
      setForm(next);
      setBaseline(formFingerprint(next));
      setLoadedSource(sourceKeyOf(e));
      setIfMatch(e?.draft?.updatedAt ?? null);
      setLocalDraft(null);
    },
    [],
  );

  // Nouvelle cellule : repartir de son état serveur.
  useEffect(() => {
    if (!tuple) return;
    resetFrom(setsByTuple.get(key), thumbs);
    setError(null);
    setIssues([]);
    setConfirm(null);
    setHistoryOpen(false);
    setPicker(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Liste rechargée (autre onglet, autre action) : resynchroniser si rien
  // n'est en cours d'édition.
  useEffect(() => {
    if (!tuple || dirty) return;
    if (sourceKeyOf(entry) !== loadedSource) resetFrom(entry, thumbs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, thumbs]);

  useEffect(() => {
    if (confirm) confirmBtnRef.current?.focus();
  }, [confirm]);

  // Modifications non enregistrées : prévenir avant de quitter la page.
  useEffect(() => {
    if (!open || !dirty) return undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [open, dirty]);

  /** Recharge la liste puis l'état de la cellule ; renvoie la nouvelle entrée. */
  async function refreshCell(): Promise<TupleSets | undefined> {
    const startedFor = key;
    const fresh = await onRefresh();
    if (!fresh || !tuple || keyRef.current !== startedFor) return undefined;
    const e = indexSets(fresh.sets).get(key);
    resetFrom(e, thumbIndex(fresh.sets));
    setHistoryTick((t) => t + 1);
    return e;
  }

  function localSnapshot(): MediaSetConflictState['local'] {
    return { thumbs: form.items.map((i) => i.thumbUrl), crossLocale: form.crossLocale };
  }

  function handleError(action: string, e: unknown, canOverwrite: boolean, startedFor = key): void {
    // Réponse d'une autre cellule (changement pendant la requête) : ignorée.
    if (keyRef.current !== startedFor) return;
    if (e instanceof MediaSetApiError) {
      if (e.isConflict) {
        const { current, remoteUpdatedAt } = e.remote;
        setConflict({ action, local: localSnapshot(), remote: current, remoteUpdatedAt, canOverwrite });
        return;
      }
      if (e.issues.length > 0) setIssues(attachIssues(e.issues, sentUidsRef.current));
      setError(e.message);
      toast.push('error', `${action} : ${e.message}`);
      return;
    }
    const msg = (e as Error)?.message ?? 'Erreur inattendue';
    setError(msg);
    toast.push('error', `${action} : ${msg}`);
  }

  async function run(action: string, fn: () => Promise<void>, canOverwrite = false): Promise<boolean> {
    const startedFor = key;
    setBusy(action);
    setError(null);
    setIssues([]);
    sentUidsRef.current = form.items.map((i) => i.uid);
    try {
      await fn();
      return true;
    } catch (e) {
      handleError(action, e, canOverwrite, startedFor);
      return false;
    } finally {
      setBusy(null);
    }
  }

  /**
   * Enregistre le formulaire. `matchAt` = `updatedAt` du brouillon sur
   * lequel repose le formulaire (`If-Match`), jamais celui d'une liste
   * rechargée entre-temps : une écriture d'un autre onglet doit donner un
   * 409. `null` = aucun brouillon connu (`If-None-Match: *`).
   * Succès : le formulaire devient la référence (plus « modifié ») et le
   * brouillon enregistré sert d'`If-Match` aux actions suivantes, même si
   * la publication qui suit échoue.
   */
  async function saveDraft(matchAt: string | null = ifMatch): Promise<AdminMediaSetJson> {
    const startedFor = key;
    const snapshot = form;
    sentUidsRef.current = snapshot.items.map((i) => i.uid);
    const res = await api.saveDraft(toDraftPayload(tuple!, snapshot), matchAt);
    if (keyRef.current === startedFor) {
      setLocalDraft(res.set);
      setIfMatch(res.set.updatedAt);
      setBaseline(formFingerprint(snapshot));
    }
    return res.set;
  }

  /** Brouillon à jour (enregistré si besoin) pour publier ou programmer. */
  async function ensureDraft(): Promise<AdminMediaSetJson> {
    if (!dirty && currentDraft) return currentDraft;
    return saveDraft();
  }

  const onSave = () =>
    run(
      'Enregistrer le brouillon',
      async () => {
        await saveDraft();
        await refreshCell();
        toast.push('success', 'Brouillon enregistré.');
      },
      true,
    );

  const onPublish = () =>
    run('Publier', async () => {
      const target = !dirty && !currentDraft && scheduled ? scheduled : await ensureDraft();
      const res = await api.publish(target.id, target.updatedAt);
      await refreshCell();
      toast.push('success', `Publié (v${res.set.version}). Le site est à jour.`);
    });

  const onScheduleConfirm = async (iso: string) => {
    // `ScheduleDialog` n'a pas d'état occupé : un double clic ne repart pas.
    if (busy !== null) return;
    setScheduleError(null);
    setBusy('Programmer');
    setError(null);
    setIssues([]);
    try {
      const target = await ensureDraft();
      await api.schedule(target.id, iso, target.updatedAt);
      setScheduleOpen(false);
      await refreshCell();
      toast.push('success', `Publication programmée le ${formatParis(iso, 'long')}.`);
    } catch (e) {
      // Date refusée ou programmation concurrente : erreur dans la modale ;
      // conflit ou validation : la modale se ferme, le tiroir explique.
      if (e instanceof MediaSetApiError && !e.isConflict && e.issues.length === 0) {
        setScheduleError(e.message);
      } else {
        setScheduleOpen(false);
        handleError('Programmer', e, false);
      }
    } finally {
      setBusy(null);
    }
  };

  const onCancelSchedule = () =>
    run('Annuler la programmation', async () => {
      await api.cancelSchedule(scheduled!.id, scheduled!.updatedAt);
      await refreshCell();
      toast.push('success', 'Programmation annulée : l’ensemble redevient un brouillon.');
    });

  async function onConfirmPending(): Promise<void> {
    const pending = confirm;
    setConfirm(null);
    if (!pending) return;
    if (pending.kind === 'close') {
      closeDrawer();
      return;
    }
    if (pending.kind === 'discard' && currentDraft) {
      await run('Abandonner le brouillon', async () => {
        await api.discard(currentDraft.id, ifMatch ?? currentDraft.updatedAt);
        await refreshCell();
        toast.push('success', 'Brouillon abandonné.');
      });
    }
    if (pending.kind === 'unpublish' && published) {
      await run('Dépublier', async () => {
        await api.unpublish(published.id, published.updatedAt);
        await refreshCell();
        toast.push('success', 'Cellule dépubliée : le repli s’applique.');
      });
    }
    if (pending.kind === 'restore') {
      await run('Restaurer', async () => {
        // Sans brouillon connu : `If-None-Match: *` (409 s'il en est apparu un).
        const res = await api.restore(pending.entry.id, ifMatch);
        await refreshCell();
        toast.push('success', `Version ${res.restoredFromVersion} restaurée en brouillon.`);
      });
    }
  }

  async function onCopy(target: MediaSetTuple): Promise<void> {
    setCopyError(null);
    setBusy('Copier');
    try {
      // Brouillon cible connu → `If-Match` ; sinon `If-None-Match: *`.
      const targetDraft = setsByTuple.get(tupleKey(target))?.draft ?? null;
      await api.saveDraft(toDraftPayload(target, form), targetDraft?.updatedAt ?? null);
      await onRefresh();
      setCopyOpen(false);
      toast.push('success', `Brouillon créé dans ${cellTitle(target, target.locale, target.slot, data.dimensions)}.`);
    } catch (e) {
      const msg =
        e instanceof MediaSetApiError && e.isConflict
          ? 'Le brouillon de la cellule cible vient d’être modifié. Rechargez puis recommencez.'
          : e instanceof MediaSetApiError && e.issues.length > 0
            ? `${e.message} : ${e.issues.map((i) => i.message).join(' ; ')}`
            : (e as Error).message;
      setCopyError(msg);
    } finally {
      setBusy(null);
    }
  }

  async function onConflictReload(): Promise<void> {
    setConflict(null);
    await refreshCell();
  }

  async function onConflictOverwrite(): Promise<void> {
    const c = conflict;
    setConflict(null);
    if (!c) return;
    const matchAt = c.remote && c.remote.status === 'draft' ? (c.remoteUpdatedAt ?? c.remote.updatedAt) : null;
    await run(
      'Enregistrer le brouillon',
      async () => {
        await saveDraft(matchAt);
        await refreshCell();
        toast.push('success', 'Brouillon enregistré (version serveur remplacée).');
      },
      true,
    );
  }

  function onPick(mediaId: string, media: PickedMedia): void {
    const target = picker;
    setPicker(null);
    if (!target) return;
    if (target.mode === 'mobile') {
      setForm((f) => ({
        ...f,
        items: f.items.map((i) =>
          i.uid === target.uid
            ? { ...i, mobileMediaId: mediaId, mobileThumbUrl: media.thumbUrl, mobileState: 'ok' }
            : i,
        ),
      }));
      return;
    }
    const item: EditorItem = {
      uid: newUid(),
      mediaId,
      thumbUrl: media.thumbUrl,
      libraryAlt: media.alt,
      state: 'ok',
      mobileMediaId: null,
      mobileThumbUrl: null,
      mobileState: null,
      alt: { fr: '', ar: '', en: '' },
      objectPosition: null,
      focalX: null,
      focalY: null,
    };
    setForm((f) => ({
      ...f,
      // Slot `single` : l'image choisie remplace l'actuelle.
      items: maxItems === 1 ? [item] : [...f.items, item].slice(0, maxItems),
    }));
  }

  function closeDrawer(): void {
    // Enregistré puis action échouée : la liste n'a pas encore ce brouillon
    // (rouvrir la cellule le ferait paraître perdu).
    if (localDraft) void onRefresh();
    onClose();
  }

  function requestClose(): void {
    // Pas de fermeture pendant une requête : sa réponse doit être affichée.
    if (busy !== null) return;
    if (dirty) setConfirm({ kind: 'close' });
    else closeDrawer();
  }

  const subUiOpen = picker !== null || scheduleOpen;
  const isBusy = busy !== null;
  // Ces actions rechargent la cellule : elles effaceraient le formulaire modifié.
  const saveFirstHint = dirty ? 'Enregistrez d’abord vos modifications' : undefined;
  const canAdd = form.items.length < maxItems || maxItems === 1;
  const hasItems = form.items.length > 0;
  const generalIssues = issues.filter((i) => !i.uid);
  const pills = statusPills(entry, stuckIds);
  const inheritance =
    tuple && tuple.locale !== WILDCARD
      ? inheritanceFor(
          coverageCellFor(
            data.coverage.cells,
            { variantDim: tuple.variantDim, variantKey: tuple.variantKey },
            tuple.locale,
            tuple.slot,
          ),
          slotPolicy,
          activeLegacySlots,
        )
      : null;
  const title = tuple ? cellTitle(tuple, tuple.locale, tuple.slot, data.dimensions) : '';
  const basedOn = baseSet(entry);

  return (
    <RadixDialog.Root open={open} onOpenChange={(o) => (!o ? requestClose() : undefined)}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-stone-900/40" />
        <RadixDialog.Content
          onEscapeKeyDown={(e) => {
            // Échap ferme d'abord le sélecteur ou la programmation ; jamais
            // pendant une requête.
            if (subUiOpen || isBusy) e.preventDefault();
            else if (dirty) {
              e.preventDefault();
              setConfirm({ kind: 'close' });
            }
          }}
          onInteractOutside={(e) => {
            if (subUiOpen || isBusy) e.preventDefault();
          }}
          className="fixed inset-y-0 right-0 z-40 flex w-full max-w-3xl flex-col border-l border-stone-200 bg-white shadow-xl focus:outline-none"
        >
          {tuple ? (
            <>
              <header className="border-b border-stone-200 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-stone-500">Médias par audience</p>
                    <RadixDialog.Title className="text-lg font-semibold text-stone-900">{title}</RadixDialog.Title>
                    <RadixDialog.Description className="mt-0.5 text-xs text-stone-500">
                      {slotPolicy ? slotDescription(slotPolicy, maxItems) : tuple.slot}
                      {basedOn
                        ? ` · formulaire basé sur ${
                            basedOn.status === 'draft'
                              ? 'le brouillon'
                              : basedOn.status === 'published'
                                ? `la version publiée v${basedOn.version}`
                                : 'la programmation'
                          }`
                        : ' · aucun ensemble pour cette cellule'}
                    </RadixDialog.Description>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {pills.map((p) => (
                        <Pill key={p.label} pill={p} />
                      ))}
                      {!published && inheritance && inheritance.kind !== 'own' ? (
                        <span className="text-[11px] text-sky-700">
                          Aujourd’hui : {inheritance.kind === 'inherited' ? inheritance.label : `repli — ${inheritance.label}`}
                        </span>
                      ) : null}
                      {dirty ? (
                        <span role="status" className="text-[11px] font-medium text-amber-700">
                          Modifications non enregistrées
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={requestClose}
                    className={btn('secondary')}
                    aria-label="Fermer l’éditeur"
                    disabled={isBusy}
                  >
                    Fermer
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btn('secondary')}
                    onClick={() => setPreviewOpen(true)}
                    aria-describedby={dirty ? 'hmv-preview-hint' : undefined}
                  >
                    Aperçu
                  </button>
                  <button
                    type="button"
                    className={btn('secondary')}
                    aria-expanded={historyOpen}
                    aria-controls="hmv-history"
                    onClick={() => setHistoryOpen((v) => !v)}
                  >
                    Historique
                  </button>
                  <button
                    type="button"
                    className={btn('secondary')}
                    onClick={() => {
                      setCopyError(null);
                      setCopyOpen(true);
                    }}
                    disabled={!hasItems || isBusy}
                  >
                    Copier vers…
                  </button>
                </div>
                {dirty ? (
                  <p id="hmv-preview-hint" className="mt-2 text-[11px] text-stone-500">
                    L’aperçu montre les brouillons enregistrés : enregistrez pour y voir vos modifications.
                  </p>
                ) : null}
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {stuck ? (
                  <p role="alert" className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    Programmation bloquée (prévue le {formatParis(stuck.scheduledAt, 'long')}) :{' '}
                    {STUCK_REASON_LABEL[stuck.reason]}. Annulez-la, corrigez le brouillon puis reprogrammez.
                  </p>
                ) : null}

                {error ? (
                  <div role="alert" className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    <p className="font-medium">{error}</p>
                    {generalIssues.length > 0 ? (
                      <ul role="list" className="mt-1 list-disc pl-5 text-xs">
                        {generalIssues.map((iss, i) => (
                          <li key={`${iss.code}-${i}`}>{iss.message}</li>
                        ))}
                      </ul>
                    ) : null}
                    {issues.length > generalIssues.length ? (
                      <p className="mt-1 text-xs">Voir les images signalées ci-dessous.</p>
                    ) : null}
                  </div>
                ) : null}

                <section aria-labelledby="hmv-items-title">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 id="hmv-items-title" className="text-sm font-semibold text-stone-900">
                      Images{' '}
                      <span className="font-normal text-stone-500">
                        ({form.items.length} / {maxItems})
                      </span>
                    </h3>
                    <button
                      type="button"
                      className={btn('primary')}
                      onClick={() => setPicker({ mode: 'add' })}
                      disabled={isBusy || !canAdd}
                    >
                      {maxItems === 1 && hasItems ? 'Remplacer l’image' : 'Ajouter une image'}
                    </button>
                  </div>
                  {!canAdd ? (
                    <p className="mb-2 text-xs text-stone-500">Maximum atteint pour ce slot ({maxItems} images).</p>
                  ) : null}
                  {hasItems ? (
                    <SortableMediaList
                      items={form.items}
                      cellLocale={tuple.locale}
                      disabled={isBusy}
                      issues={issues}
                      onChange={(items) => setForm((f) => ({ ...f, items }))}
                      onPickMobile={(uid) => setPicker({ mode: 'mobile', uid })}
                    />
                  ) : (
                    <p className="rounded-md border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-500">
                      Aucune image. Ajoutez-en une depuis la médiathèque.
                    </p>
                  )}
                </section>

                <section aria-label="Options de l’ensemble" className="mt-5 flex flex-col gap-3">
                  <label className="flex items-start gap-2 text-sm text-stone-800">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={form.crossLocale}
                      disabled={isBusy}
                      onChange={(e) => setForm((f) => ({ ...f, crossLocale: e.target.checked }))}
                      aria-describedby="hmv-cross-help"
                    />
                    <span>
                      Images sans texte, réutilisables dans les autres langues
                      <span id="hmv-cross-help" className="block text-xs text-stone-500">
                        Un ensemble FR coché sert aussi aux langues sans ensemble propre (niveaux 3 et 6 de la
                        chaîne de repli).
                      </span>
                    </span>
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium text-stone-700">
                    Notes internes
                    <textarea
                      value={form.notes}
                      maxLength={400}
                      rows={2}
                      disabled={isBusy}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      className="rounded-md border border-stone-300 px-2 py-1.5 text-sm font-normal text-stone-900 focus:border-stone-900 focus:outline-none"
                    />
                  </label>
                </section>

                {historyOpen ? (
                  <div id="hmv-history" className="mt-5">
                    <MediaSetHistoryPanel
                      api={api}
                      tuple={tuple}
                      reloadTick={historyTick}
                      busy={isBusy}
                      onRestore={(entryToRestore) => setConfirm({ kind: 'restore', entry: entryToRestore })}
                    />
                  </div>
                ) : null}
              </div>

              <footer className="border-t border-stone-200 bg-stone-50 px-5 py-3">
                {confirm ? (
                  <div
                    role="alertdialog"
                    aria-labelledby="hmv-confirm-text"
                    className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2"
                  >
                    <p id="hmv-confirm-text" className="min-w-0 flex-1 text-sm text-amber-900">
                      {CONFIRM_TEXT[confirm.kind].message}
                    </p>
                    <button type="button" className={btn('secondary')} onClick={() => setConfirm(null)}>
                      Annuler
                    </button>
                    <button
                      ref={confirmBtnRef}
                      type="button"
                      className={btn(confirm.kind === 'restore' ? 'primary' : 'dangerSolid')}
                      onClick={() => void onConfirmPending()}
                    >
                      {CONFIRM_TEXT[confirm.kind].action}
                    </button>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={btn('secondary')}
                    onClick={() => void onSave()}
                    disabled={isBusy || !dirty || !hasItems}
                  >
                    {busy === 'Enregistrer le brouillon' ? 'Enregistrement…' : 'Enregistrer le brouillon'}
                  </button>
                  <button
                    type="button"
                    className={btn('primary')}
                    onClick={() => void onPublish()}
                    disabled={isBusy || !hasItems || !(dirty || currentDraft || scheduled)}
                  >
                    {busy === 'Publier'
                      ? 'Publication…'
                      : !dirty && !currentDraft && scheduled
                        ? 'Publier la programmation maintenant'
                        : 'Publier'}
                  </button>
                  {scheduled ? (
                    <button
                      type="button"
                      className={btn('secondary')}
                      onClick={() => void onCancelSchedule()}
                      disabled={isBusy || dirty}
                      title={saveFirstHint}
                    >
                      Annuler la programmation
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={btn('secondary')}
                      onClick={() => {
                        setScheduleError(null);
                        setScheduleOpen(true);
                      }}
                      disabled={isBusy || !hasItems || !(dirty || currentDraft)}
                    >
                      Programmer
                    </button>
                  )}
                  <span className="flex-1" />
                  {published ? (
                    <button
                      type="button"
                      className={btn('danger')}
                      onClick={() => setConfirm({ kind: 'unpublish' })}
                      disabled={isBusy || dirty}
                      title={saveFirstHint}
                    >
                      Dépublier
                    </button>
                  ) : null}
                  {currentDraft ? (
                    <button
                      type="button"
                      className={btn('danger')}
                      onClick={() => setConfirm({ kind: 'discard' })}
                      disabled={isBusy}
                    >
                      Abandonner le brouillon
                    </button>
                  ) : null}
                </div>
                {scheduled && scheduled.scheduledAt && !stuck ? (
                  <p className="mt-2 text-xs text-stone-500">
                    Publication programmée le {formatParis(scheduled.scheduledAt, 'long')}.
                  </p>
                ) : null}
                <p className="sr-only" aria-live="polite">
                  {busy ? `${busy} en cours…` : ''}
                </p>
              </footer>

              {picker ? (
                <MediaPickerDrawer
                  slotKey={tuple.slot}
                  slotLabel={
                    picker.mode === 'mobile' ? `${title} — version mobile 3:4` : title
                  }
                  acceptKinds={IMAGE_ONLY}
                  onClose={() => setPicker(null)}
                  onPick={onPick}
                />
              ) : null}

              <ScheduleDialog
                open={scheduleOpen}
                fieldLabel={title}
                initialScheduledAt={null}
                error={scheduleError}
                onCancel={() => setScheduleOpen(false)}
                onConfirm={(iso) => void onScheduleConfirm(iso)}
              />

              <MediaSetConflictDialog
                conflict={conflict}
                thumbFor={(id) => thumbs.get(id) ?? null}
                busy={isBusy}
                onClose={() => setConflict(null)}
                onReload={() => void onConflictReload()}
                onOverwrite={() => void onConflictOverwrite()}
              />

              <CopyToDialog
                open={copyOpen}
                source={tuple}
                rows={rows}
                locales={data.locales}
                dimensions={data.dimensions}
                setsByTuple={setsByTuple}
                itemCount={form.items.length}
                busy={isBusy}
                error={copyError}
                onClose={() => setCopyOpen(false)}
                onConfirm={(target) => void onCopy(target)}
              />

              <MediaSetPreviewDialog
                open={previewOpen}
                tuple={tuple}
                api={api}
                dimensions={data.dimensions}
                pagePath={pagePath}
                onClose={() => setPreviewOpen(false)}
              />
            </>
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
