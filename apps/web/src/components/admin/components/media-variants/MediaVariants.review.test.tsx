/**
 * RTL + MSW — correctifs de revue de la PR 6 (médias par audience) :
 * If-Match après un enregistrement suivi d'un échec, fermeture bloquée et
 * réponses ignorées après changement de cellule, `If-None-Match: *`,
 * rafraîchissements ordonnés, plan revu du bulk, point focal au clavier,
 * erreurs 422 rattachées à l'image, roving tabindex, `beforeunload`.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse, server } from '@/test/msw/server';
import {
  MEDIA_SETS_COMPONENT,
  makeAdminSet,
  setupMediaSetsScenario,
} from '@/test/msw/media-sets-handlers';
import { KIT_HERO_MEDIA_VARIANTS } from '@/lib/components/registry';
import { MediaVariantsSection } from './MediaVariantsSection';
import { MediaSetEditorDrawer } from './MediaSetEditorDrawer';
import { mediaSetsApi, type MediaSetsApi } from './api';
import type { MediaSetsListResponse } from './types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  const realFetch = globalThis.fetch;
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const { signal: _signal, ...rest } = init ?? {};
    return realFetch(input, rest);
  });
});
afterEach(() => {
  server.resetHandlers();
  vi.unstubAllGlobals();
});
afterAll(() => server.close());

const matrixButton = (name: RegExp) => screen.getByRole('button', { name, hidden: true });

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

function scenarioWith(...args: Parameters<typeof setupMediaSetsScenario>) {
  const sc = setupMediaSetsScenario(...args);
  server.use(...sc.handlers);
  return sc;
}

function renderSection(api?: MediaSetsApi) {
  return render(
    <MediaVariantsSection
      componentKey={MEDIA_SETS_COMPONENT}
      policy={KIT_HERO_MEDIA_VARIANTS}
      activeLegacySlots={['primary']}
      {...(api ? { api } : {})}
    />,
  );
}

async function openCell(name: RegExp) {
  fireEvent.click(await screen.findByRole('button', { name }));
  return screen.findByRole('dialog', { name: /·/ });
}

const validation422 = () =>
  HttpResponse.json(
    {
      error: {
        code: 'validation_failed',
        message: 'Ensemble de médias invalide',
        details: { issues: [{ code: 'item.media_unavailable', path: ['items', 0, 'mediaId'], message: 'Média pas prêt' }] },
      },
    },
    { status: 422 },
  );

describe('1 — enregistrement réussi puis échec de publication', () => {
  it('le réessai publie le brouillon enregistré (If-Match à jour), sans faux 409', async () => {
    const sc = scenarioWith({ sets: [makeAdminSet({ id: 'p', locale: 'fr' })] });
    server.use(http.post('*/media-sets/:setId/publish', validation422, { once: true }));
    renderSection();
    const dialog = await openCell(/^Défaut · FR · primary — publié v1/);
    fireEvent.change(within(dialog).getByLabelText('Alt FR — image 1'), { target: { value: 'nouveau' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publier' }));
    await within(dialog).findByText('Ensemble de médias invalide');
    expect(sc.callsTo('PUT', '/draft')).toHaveLength(1);
    const saved = sc.state.sets.find((s) => s.status === 'draft')!;
    const savedAt = saved.updatedAt;
    // Plus « modifié » : le formulaire est la référence enregistrée.
    expect(within(dialog).queryByText('Modifications non enregistrées')).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Publier' }));
    await waitFor(() => expect(sc.callsTo('POST', `/${saved.id}/publish`)).toHaveLength(1));
    expect(sc.callsTo('POST', `/${saved.id}/publish`)[0]!.ifMatch).toBe(savedAt);
    expect(sc.callsTo('PUT', '/draft')).toHaveLength(1);
    expect(screen.queryByRole('dialog', { name: 'Conflit de version' })).toBeNull();
  });

  it('après l’échec, un nouvel enregistrement part avec If-Match = brouillon enregistré', async () => {
    const sc = scenarioWith({ sets: [makeAdminSet({ id: 'p', locale: 'fr' })] });
    server.use(http.post('*/media-sets/:setId/publish', validation422, { once: true }));
    renderSection();
    const dialog = await openCell(/^Défaut · FR · primary — publié v1/);
    fireEvent.change(within(dialog).getByLabelText('Alt FR — image 1'), { target: { value: 'a' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publier' }));
    await within(dialog).findByText('Ensemble de médias invalide');
    const savedAt = sc.state.sets.find((s) => s.status === 'draft')!.updatedAt;

    fireEvent.change(within(dialog).getByLabelText('Alt FR — image 1'), { target: { value: 'b' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() => expect(sc.callsTo('PUT', '/draft')).toHaveLength(2));
    const second = sc.callsTo('PUT', '/draft')[1]!;
    expect(second.ifMatch).toBe(savedAt);
    expect(second.ifNoneMatch).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Conflit de version' })).toBeNull();
  });
});

describe('2 — requêtes en cours et changement de cellule', () => {
  it('fermeture impossible (bouton, Échap) tant qu’une requête est en cours', async () => {
    scenarioWith({ sets: [makeAdminSet({ id: 'd', locale: 'fr', status: 'draft' })] });
    const gate = deferred();
    server.use(
      http.put('*/media-sets/draft', async () => {
        await gate.promise;
        // Rien renvoyé : la requête passe au handler du scénario.
      }),
    );
    renderSection();
    const dialog = await openCell(/^Défaut · FR · primary/);
    fireEvent.change(within(dialog).getByLabelText('Alt FR — image 1'), { target: { value: 'x' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Fermer l’éditeur' })).toBeDisabled());
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Défaut · FR · primary' })).toBeInTheDocument();
    await act(async () => gate.resolve());
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Fermer l’éditeur' })).toBeEnabled());
    expect(screen.getByRole('dialog', { name: 'Défaut · FR · primary' })).toBeInTheDocument();
  });

  it('réponse arrivée après un changement de cellule : ignorée (ni erreur ni formulaire écrasé)', async () => {
    scenarioWith({
      sets: [
        makeAdminSet({ id: 'a', locale: 'fr', status: 'draft', mediaIds: ['me_a'] }),
        makeAdminSet({ id: 'b', locale: 'ar', status: 'draft', mediaIds: ['me_b'], alt: { ar: 'نص ب' } }),
      ],
    });
    const gate = deferred();
    server.use(
      http.put('*/media-sets/draft', async () => {
        await gate.promise;
        return validation422();
      }),
    );
    const api = mediaSetsApi(MEDIA_SETS_COMPONENT);
    const data = await api.list();
    const props = {
      data,
      api,
      pagePath: 'kit',
      activeLegacySlots: new Set<string>(),
      onClose: () => undefined,
      onRefresh: () => api.list() as Promise<MediaSetsListResponse | null>,
    };
    const { rerender } = render(
      <MediaSetEditorDrawer {...props} tuple={{ slot: 'primary', variantDim: 'default', variantKey: '*', locale: 'fr' }} />,
    );
    const dialog = await screen.findByRole('dialog', { name: 'Défaut · FR · primary' });
    fireEvent.change(within(dialog).getByLabelText('Alt FR — image 1'), { target: { value: 'A' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le brouillon' }));

    rerender(<MediaSetEditorDrawer {...props} tuple={{ slot: 'primary', variantDim: 'default', variantKey: '*', locale: 'ar' }} />);
    const other = await screen.findByRole('dialog', { name: 'Défaut · AR · primary' });
    await act(async () => gate.resolve());
    await waitFor(() => expect(within(other).getByRole('button', { name: 'Fermer l’éditeur' })).toBeEnabled());
    expect(within(other).queryByText('Ensemble de médias invalide')).toBeNull();
    expect(within(other).getByLabelText('Alt AR — image 1')).toHaveValue('نص ب');
    expect(within(other).getByLabelText('Alt FR — image 1')).toHaveValue('');
  });
});

describe('4 — If-None-Match: * quand le formulaire ne part pas d’un brouillon', () => {
  it('un brouillon apparu entre-temps → 409 (modale), puis « Écraser » avec If-Match serveur', async () => {
    const sc = scenarioWith({ sets: [makeAdminSet({ id: 'p', locale: 'fr' })] });
    renderSection();
    const dialog = await openCell(/^Défaut · FR · primary — publié v1/);
    // Un autre onglet crée un brouillon sur la même cellule.
    const remote = makeAdminSet({ id: 'remote', locale: 'fr', status: 'draft', mediaIds: ['me_r'] });
    sc.state.sets.push(remote);
    const remoteAt = remote.updatedAt;
    fireEvent.change(within(dialog).getByLabelText('Alt FR — image 1'), { target: { value: 'local' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le brouillon' }));
    const modal = await screen.findByRole('dialog', { name: 'Conflit de version' });
    expect(sc.callsTo('PUT', '/draft')[0]!.ifNoneMatch).toBe('*');
    expect(remote.items[0]!.mediaId).toBe('me_r'); // non écrasé
    fireEvent.click(within(modal).getByRole('button', { name: 'Écraser avec ma version' }));
    await waitFor(() => expect(sc.callsTo('PUT', '/draft')).toHaveLength(2));
    expect(sc.callsTo('PUT', '/draft')[1]!.ifMatch).toBe(remoteAt);
  });

  it('restaurer sans brouillon local : If-None-Match: *', async () => {
    const sc = scenarioWith({ sets: [makeAdminSet({ id: 'p', locale: 'fr', mediaIds: ['me_old'] })] });
    sc.state.history.push({
      id: 'h1',
      setId: 'old',
      version: 1,
      status: 'published',
      action: 'publish',
      crossLocale: false,
      actorId: null,
      notes: null,
      createdAt: '2026-10-01T08:00:00.000Z',
      items: [{ position: 0, mediaId: 'me_h', mobileMediaId: null, alt: {}, objectPosition: null, focalX: null, focalY: null, thumbUrl: null, mobileThumbUrl: null }],
      tuple: 'primary|default|*|fr',
    });
    renderSection();
    const dialog = await openCell(/^Défaut · FR · primary/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Historique' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: /^Restaurer la version 1/ }));
    fireEvent.click(within(within(dialog).getByRole('alertdialog')).getByRole('button', { name: 'Restaurer en brouillon' }));
    await waitFor(() => expect(sc.callsTo('POST', '/restore')).toHaveLength(1));
    expect(sc.callsTo('POST', '/restore')[0]!.ifNoneMatch).toBe('*');
    expect(sc.callsTo('POST', '/restore')[0]!.ifMatch).toBeNull();
  });
});

describe('5 — rafraîchissements non ordonnés', () => {
  it('une réponse de liste plus ancienne arrivée en dernier est ignorée', async () => {
    const sc = scenarioWith({ sets: [makeAdminSet({ id: 'pb', variantDim: 'angle', variantKey: 'b', locale: 'fr' })] });
    const real = mediaSetsApi(MEDIA_SETS_COMPONENT);
    const gate = deferred();
    let calls = 0;
    const api: MediaSetsApi = {
      ...real,
      list: async () => {
        calls += 1;
        if (calls !== 2) return real.list();
        const stale = await real.list(); // état AVANT l'enregistrement
        await gate.promise;
        return stale;
      },
    };
    renderSection(api);
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' })); // appel 2, retenu
    await waitFor(() => expect(calls).toBe(2));
    const dialog = await openCell(/^Angle B · FR · primary — publié v1/);
    fireEvent.change(within(dialog).getByLabelText('Alt FR — image 1'), { target: { value: 'récent' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() => expect(sc.callsTo('PUT', '/draft')).toHaveLength(1));
    // Appel 3 (après l'enregistrement) : la matrice montre le brouillon.
    await waitFor(() => expect(matrixButton(/^Angle B · FR · primary — publié v1, brouillon/)).toBeInTheDocument());
    // L'appel 2, plus ancien, répond en dernier : ignoré.
    await act(async () => gate.resolve());
    await act(async () => undefined);
    expect(matrixButton(/^Angle B · FR · primary — publié v1, brouillon/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Alt FR — image 1')).toHaveValue('récent');
  });
});

describe('6 — publication en masse : plan revu', () => {
  it('la liste a changé entre l’essai et la confirmation : rien n’est publié, nouvelle liste à confirmer', async () => {
    const sc = scenarioWith({
      sets: [
        makeAdminSet({ id: 'imp1', variantDim: 'angle', variantKey: 'a', locale: '*', status: 'draft', source: 'import' }),
        makeAdminSet({ id: 'imp2', variantDim: 'angle', variantKey: 'b', locale: '*', status: 'draft', source: 'import' }),
      ],
    });
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'Publier les brouillons importés (2)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Publier les brouillons importés' });
    await within(dialog).findByRole('list', { name: 'Ensembles qui seront publiés' });
    sc.state.sets.push(
      makeAdminSet({ id: 'imp3', variantDim: 'angle', variantKey: 'c', locale: '*', status: 'draft', source: 'import' }),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publier 2 ensembles' }));
    expect(await within(dialog).findByText(/La liste des brouillons importés a changé/)).toBeInTheDocument();
    expect(sc.state.sets.filter((s) => s.status === 'published')).toHaveLength(0);
    const list = await within(dialog).findByRole('list', { name: 'Ensembles qui seront publiés' });
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(3));

    fireEvent.click(within(dialog).getByRole('button', { name: 'Publier 3 ensembles' }));
    expect(await within(dialog).findByText(/ensembles publiés/)).toBeInTheDocument();
    expect(sc.state.sets.filter((s) => s.status === 'published')).toHaveLength(3);
  });
});

describe('7 & 9 — clavier, erreurs par image, roving tabindex, beforeunload', () => {
  it('activation clavier du point focal : focus sur le champ X, aucune valeur posée', async () => {
    scenarioWith({ sets: [makeAdminSet({ id: 'd', locale: 'fr', status: 'draft' })] });
    renderSection();
    const dialog = await openCell(/^Défaut · FR · primary/);
    // `fireEvent.click` = `detail: 0`, comme Entrée/Espace sur un bouton.
    fireEvent.click(within(dialog).getByRole('button', { name: /^Placer le point focal de l’image 1/ }));
    expect(document.activeElement).toBe(within(dialog).getByLabelText('Point focal X (%) — image 1'));
    expect(within(dialog).getByLabelText('Point focal X (%) — image 1')).toHaveValue(null);
    expect(within(dialog).queryByText('Modifications non enregistrées')).toBeNull();
  });

  it('une erreur 422 suit son image après réordonnancement', async () => {
    const sc = scenarioWith({
      sets: [makeAdminSet({ id: 'd', slot: 'secondary', locale: 'fr', status: 'draft', mediaIds: ['me_1', 'me_2'] })],
    });
    renderSection();
    const dialog = await openCell(/^Défaut · FR · secondary/);
    fireEvent.change(within(dialog).getByLabelText('Alt FR — image 1'), { target: { value: 'x' } });
    sc.failNext({
      kind: 'validation',
      issues: [{ code: 'item.media_unavailable', path: ['items', 1, 'mediaId'], message: 'Média supprimé : me_2' }],
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le brouillon' }));
    const second = await within(dialog).findByRole('listitem', { name: 'Image 2 sur 2' });
    await within(second).findByText('Média supprimé : me_2');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Monter l’image 2' }));
    const first = within(dialog).getByRole('listitem', { name: 'Image 1 sur 2' });
    expect(within(first).getByText('Média supprimé : me_2')).toBeInTheDocument();
    expect(within(within(dialog).getByRole('listitem', { name: 'Image 2 sur 2' })).queryByText(/Média supprimé/)).toBeNull();
  });

  it('roving tabindex : un seul arrêt de tabulation, déplacé par les flèches', async () => {
    scenarioWith({ sets: [] });
    renderSection();
    const table = await screen.findByRole('table');
    const stops = () => within(table).getAllByRole('button').filter((b) => b.tabIndex === 0);
    expect(stops()).toHaveLength(1);
    const first = stops()[0]!;
    expect(first).toHaveAccessibleName(/^Défaut · Toutes langues · primary/);
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(stops()).toHaveLength(1);
    expect(stops()[0]).toBe(document.activeElement);
    expect(stops()[0]).toHaveAccessibleName(/^Défaut · Toutes langues · secondary/);
    expect(first.tabIndex).toBe(-1);
  });

  it('beforeunload bloqué tant que le formulaire est modifié', async () => {
    scenarioWith({ sets: [makeAdminSet({ id: 'd', locale: 'fr', status: 'draft' })] });
    renderSection();
    const dialog = await openCell(/^Défaut · FR · primary/);
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    fireEvent.change(within(dialog).getByLabelText('Alt FR — image 1'), { target: { value: 'x' } });
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});

describe('Revue finale — verrou et actions du tiroir', () => {
  it('liste rechargée pendant l’édition : If-Match reste celui du formulaire, 409 au lieu d’écraser', async () => {
    const draft = makeAdminSet({ id: 'd', locale: 'fr', status: 'draft' });
    const baseAt = draft.updatedAt;
    const sc = scenarioWith({ sets: [draft] });
    renderSection();
    const dialog = await openCell(/^Défaut · FR · primary/);
    fireEvent.change(within(dialog).getByLabelText('Alt FR — image 1'), { target: { value: 'local' } });
    // Un autre onglet enregistre ; « Copier vers… » recharge ensuite la liste.
    draft.updatedAt = '2026-12-01T08:00:00.000Z';
    fireEvent.click(within(dialog).getByRole('button', { name: 'Copier vers…' }));
    const copy = await screen.findByRole('dialog', { name: 'Copier vers…' });
    fireEvent.click(within(copy).getByRole('button', { name: 'Créer le brouillon' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Copier vers…' })).toBeNull());

    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le brouillon' }));
    expect(await screen.findByRole('dialog', { name: 'Conflit de version' })).toBeInTheDocument();
    expect(sc.callsTo('PUT', '/draft').at(-1)!.ifMatch).toBe(baseAt);
  });

  it('formulaire modifié : Dépublier et Annuler la programmation désactivés', async () => {
    scenarioWith({
      sets: [
        makeAdminSet({ id: 'p', locale: 'fr' }),
        makeAdminSet({ id: 's', locale: 'fr', status: 'scheduled', scheduledAt: '2026-12-01T08:00:00.000Z' }),
      ],
    });
    renderSection();
    const dialog = await openCell(/^Défaut · FR · primary/);
    const unpublish = within(dialog).getByRole('button', { name: 'Dépublier' });
    const cancel = within(dialog).getByRole('button', { name: 'Annuler la programmation' });
    expect(unpublish).toBeEnabled();
    expect(cancel).toBeEnabled();
    fireEvent.change(within(dialog).getByLabelText('Alt FR — image 1'), { target: { value: 'x' } });
    expect(unpublish).toBeDisabled();
    expect(cancel).toBeDisabled();
  });

  it('publié et programmé sans brouillon : le bouton nomme la programmation', async () => {
    const sc = scenarioWith({
      sets: [
        makeAdminSet({ id: 'p', locale: 'fr' }),
        makeAdminSet({ id: 's', locale: 'fr', status: 'scheduled', scheduledAt: '2026-12-01T08:00:00.000Z' }),
      ],
    });
    renderSection();
    const dialog = await openCell(/^Défaut · FR · primary/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publier la programmation maintenant' }));
    await waitFor(() => expect(sc.callsTo('POST', '/s/publish')).toHaveLength(1));
  });

  it('enregistré puis publication échouée : fermer recharge la liste', async () => {
    const sc = scenarioWith({ sets: [makeAdminSet({ id: 'p', locale: 'fr' })] });
    server.use(http.post('*/media-sets/:setId/publish', validation422, { once: true }));
    renderSection();
    const dialog = await openCell(/^Défaut · FR · primary — publié v1/);
    fireEvent.change(within(dialog).getByLabelText('Alt FR — image 1'), { target: { value: 'a' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publier' }));
    await within(dialog).findByText('Ensemble de médias invalide');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fermer l’éditeur' }));
    expect(await screen.findByRole('button', { name: /^Défaut · FR · primary — publié v1, brouillon/ })).toBeInTheDocument();

    const reopened = await openCell(/^Défaut · FR · primary — publié v1, brouillon/);
    expect(within(reopened).getByLabelText('Alt FR — image 1')).toHaveValue('a');
    const savedAt = sc.state.sets.find((s) => s.status === 'draft')!.updatedAt;
    fireEvent.change(within(reopened).getByLabelText('Alt FR — image 1'), { target: { value: 'b' } });
    fireEvent.click(within(reopened).getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() => expect(sc.callsTo('PUT', '/draft')).toHaveLength(2));
    expect(sc.callsTo('PUT', '/draft')[1]!.ifMatch).toBe(savedAt);
  });

  it('double clic sur Programmer : une seule requête', async () => {
    const sc = scenarioWith({ sets: [makeAdminSet({ id: 'd', locale: 'en', status: 'draft' })] });
    renderSection();
    const dialog = await openCell(/^Défaut · EN · primary/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Programmer' }));
    const sched = await screen.findByRole('dialog', { name: 'Programmer la publication' });
    const confirm = within(sched).getByRole('button', { name: 'Programmer' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(matrixButton(/^Défaut · EN · primary — programmé/)).toBeInTheDocument());
    expect(sc.callsTo('POST', '/d/schedule')).toHaveLength(1);
    expect(screen.queryByRole('dialog', { name: 'Conflit de version' })).toBeNull();
  });
});
