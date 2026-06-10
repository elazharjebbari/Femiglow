/**
 * CSV outbox — source de vérité UNIQUE du dialecte (CKPT-01).
 *
 * Partagé par l'export client « (page) » (TransactionalCockpit) et la route
 * d'export serveur streamée : même échappement RFC 4180, mêmes en-têtes, même
 * ordre de colonnes — les deux chemins produisent des fichiers identiques pour
 * les mêmes lignes.
 */

export const CSV_HEADERS = [
  'id',
  'date',
  'destinataire',
  'nom',
  'template',
  'sujet',
  'statut',
  'tentatives',
] as const;

/** BOM UTF-8 en tête de flux : Excel FR lit correctement les accents. */
export const CSV_BOM = '﻿';

/** Fin de ligne RFC 4180. */
export const CSV_EOL = '\r\n';

/**
 * Échappe un champ CSV selon RFC 4180 : si le champ contient une virgule, un
 * guillemet ou un retour ligne, on l'entoure de guillemets et on double les
 * guillemets internes. `null`/`undefined` → champ vide.
 */
export function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Forme minimale d'une ligne outbox exportable (client OU serveur). */
export type CsvOutboxRow = {
  id: string | number;
  createdAt: Date | string;
  toEmail: string;
  toName: string | null;
  template: string;
  subject: string;
  status: string;
  attempts: number;
  maxAttempts: number;
};

/** Une ligne CSV (sans EOL) pour une ligne outbox. Dates en ISO 8601. */
export function csvLine(r: CsvOutboxRow): string {
  return [
    csvEscape(r.id),
    csvEscape(r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt),
    csvEscape(r.toEmail),
    csvEscape(r.toName),
    csvEscape(r.template),
    csvEscape(r.subject),
    csvEscape(r.status),
    csvEscape(`${r.attempts}/${r.maxAttempts}`),
  ].join(',');
}

/** Nom de fichier daté (contrat Content-Disposition ET <a download> client). */
export function csvFilename(now: Date = new Date()): string {
  return `emails-transactionnels-${now.toISOString().slice(0, 10)}.csv`;
}

/** Document complet pour l'export CLIENT (page courante) : BOM + header + lignes. */
export function buildCsvDocument(rows: CsvOutboxRow[]): string {
  const lines = [CSV_HEADERS.join(','), ...rows.map(csvLine)];
  return `${CSV_BOM}${lines.join(CSV_EOL)}`;
}
