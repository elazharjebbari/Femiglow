/**
 * RTL + MSW — section « Médias par audience » (matrice, tiroir d'édition,
 * cycle de vie, conflit, validation, copie, publication en masse, aperçu).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse, server } from '@/test/msw/server';
import {
  MEDIA_SETS_COMPONENT,
  makeAdminSet,
  setupMediaSetsScenario,
  thumbFor,
} from '@/test/msw/media-sets-handlers';
import { KIT_HERO_MEDIA_VARIANTS } from '@/lib/components/registry';
import { expectNoAxeViolations } from '@/test/axe';
import { MediaVariantsSection } from './MediaVariantsSection';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
// jsdom fournit son propre `AbortSignal`, refusé par le `fetch` de Node
// (MSW) : on retire le signal (seul `MediaPickerDrawer` en passe un).
beforeEach(() => {
  // Capturé après `server.listen` : c'est le `fetch` intercepté par MSW.
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

/**
 * Bouton de la matrice. Tiroir ouvert, Radix masque le reste de la page
 * aux technologies d'assistance (`aria-hidden`) : on cherche aussi parmi
 * les éléments masqués.
 */
const matrixButton = (name: RegExp) => screen.getByRole('button', { name, hidden: true });

/** Médiathèque du sélecteur. */
const mediaLibrary = http.get('*/api/admin/media', () =>
  HttpResponse.json({
    rows: [
      {
        id: 'me_new',
        slug: 'nouvelle-image',
        kind: 'image',
        status: 'ready',
        alt: 'Main et kit',
        originalWidth: 800,
        originalHeight: 1000,
        palette: null,
        thumbUrl: thumbFor('me_new'),
      },
    ],
    total: 1,
    nextCursor: null,
  }),
);

function renderSection(opts: { legacy?: string[] } = {}) {
  return render(
    <MediaVariantsSection
      componentKey={MEDIA_SETS_COMPONENT}
      policy={KIT_HERO_MEDIA_VARIANTS}
      activeLegacySlots={opts.legacy ?? ['primary']}
    />,
  );
}

async function openCell(name: RegExp) {
  const btn = await screen.findByRole('button', { name });
  fireEvent.click(btn);
  return screen.findByRole('dialog', { name: /·/ });
}

function scenarioWith(sets: ReturnType<typeof makeAdminSet>[], extra: Parameters<typeof setupMediaSetsScenario>[0] = {}) {
  const sc = setupMediaSetsScenario({ sets, ...extra });
  server.use(...sc.handlers, mediaLibrary);
  return sc;
}

