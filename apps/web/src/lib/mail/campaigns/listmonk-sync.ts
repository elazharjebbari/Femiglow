/**
 * Listmonk sync engine (M5.4.1).
 *
 * Push une snapshot d'audience FemiGlow vers Listmonk en liste éphémère,
 * crée la campagne Listmonk associée, planifie cleanup J+30.
 *
 * Workflow :
 *   1. Récupérer snapshot + members
 *   2. POST /api/lists Listmonk (private, tagged='ephemeral')
 *   3. POST /api/import/subscribers Listmonk (chunks de 1000)
 *   4. Persister listmonk_list_id sur snapshot + campaign_link
 *
 * Cf. docs/emailing/admin-evolution/02-backend/05-listmonk-sync.md
 */
import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import {
  emailAudienceSnapshot,
  emailAudienceSnapshotMember,
} from '@/lib/db/schema-emails';
import { logger } from '@/lib/logging/logger';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

export type PushSnapshotResult = {
  listmonkListId: number;
  listmonkListName: string;
  pushed: number;
  durationMs: number;
};

export type PushSnapshotOptions = {
  listName?: string;
  /** Override fetch implementation (tests via MSW). */
  fetchImpl?: typeof fetch;
};

type ListmonkConfig = {
  url: string;
  user: string;
  token: string;
};

function getListmonkConfig(): ListmonkConfig | null {
  const url = process.env.LISTMONK_INTERNAL_URL;
  const user = process.env.LISTMONK_API_USER;
  const token = process.env.LISTMONK_API_TOKEN;
  if (!url || !user || !token) return null;
  return { url, user, token };
}

function basicAuth(user: string, token: string): string {
  return 'Basic ' + Buffer.from(`${user}:${token}`).toString('base64');
}

/**
 * Push une snapshot vers Listmonk comme liste éphémère.
 * Idempotent : si snapshot a déjà listmonk_list_id, retourne sans rien faire.
 */
