# `driftDetector` — détection runtime continue

## Vue d'ensemble

Le `driftDetector` est appelé à chaque ping reçu. Il :
1. Charge l'état admin (versions actives).
2. Compare avec le ping.
3. Classifie (`ok`/`warning`/`critical`).
4. Persiste la transition si le statut change.
5. Déclenche les side effects (email, log).

## Localisation

`apps/web/src/lib/tracking/gtm/drift-detector.ts`

## API

```ts
export async function recomputeDriftFromPing(pingId: string): Promise<DriftState>;
export async function getCurrentDriftState(): Promise<DriftState>;
export async function recomputeDriftFromTimer(): Promise<DriftState>;  // cron silence-check
```

## Pseudo-code

```ts
export async function recomputeDriftFromPing(pingId: string): Promise<DriftState> {
  // 1. Charge le ping
  const ping = await db.select().from(sentinelPings).where(eq(sentinelPings.id, pingId)).limit(1);
  if (!ping[0]) throw new Error('ping_not_found');

  // 2. Charge état admin (version active mapping + config)
  const admin = await loadAdminSnapshot();

  // 3. Classifie (logique drift-rules.md)
  const newStatus = classifyDrift({
    admin,
    lastPing: ping[0],
    lastEditAt: admin.lastEditAt,
    now: new Date(),
  });

  // 4. Charge état précédent
  const prev = await db.select().from(driftState).where(eq(driftState.id, 'singleton')).limit(1);

  // 5. Hystérésis (anti-flapping) : ne pas changer si le précédent a < 5 min
  if (prev[0] && prev[0].status !== newStatus.status) {
    const sinceMin = (Date.now() - prev[0].since.getTime()) / 60_000;
    if (sinceMin < 5 && newStatus.status === 'ok') {
      // garde le critical/warning en place pendant 5 min minimum
      return prev[0] as DriftState;
    }
  }

  // 6. Persiste
  await db.update(driftState).set({
    status: newStatus.status,
    since: newStatus.since,
    reasonsJson: newStatus.reasons,
    lastPingId: pingId,
    lastCheckAt: new Date(),
    adminSnapshot: admin,
    updatedAt: new Date(),
  });

  // 7. Side effects sur transition
  if (prev[0]?.status !== newStatus.status) {
    await db.insert(driftHistory).values({
      previousStatus: prev[0]?.status ?? null,
      newStatus: newStatus.status,
      reasonsJson: newStatus.reasons,
      triggeredByPingId: pingId,
    });
    await notifyOnTransition(prev[0]?.status, newStatus);
  }

  return newStatus;
}
```

## `notifyOnTransition`

```ts
async function notifyOnTransition(from: DriftStatusEnum | undefined, to: DriftState) {
  if (to.status === 'critical' && from !== 'critical') {
    // Immédiat
    await sendAdminEmail({
      template: 'gtm-drift-critical',
      data: { reasons: to.reasons, linkTo: '/admin/tracking/gtm/sync-status' },
    });
    logger.error('gtm.drift.critical', { reasons: to.reasons });
  } else if (to.status === 'warning' && from !== 'warning') {
    // Digest journalier seulement (pas immédiat)
    await markForDailyDigest({ kind: 'gtm-drift-warning', reasons: to.reasons });
    logger.warn('gtm.drift.warning', { reasons: to.reasons });
  } else if (to.status === 'ok' && from !== 'ok') {
    logger.info('gtm.drift.resolved', { previousReasons: from });
    // Pas d'email "résolu" (silence positif)
  }
}
```

## `loadAdminSnapshot`

```ts
async function loadAdminSnapshot(): Promise<AdminSnapshot> {
  const activeMapping = await getActiveMappingVersion();   // depuis event-mappings
  const containerId = await getConfiguredGtmContainerId(); // depuis tracking_providers ou env
  return {
    mappingVersion: activeMapping.name,
    configVersion: 'v?',   // TODO Phase 2 : récupérer depuis un endpoint config GTM ou un env
    bundleId: activeMapping.bundleId,  // stocké lors de l'export
    containerId,
    lastEditAt: activeMapping.activatedAt,
  };
}
```

## Cron silence-check

```ts
// apps/web/src/app/api/cron/gtm-silence-check/route.ts
export async function POST(request: Request) {
  authenticateCron(request);
  const state = await recomputeDriftFromTimer();
  return NextResponse.json({ ok: true, status: state.status });
}
```

Appelé toutes les heures par Vercel cron (`vercel.json`).

## Cas limites

| Cas | Comportement |
|---|---|
| DB down lors du `INSERT INTO pings` | Retry x3 puis log Sentry. Côté GTM, on s'en moque (sendBeacon). |
| 2 pings simultanés (race) | Le 2ème update écrasera le 1er, OK car idempotent. |
| Edge case ping vient avant que le mapping admin ait été activé | Statut `warning` avec raison `mapping_version_drift` côté admin lui-même → on attend le prochain ping. |
| Container ID admin pas configuré | Statut `warning` `container_id_unknown` jusqu'à config. |