describe('MediaVariantsSection — affichage', () => {
  it('masquée sans politique (aucune requête)', () => {
    const { container } = render(
      <MediaVariantsSection componentKey="home-hero" policy={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('matrice : en-têtes, statuts, héritage, repli et couverture', async () => {
    scenarioWith([
      makeAdminSet({ id: 'def_fr', locale: 'fr', mediaIds: ['me_def'] }),
      makeAdminSet({ id: 'e_any', variantDim: 'angle', variantKey: 'e', locale: '*', version: 3, mediaIds: ['me_e'] }),
      makeAdminSet({
        id: 'e_sec_draft',
        slot: 'secondary',
        variantDim: 'angle',
        variantKey: 'e',
        locale: 'ar',
        status: 'draft',
        source: 'import',
        mediaIds: ['me_1', 'me_2', 'me_3', 'me_4'],
      }),
    ]);
    renderSection({ legacy: ['primary'] });

    const table = await screen.findByRole('table', { name: 'Matrice des médias par audience' });
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Audience', 'Toutes langues*', 'FR', 'AR', 'EN']);
    expect(within(table).getAllByRole('rowheader')).toHaveLength(7);
    expect(within(table).getByRole('rowheader', { name: /Angle E/ })).toBeInTheDocument();

    // Cellule propre publiée.
    expect(
      screen.getByRole('button', { name: /^Angle E · Toutes langues · primary — publié v3/ }),
    ).toBeInTheDocument();
    // AR primary : hérite de l'ensemble `*` de la même ligne.
    expect(
      screen.getByRole('button', { name: /^Angle E · AR · primary — aucun ensemble — hérite de : angle e · \*/ }),
    ).toBeInTheDocument();
    // Brouillon importé (liste) : « +4 secondaires ».
    const sec = screen.getByRole('button', { name: /^Angle E · AR · secondary — brouillon importé — 4 images/ });
    expect(within(sec).getByText('+4 secondaires')).toBeInTheDocument();
    // Défaut AR primary : rien en AR, défaut fr non crossLocale → repli legacy (slot `primary` lié).
    expect(
      screen.getByRole('button', { name: /^Défaut · AR · primary — aucun ensemble — liaison existante/ }),
    ).toBeInTheDocument();
    // Secondary sans liaison context_* → image produit.
    expect(
      screen.getByRole('button', { name: /^Angle A · FR · secondary — aucun ensemble — image produit/ }),
    ).toBeInTheDocument();

    // Couverture : 7 lignes × 3 langues × 2 slots.
    const coverage = screen.getByRole('group', { name: 'Couverture des combinaisons' });
    expect(coverage).toHaveTextContent('42 combinaisons');
    expect(coverage).toHaveTextContent('4 exactes');
    // Bouton de publication en masse : 1 brouillon importé.
    expect(screen.getByRole('button', { name: 'Publier les brouillons importés (1)' })).toBeEnabled();
  });

  it('accessibilité (axe) : matrice puis tiroir ouvert', async () => {
    scenarioWith([
      makeAdminSet({ id: 'p', locale: 'fr', mediaIds: ['me_a'] }),
      makeAdminSet({ id: 'd', slot: 'secondary', locale: 'ar', status: 'draft', mediaIds: ['me_1', 'me_2'] }),
    ]);
    const { container } = renderSection();
    await screen.findByRole('table');
    // `color-contrast` n'est pas calculable dans jsdom.
    await expectNoAxeViolations(container, { rules: { 'color-contrast': { enabled: false } } });
    const dialog = await openCell(/^Défaut · AR · secondary/);
    await expectNoAxeViolations(dialog, { rules: { 'color-contrast': { enabled: false } } });
  });

  it('filtre de slot et navigation clavier aux flèches', async () => {
    scenarioWith([]);
    renderSection();
    await screen.findByRole('table');
    expect(screen.getAllByRole('button', { name: /· secondary —/ }).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Slot'), { target: { value: 'primary' } });
    expect(screen.queryAllByRole('button', { name: /· secondary —/ })).toHaveLength(0);
    expect(screen.getByRole('group', { name: 'Couverture des combinaisons' })).toHaveTextContent(
      '21 combinaisons (slot primary)',
    );

    const first = screen.getByRole('button', { name: /^Défaut · Toutes langues · primary/ });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Défaut · FR · primary/ }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Angle A · FR · primary/ }));
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Angle A · EN · primary/ }));
  });

  it('bandeau des programmations bloquées', async () => {
    const stuck = makeAdminSet({
      id: 'sch_b',
      variantDim: 'angle',
      variantKey: 'b',
      locale: 'fr',
      status: 'scheduled',
      scheduledAt: '2026-10-29T08:00:00.000Z',
    });
    scenarioWith([stuck], {
      stuckScheduled: [
        {
          setId: 'sch_b',
          slot: 'primary',
          variantDim: 'angle',
          variantKey: 'b',
          locale: 'fr',
          scheduledAt: '2026-10-29T08:00:00.000Z',
          reason: 'media_unavailable',
          unavailableMediaIds: ['me_a'],
        },
      ],
    });
    renderSection();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('1 publication programmée est bloquée');
    expect(alert).toHaveTextContent('Angle B · FR · primary');
    expect(screen.getByRole('button', { name: /^Angle B · FR · primary — bloqué/ })).toBeInTheDocument();
    fireEvent.click(within(alert).getByRole('button', { name: 'Ouvrir la cellule' }));
    expect(await screen.findByRole('dialog', { name: 'Angle B · FR · primary' })).toBeInTheDocument();
  });
});

