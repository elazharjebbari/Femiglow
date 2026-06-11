/**
 * Mailpit — helpers e2e pour la boîte aux lettres de capture (phase 0.6).
 *
 * Le container `femiglow-mailpit` (cf. scripts/test-mailpit.sh) capte tous les
 * envois SMTP des tests sur 127.0.0.1:1025 et les expose via une API REST sur
 * 127.0.0.1:8025. Ces helpers interrogent cette API depuis les specs Playwright
 * en réutilisant l'`APIRequestContext` du fixture `request`.
 *
 * Endpoints Mailpit utilisés (API v1) :
 *   - GET    /api/v1/search?query=...   liste (résumés) triée par date décroissante
 *   - GET    /api/v1/message/{ID}       message complet (corps Text + HTML)
 *   - DELETE /api/v1/messages           vide toute la boîte
 *
 * Important : /search ne renvoie QUE des résumés (pas de corps). Pour obtenir
 * le HTML/Text d'un mail, on enchaîne avec GET /message/{ID}. Les helpers
 * `readLast*` font cet enchaînement et renvoient un message complet.
 */
import { expect, type APIRequestContext } from '@playwright/test';

/** Base de l'API REST de Mailpit (binding loopback du container de test). */
export const MAILPIT_API_BASE = 'http://127.0.0.1:8025/api/v1';

/** Adresse e-mail telle que renvoyée par Mailpit (From, To, Cc, ...). */
export interface MailpitAddress {
  Name: string;
  Address: string;
}

/** Résumé d'un message tel que renvoyé par /search et /messages (sans corps). */
export interface MailpitMessageSummary {
  ID: string;
  MessageID: string;
  Subject: string;
  From: MailpitAddress | null;
  To: MailpitAddress[];
  // Mailpit renvoie `null` (pas `[]`) quand il n'y a ni Cc ni Bcc.
  Cc: MailpitAddress[] | null;
  Bcc: MailpitAddress[] | null;
  Created: string;
  Read: boolean;
  Size: number;
  Attachments: number;
  Tags: string[];
  Snippet: string;
}

/** Réponse de /search et /messages. */
export interface MailpitSearchResult {
  total: number;
  unread: number;
  count: number;
  messages_count: number;
  start: number;
  tags: string[];
  messages: MailpitMessageSummary[];
}

/** Message complet renvoyé par /message/{ID} (inclut les corps Text + HTML). */
export interface MailpitMessage {
  ID: string;
  MessageID: string;
  Subject: string;
  From: MailpitAddress | null;
  To: MailpitAddress[];
  Cc: MailpitAddress[] | null;
  Bcc: MailpitAddress[] | null;
  ReplyTo: MailpitAddress[] | null;
  Date: string;
  Text: string;
  HTML: string;
  Size: number;
  Tags: string[];
  ListUnsubscribe: {
    Header: string;
    Links: string[];
    Errors: string;
    HeaderPost: string;
  };
}

/** Exécute une recherche Mailpit et renvoie le résultat parsé. */
async function search(
  request: APIRequestContext,
  query: string,
): Promise<MailpitSearchResult> {
  const res = await request.get(`${MAILPIT_API_BASE}/search`, {
    params: { query },
  });
  expect(
    res.ok(),
    `Mailpit /search a renvoyé HTTP ${res.status()} pour query="${query}" — le container femiglow-mailpit tourne-t-il ? (scripts/test-mailpit.sh start)`,
  ).toBeTruthy();
  return (await res.json()) as MailpitSearchResult;
}

/** Récupère le message complet (corps Text + HTML) à partir de son ID. */
async function getMessage(
  request: APIRequestContext,
  id: string,
): Promise<MailpitMessage> {
  const res = await request.get(`${MAILPIT_API_BASE}/message/${id}`);
  expect(
    res.ok(),
    `Mailpit /message/${id} a renvoyé HTTP ${res.status()}`,
  ).toBeTruthy();
  return (await res.json()) as MailpitMessage;
}

/**
 * Attend puis renvoie le DERNIER e-mail (le plus récent) envoyé à `to`,
 * corps complet inclus. Mailpit trie /search par date décroissante, donc le
 * premier résultat est le plus récent.
 *
 * Polle l'API jusqu'à ce qu'au moins un message arrive (l'envoi SMTP est
 * asynchrone), sans `sleep` : on s'appuie sur `expect.poll`.
 *
 * @throws si aucun e-mail n'arrive avant le timeout.
 */
export async function readLastEmail(
  request: APIRequestContext,
  to: string,
  options: { timeout?: number } = {},
): Promise<MailpitMessage> {
  const timeout = options.timeout ?? 10_000;
  const query = `to:${to}`;

  let lastId: string | undefined;
  await expect
    .poll(
      async () => {
        const result = await search(request, query);
        lastId = result.messages[0]?.ID;
        return result.messages.length;
      },
      {
        timeout,
        message: `Aucun e-mail reçu pour ${to} dans Mailpit (query="${query}").`,
      },
    )
    .toBeGreaterThan(0);

  // `lastId` est forcément défini ici (poll a vu length > 0).
  return getMessage(request, lastId as string);
}

/**
 * Renvoie tous les e-mails (corps complets) dont le sujet correspond à
 * `subject`, du plus récent au plus ancien. Utilise la syntaxe `subject:"..."`
 * de Mailpit (correspondance partielle, insensible à la casse côté serveur).
 *
 * Polle jusqu'à recevoir au moins un message correspondant.
 */
export async function readEmailsBySubject(
  request: APIRequestContext,
  subject: string,
  options: { timeout?: number } = {},
): Promise<MailpitMessage[]> {
  const timeout = options.timeout ?? 10_000;
  const query = `subject:"${subject}"`;

  let summaries: MailpitMessageSummary[] = [];
  await expect
    .poll(
      async () => {
        const result = await search(request, query);
        summaries = result.messages;
        return summaries.length;
      },
      {
        timeout,
        message: `Aucun e-mail avec le sujet "${subject}" dans Mailpit.`,
      },
    )
    .toBeGreaterThan(0);

  return Promise.all(summaries.map((m) => getMessage(request, m.ID)));
}

/**
 * Vide intégralement la boîte Mailpit. À appeler typiquement dans un
 * `test.beforeEach` pour isoler chaque scénario des envois précédents.
 */
export async function clearMailbox(request: APIRequestContext): Promise<void> {
  const res = await request.delete(`${MAILPIT_API_BASE}/messages`);
  expect(
    res.ok(),
    `Mailpit DELETE /messages a renvoyé HTTP ${res.status()}`,
  ).toBeTruthy();
}