export async function pushSnapshotToListmonk(
  snapshotId: string,
  opts: PushSnapshotOptions = {},
): Promise<PushSnapshotResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const config = getListmonkConfig();
  if (!config) {
    throw new Error('Listmonk not configured (LISTMONK_INTERNAL_URL/USER/TOKEN required)');
  }
  const drizzle = requireDb();
  const start = Date.now();

  // 1. Charger snapshot
  const snapshots = await drizzle
    .select()
    .from(emailAudienceSnapshot)
    .where(eq(emailAudienceSnapshot.id, snapshotId))
    .limit(1);
  const snapshot = snapshots[0];
  if (!snapshot) throw new Error(`Snapshot not found: ${snapshotId}`);

  // 2. Idempotency : déjà pushed → return existing
  if (snapshot.listmonkListId) {
    return {
      listmonkListId: snapshot.listmonkListId,
      listmonkListName: snapshot.listmonkListName ?? '',
      pushed: snapshot.size,
      durationMs: 0,
    };
  }

  // 3. Compute list name
  const listName =
    opts.listName ??
    `fg-snap-${snapshotId.slice(0, 8)}-${Date.now().toString(36)}`;

  // 4. Create Listmonk list
  const createRes = await fetchImpl(`${config.url}/api/lists`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: basicAuth(config.user, config.token),
    },
    body: JSON.stringify({
      name: listName,
      type: 'private',
      optin: 'single',
      tags: ['ephemeral'],
    }),
  });
  if (!createRes.ok) {
    throw new Error(`Listmonk create list failed: ${createRes.status}`);
  }
  const createBody = (await createRes.json()) as { data: { id: number } };
  const listId = createBody.data.id;

  // 5. Update snapshot with list ID (atomic + early so we can recover)
  await drizzle
    .update(emailAudienceSnapshot)
    .set({ listmonkListId: listId, listmonkListName: listName })
    .where(eq(emailAudienceSnapshot.id, snapshotId));

  // 6. Fetch members + push by chunks
  const members = await drizzle
    .select({ email: emailAudienceSnapshotMember.email })
    .from(emailAudienceSnapshotMember)
    .where(eq(emailAudienceSnapshotMember.snapshotId, snapshotId));

  // Listmonk's /api/import/subscribers expects multipart CSV — we use the
  // per-subscriber /api/subscribers endpoint instead. Handles 409 (existing
  // email) by looking up the subscriber and bulk-adding to the list.
  let pushed = 0;
  for (const m of members) {
    const res = await fetchImpl(`${config.url}/api/subscribers`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: basicAuth(config.user, config.token),
      },
      body: JSON.stringify({
        email: m.email,
        status: 'enabled',
        lists: [listId],
        preconfirm_subscriptions: true,
      }),
    });
    if (res.ok) {
      pushed += 1;
      continue;
    }
    if (res.status === 409) {
      // Existing subscriber → query by email then attach to list
      try {
        const q = encodeURIComponent(`subscribers.email = '${m.email.replace(/'/g, "''")}'`);
        const lookupRes = await fetchImpl(
          `${config.url}/api/subscribers?query=${q}&per_page=1`,
          { headers: { authorization: basicAuth(config.user, config.token) } },
        );
        if (!lookupRes.ok) throw new Error(`lookup ${lookupRes.status}`);
        const lookup = (await lookupRes.json()) as {
          data?: { results?: Array<{ id: number }> };
        };
        const subId = lookup.data?.results?.[0]?.id;
        if (!subId) throw new Error('subscriber not found after 409');
        const addRes = await fetchImpl(`${config.url}/api/subscribers/lists`, {
          method: 'PUT',
          headers: {
            'content-type': 'application/json',
            authorization: basicAuth(config.user, config.token),
          },
          body: JSON.stringify({
            ids: [subId],
            action: 'add',
            target_list_ids: [listId],
            status: 'confirmed',
          }),
        });
        if (!addRes.ok) throw new Error(`add ${addRes.status}`);
        pushed += 1;
      } catch (err) {
        logger.warn('listmonk.subscriber.attach_failed', {
          snapshotId,
          listId,
          email: m.email,
          error: String(err),
        });
      }
      continue;
    }
    const body = await res.text().catch(() => '');
    logger.warn('listmonk.subscriber.create_failed', {
      snapshotId,
      listId,
      email: m.email,
      status: res.status,
      body: body.slice(0, 200),
    });
  }

  const durationMs = Date.now() - start;
  logger.info('listmonk.snapshot.pushed', {
    snapshotId,
    listmonkListId: listId,
    listName,
    pushed,
    total: members.length,
    durationMs,
  });

  return {
    listmonkListId: listId,
    listmonkListName: listName,
    pushed,
    durationMs,
  };
}

/**
 * Cleanup des listes Listmonk éphémères dont le snapshot est purgeable.
 * À appeler depuis cron quotidien après purgeExpiredSnapshots().
 */
export async function cleanupExpiredListmonkLists(opts: {
  fetchImpl?: typeof fetch;
} = {}): Promise<{ purged: number }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const config = getListmonkConfig();
  if (!config) return { purged: 0 };
  const drizzle = requireDb();

  // Récupérer les snapshots expirés *qui ont* une liste Listmonk
  const expired = await drizzle
    .select({
      id: emailAudienceSnapshot.id,
      listmonkListId: emailAudienceSnapshot.listmonkListId,
    })
    .from(emailAudienceSnapshot)
    .where(sql`${emailAudienceSnapshot.listmonkListId} IS NOT NULL AND ${emailAudienceSnapshot.purgeableAfter} < now()`);

  let purged = 0;
  for (const snap of expired) {
    if (!snap.listmonkListId) continue;
    try {
      const res = await fetchImpl(`${config.url}/api/lists/${snap.listmonkListId}`, {
        method: 'DELETE',
        headers: { authorization: basicAuth(config.user, config.token) },
      });
      if (res.ok || res.status === 404) {
        // 404 = déjà sup côté Listmonk, on accepte
        await drizzle
          .update(emailAudienceSnapshot)
          .set({ listmonkListId: null })
          .where(eq(emailAudienceSnapshot.id, snap.id));
        purged += 1;
      } else {
        logger.warn('listmonk.cleanup.delete_failed', {
          snapshotId: snap.id,
          listmonkListId: snap.listmonkListId,
          status: res.status,
        });
      }
    } catch (err) {
      logger.error('listmonk.cleanup.exception', {
        snapshotId: snap.id,
        error: String(err),
      });
    }
  }

  logger.info('listmonk.cleanup.completed', { purged, candidates: expired.length });
  return { purged };
}