describe('MediaSetEditorDrawer — brouillon et cycle de vie', () => {
  it('crée un brouillon : PUT avec le bon payload, sans If-Match ; puis If-Match = updatedAt', async () => {
    const sc = scenarioWith([]);
    renderSection();
    const dialog = await openCell(/^Angle E · AR · secondary/);
    expect(within(dialog).getByText(/liste · 6 images max/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter une image' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Choisir nouvelle-image' }));

    // Alt AR manquant signalé pour une cellule AR ; champ AR en RTL.
    const altAr = within(dialog).getByLabelText('Alt AR — image 1');
    expect(altAr).toHaveAttribute('dir', 'rtl');
    expect(altAr).toHaveAttribute('aria-invalid', 'true');
    expect(within(dialog).getByText(/Alt AR manquant pour cette cellule/)).toBeInTheDocument();
    fireEvent.change(altAr, { target: { value: 'يد وعدة' } });
    expect(within(dialog).queryByText(/Alt AR manquant/)).toBeNull();

    fireEvent.change(within(dialog).getByLabelText('Point focal X (%) — image 1'), { target: { value: '30' } });
    fireEvent.change(within(dialog).getByLabelText('Point focal Y (%) — image 1'), { target: { value: '70' } });
    fireEvent.change(within(dialog).getByLabelText('Cadrage — image 1'), { target: { value: 'top' } });
    fireEvent.click(within(dialog).getByLabelText(/Images sans texte, réutilisables/));

    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() => expect(sc.callsTo('PUT', '/draft')).toHaveLength(1));
    const put = sc.callsTo('PUT', '/draft')[0]!;
    expect(put.ifMatch).toBeNull();
    // Aucun brouillon connu : précondition « aucun brouillon ne doit exister ».
    expect(put.ifNoneMatch).toBe('*');
    expect(put.body).toEqual({
      slot: 'secondary',
      variantDim: 'angle',
      variantKey: 'e',
      locale: 'ar',
      crossLocale: true,
      notes: null,
      items: [
        { mediaId: 'me_new', mobileMediaId: null, alt: { ar: 'يد وعدة' }, objectPosition: 'top', focalX: 30, focalY: 70 },
      ],
    });

    // La matrice est rafraîchie (brouillon) ; deuxième enregistrement avec If-Match.
    await waitFor(() =>
      expect(matrixButton(/^Angle E · AR · secondary — brouillon —/)).toBeInTheDocument(),
    );
    const draftUpdatedAt = sc.state.sets.find((s) => s.status === 'draft')!.updatedAt;
    fireEvent.change(within(dialog).getByLabelText('Alt FR — image 1'), { target: { value: 'Main' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() => expect(sc.callsTo('PUT', '/draft')).toHaveLength(2));
    expect(sc.callsTo('PUT', '/draft')[1]!.ifMatch).toBe(draftUpdatedAt);
    expect(sc.callsTo('PUT', '/draft')[1]!.ifNoneMatch).toBeNull();
  });

  it('plafond du slot : primary accepte une seule image (remplacer)', async () => {
    scenarioWith([makeAdminSet({ id: 'p', locale: 'fr', mediaIds: ['me_a'] })]);
    renderSection();
    const dialog = await openCell(/^Défaut · FR · primary/);
    expect(within(dialog).getByText(/\(1 \/ 1\)/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remplacer l’image' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Choisir nouvelle-image' }));
    expect(within(dialog).getAllByRole('listitem', { name: /^Image \d sur 1$/ })).toHaveLength(1);
  });

  it('réordonne au clavier (boutons Monter/Descendre)', async () => {
    const sc = scenarioWith([
      makeAdminSet({ id: 'd', slot: 'secondary', locale: 'fr', status: 'draft', mediaIds: ['me_1', 'me_2'] }),
    ]);
    renderSection();
    const dialog = await openCell(/^Défaut · FR · secondary/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Descendre l’image 1' }));
    expect(within(dialog).getByText('Modifications non enregistrées')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() => expect(sc.callsTo('PUT', '/draft')).toHaveLength(1));
    const body = sc.callsTo('PUT', '/draft')[0]!.body as { items: { mediaId: string }[] };
    expect(body.items.map((i) => i.mediaId)).toEqual(['me_2', 'me_1']);
  });

  it('publier un brouillon : POST publish avec If-Match, puis matrice à jour', async () => {
    const draft = makeAdminSet({ id: 'd', variantDim: 'angle', variantKey: 'c', locale: 'fr', status: 'draft' });
    const sc = scenarioWith([draft]);
    renderSection();
    const dialog = await openCell(/^Angle C · FR · primary — brouillon/);
    const ifMatch = draft.updatedAt;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publier' }));
    await waitFor(() => expect(sc.callsTo('POST', '/d/publish')).toHaveLength(1));
    expect(sc.callsTo('POST', '/d/publish')[0]!.ifMatch).toBe(ifMatch);
    expect(sc.callsTo('PUT', '/draft')).toHaveLength(0);
    await waitFor(() =>
      expect(matrixButton(/^Angle C · FR · primary — publié v1/)).toBeInTheDocument(),
    );
  });

  it('programmer (ScheduleDialog) puis annuler la programmation', async () => {
    const sc = scenarioWith([makeAdminSet({ id: 'd', locale: 'en', status: 'draft' })]);
    renderSection();
    const dialog = await openCell(/^Défaut · EN · primary/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Programmer' }));
    const sched = await screen.findByRole('dialog', { name: 'Programmer la publication' });
    fireEvent.click(within(sched).getByRole('button', { name: 'Programmer' }));
    await waitFor(() => expect(sc.callsTo('POST', '/d/schedule')).toHaveLength(1));
    const body = sc.callsTo('POST', '/d/schedule')[0]!.body as { scheduledAt: string };
    expect(Date.parse(body.scheduledAt)).toBeGreaterThan(Date.now());
    await waitFor(() =>
      expect(matrixButton(/^Défaut · EN · primary — programmé/)).toBeInTheDocument(),
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler la programmation' }));
    await waitFor(() => expect(sc.callsTo('POST', '/d/cancel-schedule')).toHaveLength(1));
    await waitFor(() =>
      expect(matrixButton(/^Défaut · EN · primary — brouillon/)).toBeInTheDocument(),
    );
  });

  it('dépublier et abandonner le brouillon : confirmation dans la page', async () => {
    const pub = makeAdminSet({ id: 'p', locale: 'fr', version: 2 });
    const draft = makeAdminSet({ id: 'd', locale: 'fr', status: 'draft', mediaIds: ['me_b'] });
    const sc = scenarioWith([pub, draft]);
    renderSection();
    const dialog = await openCell(/^Défaut · FR · primary — publié v2/);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Abandonner le brouillon' }));
    const confirm = within(dialog).getByRole('alertdialog');
    expect(confirm).toHaveTextContent('Abandonner le brouillon ?');
    expect(sc.callsTo('DELETE', '/d')).toHaveLength(0);
    fireEvent.click(within(confirm).getByRole('button', { name: 'Abandonner le brouillon' }));
    await waitFor(() => expect(sc.callsTo('DELETE', '/d')).toHaveLength(1));
    expect(sc.callsTo('DELETE', '/d')[0]!.ifMatch).toBe(draft.updatedAt);
    await waitFor(() => expect(within(dialog).queryByRole('button', { name: 'Abandonner le brouillon' })).toBeNull());

    fireEvent.click(within(dialog).getByRole('button', { name: 'Dépublier' }));
    fireEvent.click(within(within(dialog).getByRole('alertdialog')).getByRole('button', { name: 'Dépublier' }));
    await waitFor(() => expect(sc.callsTo('POST', '/p/unpublish')).toHaveLength(1));
    await waitFor(() =>
      expect(matrixButton(/^Défaut · FR · primary — aucun ensemble/)).toBeInTheDocument(),
    );
  });

  it('409 : modale de conflit, puis « Reprendre la version du serveur »', async () => {
    const draft = makeAdminSet({ id: 'd', locale: 'fr', status: 'draft', mediaIds: ['me_a'] });
    const sc = scenarioWith([draft]);
    renderSection();
    const dialog = await openCell(/^Défaut · FR · primary/);
    fireEvent.change(within(dialog).getByLabelText('Alt FR — image 1'), { target: { value: 'local' } });
    sc.failNext({ kind: 'conflict' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le brouillon' }));

    const modal = await screen.findByRole('dialog', { name: 'Conflit de version' });
    expect(within(modal).getByText('Votre version')).toBeInTheDocument();
    expect(within(modal).getByText('Version sur le serveur')).toBeInTheDocument();
    expect(within(modal).getByText(/brouillon v1 · 1 image/)).toBeInTheDocument();
    fireEvent.click(within(modal).getByRole('button', { name: 'Reprendre la version du serveur' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Conflit de version' })).toBeNull());
    expect(within(dialog).getByLabelText('Alt FR — image 1')).toHaveValue('');
  });

  it('409 : « Écraser avec ma version » renvoie le brouillon avec If-Match serveur', async () => {
    const draft = makeAdminSet({ id: 'd', locale: 'fr', status: 'draft' });
    const serverUpdatedAt = draft.updatedAt;
    const sc = scenarioWith([draft]);
    renderSection();
    const dialog = await openCell(/^Défaut · FR · primary/);
    fireEvent.change(within(dialog).getByLabelText('Alt FR — image 1'), { target: { value: 'mien' } });
    sc.failNext({ kind: 'conflict' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le brouillon' }));
    const modal = await screen.findByRole('dialog', { name: 'Conflit de version' });
    fireEvent.click(within(modal).getByRole('button', { name: 'Écraser avec ma version' }));
    await waitFor(() => expect(sc.callsTo('PUT', '/draft')).toHaveLength(2));
    expect(sc.callsTo('PUT', '/draft')[1]!.ifMatch).toBe(serverUpdatedAt);
    expect((sc.callsTo('PUT', '/draft')[1]!.body as { items: { alt: unknown }[] }).items[0]!.alt).toEqual({ fr: 'mien' });
  });

  it('422 : problèmes affichés en ligne (général + par image)', async () => {
    const sc = scenarioWith([makeAdminSet({ id: 'd', slot: 'secondary', locale: 'fr', status: 'draft', mediaIds: ['me_1', 'me_2'] })]);
    renderSection();
    const dialog = await openCell(/^Défaut · FR · secondary/);
    fireEvent.change(within(dialog).getByLabelText('Alt EN — image 2'), { target: { value: 'x' } });
    sc.failNext({
      kind: 'validation',
      issues: [
        { code: 'item.media_unavailable', path: ['items', 1, 'mediaId'], message: 'Média supprimé : me_2' },
        { code: 'items.too_many', path: ['items'], message: 'Maximum 6 images pour ce slot' },
      ],
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le brouillon' }));
    const alert = await within(dialog).findByText('Ensemble de médias invalide');
    expect(alert.closest('[role="alert"]')).toHaveTextContent('Maximum 6 images pour ce slot');
    const second = within(dialog).getByRole('listitem', { name: 'Image 2 sur 2' });
    expect(within(second).getByText('Média supprimé : me_2')).toBeInTheDocument();
  });

  it('Copier vers… crée un brouillon dans la cellule choisie', async () => {
    const sc = scenarioWith([
      makeAdminSet({ id: 'src', slot: 'secondary', variantDim: 'angle', variantKey: 'e', locale: '*', mediaIds: ['me_1', 'me_2'], crossLocale: true }),
    ]);
    renderSection();
    const dialog = await openCell(/^Angle E · Toutes langues · secondary/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Copier vers…' }));
    const copy = await screen.findByRole('dialog', { name: 'Copier vers…' });
    fireEvent.change(within(copy).getByLabelText('Audience'), { target: { value: 'angle:d' } });
    fireEvent.change(within(copy).getByLabelText('Langue'), { target: { value: 'ar' } });
    fireEvent.click(within(copy).getByRole('button', { name: 'Créer le brouillon' }));
    await waitFor(() => expect(sc.callsTo('PUT', '/draft')).toHaveLength(1));
    const put = sc.callsTo('PUT', '/draft')[0]!;
    expect(put.ifMatch).toBeNull();
    expect(put.ifNoneMatch).toBe('*');
    expect(put.body).toMatchObject({
      slot: 'secondary',
      variantDim: 'angle',
      variantKey: 'd',
      locale: 'ar',
      crossLocale: true,
      items: [{ mediaId: 'me_1' }, { mediaId: 'me_2' }],
    });
    await waitFor(() =>
      expect(matrixButton(/^Angle D · AR · secondary — brouillon/)).toBeInTheDocument(),
    );
  });

  it('Historique : restaurer une version crée un brouillon', async () => {
    const pub = makeAdminSet({ id: 'p', locale: 'fr', mediaIds: ['me_old'] });
    const sc = scenarioWith([pub]);
    // Une publication antérieure dans l'historique.
    const histDraft = makeAdminSet({ id: 'tmp', locale: 'fr', status: 'draft', mediaIds: ['me_hist'] });
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
      items: histDraft.items.map((i) => ({ ...i, thumbUrl: thumbFor(i.mediaId), mobileThumbUrl: null })),
      tuple: 'primary|default|*|fr',
    });
    renderSection();
    const dialog = await openCell(/^Défaut · FR · primary/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Historique' }));
    const restore = await within(dialog).findByRole('button', { name: /^Restaurer la version 1/ });
    fireEvent.click(restore);
    fireEvent.click(within(within(dialog).getByRole('alertdialog')).getByRole('button', { name: 'Restaurer en brouillon' }));
    await waitFor(() => expect(sc.callsTo('POST', '/restore')).toHaveLength(1));
    expect(sc.callsTo('POST', '/restore')[0]!.body).toEqual({ historyId: 'h1' });
    await waitFor(() =>
      expect(matrixButton(/^Défaut · FR · primary — publié v1, brouillon/)).toBeInTheDocument(),
    );
  });

  it('fermer avec des modifications non enregistrées demande confirmation', async () => {
    scenarioWith([makeAdminSet({ id: 'd', locale: 'fr', status: 'draft' })]);
    renderSection();
    const dialog = await openCell(/^Défaut · FR · primary/);
    fireEvent.change(within(dialog).getByLabelText('Alt FR — image 1'), { target: { value: 'x' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fermer l’éditeur' }));
    const confirm = within(dialog).getByRole('alertdialog');
    expect(confirm).toHaveTextContent('Fermer sans enregistrer ?');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Fermer sans enregistrer' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Défaut · FR · primary/ })).toBeNull());
  });
});

describe('Aperçu et diagnostic', () => {
  it.each([
    [/^Angle E · AR · primary/, '/ar/kit?angle=e&hmv_preview=draft', { locale: 'ar', angle: 'e' }],
    [/^Témoin · Toutes langues · primary/, '/fr/kit?angle=temoin&hmv_preview=draft', { locale: 'fr', angle: 'temoin' }],
    [/^Défaut · EN · primary/, '/en/kit?hmv_preview=draft', { locale: 'en', angle: null }],
  ])('%s → iframe %s et GET resolve', async (cell, url, q) => {
    const sc = scenarioWith([]);
    renderSection();
    const dialog = await openCell(cell);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aperçu' }));
    const preview = await screen.findByRole('dialog', { name: /^Aperçu —/ });
    expect(within(preview).getByTitle('Aperçu de la page avec les brouillons')).toHaveAttribute('src', url);
    await within(preview).findByText(/hero_media_variant/);
    const call = sc.callsTo('GET', '/resolve').at(-1)!;
    const params = new URL(call.path, 'http://x').searchParams;
    expect(params.get('locale')).toBe(q.locale);
    expect(params.get('angle')).toBe(q.angle);
    expect(params.get('draft')).toBe('1');
    expect(within(preview).getAllByText(/niveau [14]/).length).toBeGreaterThan(0);

    // Bascule de largeur (radiogroup accessible).
    const desktop = within(preview).getByRole('radio', { name: 'Desktop' });
    fireEvent.click(desktop);
    expect(desktop).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Publication en masse des brouillons importés', () => {
  it('essai à blanc listé, puis publication confirmée', async () => {
    const sc = scenarioWith([
      makeAdminSet({ id: 'imp1', variantDim: 'angle', variantKey: 'a', locale: '*', status: 'draft', source: 'import' }),
      makeAdminSet({ id: 'imp2', slot: 'secondary', locale: '*', status: 'draft', source: 'import', mediaIds: ['me_1', 'me_2'] }),
      makeAdminSet({ id: 'adm', locale: 'fr', status: 'draft', source: 'admin' }),
      makeAdminSet({ id: 'pub', slot: 'secondary', locale: '*', version: 4 }),
    ]);
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'Publier les brouillons importés (2)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Publier les brouillons importés' });
    const list = await within(dialog).findByRole('list', { name: 'Ensembles qui seront publiés' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(list).toHaveTextContent('Angle A · Toutes langues · primary');
    expect(list).toHaveTextContent('remplace v4');
    const dry = sc.callsTo('POST', '/bulk-publish');
    expect(dry).toHaveLength(1);
    expect(dry[0]!.body).toEqual({ filter: { source: 'import' }, dryRun: true });

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Publier 2 ensembles' }));
    });
    await waitFor(() => expect(sc.callsTo('POST', '/bulk-publish')).toHaveLength(2));
    const real = sc.callsTo('POST', '/bulk-publish')[1]!.body as {
      filter: unknown;
      dryRun: boolean;
      expected: Array<{ setId: string; updatedAt: string }>;
    };
    expect(real.filter).toEqual({ source: 'import' });
    expect(real.dryRun).toBe(false);
    // Plan revu de l'essai à blanc : ensembles + `updatedAt`.
    expect(real.expected.map((e) => e.setId).sort()).toEqual(['imp1', 'imp2']);
    expect(real.expected.every((e) => !Number.isNaN(Date.parse(e.updatedAt)))).toBe(true);
    expect(await within(dialog).findByText(/ensembles publiés/)).toBeInTheDocument();
    await waitFor(() =>
      expect(matrixButton(/^Angle A · Toutes langues · primary — publié v1/)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Publier les brouillons importés', hidden: true })).toBeDisabled();
  });
});
