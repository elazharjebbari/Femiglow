/**
 * Module 02 — Cockpit : export CSV de la sélection (F-017, défaut P2).
 *
 * Audit : l'action « Exporter CSV » = window.alert('… à implémenter'). Fix livré :
 * génération d'un Blob CSV (BOM UTF-8, échappement RFC 4180) et déclenchement
 * d'un téléchargement via un <a download> éphémère.
 *
 * Oracle : on intercepte URL.createObjectURL pour récupérer le Blob, on lit son
 * texte, et on vérifie l'échappement + le BOM + le déclenchement du download
 * (a.click + a.download), SANS aucune window.alert.
 *
 * Harnais RÉEL : serveur MSW partagé + override local search/summary.
 */
import {
  describe,
  expect,
  it,
  beforeAll,
  afterEach,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server, http, HttpResponse } from '@/test/msw/server';
import { makeSearchRow, makeSummary } from '@/test/msw/emails-handlers';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(''),
}));

import { TransactionalCockpit } from '@/components/admin/emails/cockpit/TransactionalCockpit';

const SEARCH = '/api/admin/emails/transactional/search';
const SUMMARY = '/api/admin/emails/transactional/summary';

/** Rend le cockpit avec des lignes précises et renvoie `user`. */
async function renderWithRows(rows: ReturnType<typeof makeSearchRow>[]) {
  server.use(
    http.post(SEARCH, () => HttpResponse.json({ rows, total: rows.length, window: 'matched' })),
    http.get(SUMMARY, () => HttpResponse.json(makeSummary())),
  );
  const user = userEvent.setup();
  render(<TransactionalCockpit initialViews={[]} />);
  await screen.findByTestId('filtered-table');
  return user;
}

/**
 * Installe des spies download : capture le Blob passé à createObjectURL et
 * l'attribut download du <a>. Retourne un accessor du texte CSV (async).
 */
function installDownloadSpies() {
  const created: { blob: Blob; url: string }[] = [];
  const clickedDownloads: string[] = [];
  const origCreate = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn((blob: Blob) => {
    const url = `blob:mock/${created.length}`;
    created.push({ blob, url });
    return url;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
  const clickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(function (this: HTMLAnchorElement) {
      clickedDownloads.push(this.download);
    });
  return {
    created,
    clickedDownloads,
    async lastCsvText() {
      const last = created[created.length - 1];
      return last ? await last.blob.text() : null;
    },
    restore() {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
      clickSpy.mockRestore();
    },
  };
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => server.use(http.get(SUMMARY, () => HttpResponse.json(makeSummary()))));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

describe('Cockpit — export CSV de la sélection (F-017)', () => {
  // CKP-MSW-080 : export déclenche un vrai téléchargement, pas un window.alert.
  it('CKP-MSW-080 : export → Blob CSV créé + download déclenché (pas d’alert)', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const spies = installDownloadSpies();
    try {
      const user = await renderWithRows([
        makeSearchRow({ id: 'out_0', toEmail: 'a@exemple.test' }),
        makeSearchRow({ id: 'out_1', toEmail: 'b@exemple.test' }),
      ]);
      await user.click(screen.getByLabelText(/Sélectionner a@exemple\.test/i));
      await user.click(screen.getByTestId('bulk-action-export'));
      // Oracle : un Blob a été créé et un download déclenché.
      await waitFor(() => expect(spies.created.length).toBe(1));
      expect(spies.clickedDownloads[0]).toMatch(/\.csv$/);
      // Zéro window.alert (l'ancien stub est mort).
      expect(alertSpy).not.toHaveBeenCalled();
      // Le CSV ne contient QUE la ligne sélectionnée (a@…), pas b@.
      const csv = await spies.lastCsvText();
      expect(csv).toContain('a@exemple.test');
      expect(csv).not.toContain('b@exemple.test');
    } finally {
      spies.restore();
    }
  });

  // CKP-MSW-081 : virgule dans le sujet → champ entouré de guillemets.
  it('CKP-MSW-081 : sujet avec virgule → champ CSV entre guillemets', async () => {
    const spies = installDownloadSpies();
    try {
      const user = await renderWithRows([
        makeSearchRow({
          id: 'out_c',
          toEmail: 'c@exemple.test',
          subject: 'Commande, livraison et retour',
        }),
      ]);
      await user.click(screen.getByLabelText(/Sélectionner c@exemple\.test/i));
      await user.click(screen.getByTestId('bulk-action-export'));
      await waitFor(() => expect(spies.created.length).toBe(1));
      const csv = (await spies.lastCsvText()) ?? '';
      // Oracle RFC 4180 : le champ à virgule est entre guillemets.
      expect(csv).toContain('"Commande, livraison et retour"');
    } finally {
      spies.restore();
    }
  });

  // CKP-MSW-082 : guillemet interne → doublé.
  it('CKP-MSW-082 : guillemet interne dans le sujet → doublé ("")', async () => {
    const spies = installDownloadSpies();
    try {
      const user = await renderWithRows([
        makeSearchRow({
          id: 'out_q',
          toEmail: 'q@exemple.test',
          subject: 'Rituel "éclat" du soir',
        }),
      ]);
      await user.click(screen.getByLabelText(/Sélectionner q@exemple\.test/i));
      await user.click(screen.getByTestId('bulk-action-export'));
      await waitFor(() => expect(spies.created.length).toBe(1));
      const csv = (await spies.lastCsvText()) ?? '';
      // Oracle : guillemets internes doublés + champ entouré.
      expect(csv).toContain('"Rituel ""éclat"" du soir"');
    } finally {
      spies.restore();
    }
  });

  // CKP-MSW-083 : BOM UTF-8 présent + accents préservés.
  it('CKP-MSW-083 : BOM UTF-8 en tête + accents fr préservés', async () => {
    const spies = installDownloadSpies();
    try {
      const user = await renderWithRows([
        makeSearchRow({
          id: 'out_a',
          toEmail: 'accent@exemple.test',
          toName: 'Nourelhouda Benâli',
          subject: 'Confirmation expédiée',
        }),
      ]);
      await user.click(screen.getByLabelText(/Sélectionner accent@exemple\.test/i));
      await user.click(screen.getByTestId('bulk-action-export'));
      await waitFor(() => expect(spies.created.length).toBe(1));
      // Blob.text() consomme le BOM de tête (TextDecoder UTF-8) → le texte
      // décodé commence directement par l'en-tête, sans U+FEFF.
      const csv = (await spies.lastCsvText()) ?? '';
      expect(csv.charCodeAt(0)).not.toBe(0xfeff);
      // Oracle BOM robuste (jsdom Blob ne round-trip pas les octets) : la taille
      // du Blob = octets UTF-8 du texte décodé + 3 (les octets EF BB BF du BOM).
      const blob = spies.created[0]!.blob;
      const encodedWithoutBom = new TextEncoder().encode(csv).length;
      expect(blob.size).toBe(encodedWithoutBom + 3);
      // Accents fr préservés + en-têtes français.
      expect(csv).toContain('Nourelhouda Benâli');
      expect(csv).toContain('Confirmation expédiée');
      expect(csv).toContain('destinataire');
    } finally {
      spies.restore();
    }
  });
});
