// @vitest-environment node
/**
 * Module 09 — Parcours client : unsubscribe public (RFC 8058) en VRAIE DB.
 *
 * Cette suite exerce les handlers GET/POST réels de
 * `src/app/api/mail/unsubscribe/route.ts` contre une vraie DB de test
 * (femiglow_test_m09parcours). Contrairement à `route.test.ts` (fake-drizzle,
 * mock de verifyUnsubToken), on signe ici de VRAIS tokens et on vérifie les
 * EFFETS DE BORD persistés : insertion `email_suppression(reason=unsubscribe)`
 * + bascule `email_subscriber_link.status='disabled'`. On démontre aussi la
 * garantie « plus aucun envoi nulle part » (CLI-INT-UNSUB-NOWHERE) en montrant
 * que `sendTransactional` retourne `suppressed` pour l'adresse désinscrite, et
 * l'idempotence du double-clic (CLI-INT-UNSUB-IDEM via onConflictDoNothing).
 *
 * Lancement :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_m09parcours#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *       src/app/api/mail/unsubscribe/__tests__/route.integration.test.ts
 *
 * Matrice : CLI-INT-UNSUB-TOKEN-KO, CLI-INT-UNSUB-IDEM, CLI-INT-UNSUB-NOWHERE.
 */
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

// Le module env parse process.env à l'import : poser le secret AVANT toute
// import hoistée — la suite signe de VRAIS tokens et ne doit pas dépendre
// d'un MAIL_UNSUB_TOKEN_SECRET présent dans .env.test (autosuffisance).
vi.hoisted(() => {
  process.env.MAIL_UNSUB_TOKEN_SECRET ??= 'qa-unsub-route-secret-0123456789abcdef';
});

// Le rate-limit est auxiliaire au parcours métier ; sans Redis configuré il
// pourrait bloquer ou throw. On le neutralise (toujours « autorisé ») pour
// isoler l'oracle métier (suppression + bascule subscriber_link).
vi.mock('@/lib/mail/rate-limit', () => ({
  enforceMailRateLimit: vi.fn().mockResolvedValue(null),
}));

// SMTP mock inerte : la garantie CLI-INT-UNSUB-NOWHERE passe par le statut
// `suppressed` de sendTransactional (qui court-circuite AVANT tout SMTP). On
// stubbe le transporter pour qu'aucun envoi réel ne parte si jamais le code
// l'atteignait (il ne doit pas).
const sendMailCalls: unknown[] = [];
vi.mock('@/lib/mail/client', () => ({
  SmtpNotConfiguredError: class extends Error {
    readonly code = 'SMTP_NOT_CONFIGURED';
  },
  getTransporter: () => ({
    sendMail: async (opts: unknown) => {
      sendMailCalls.push(opts);
      return { messageId: '<msg@test>', response: '250 OK' };
    },
  }),
}));

import { emailSuppression, emailSubscriberLink } from '@/lib/db/schema-emails';
import { __setTestDb, __resetTestDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { makeSubscriberLink } from '@/test/factories/emails.factory';
import { generateUnsubToken } from '@/lib/mail/unsub-token';
import { POST, GET } from '../route';
import { sendTransactional } from '@/lib/mail/send';

const db = () => emailsTestDb();

function unsubReq(method: 'GET' | 'POST', token?: string): Request {
  const url =
    token === undefined
      ? 'http://localhost/api/mail/unsubscribe'
      : `http://localhost/api/mail/unsubscribe?t=${encodeURIComponent(token)}`;
  return new Request(url, { method });
}

beforeAll(() => {
  __setTestDb(emailsTestDb() as never);
});

beforeEach(async () => {
  await truncateEmailTables();
  sendMailCalls.length = 0;
});

afterAll(async () => {
  __resetTestDb();
  await closeTestDb();
});

describeEmailsDb('unsubscribe route (vraie DB) — effets de bord persistés', () => {
  // CLI-INT-UNSUB-NOWHERE (volet 1) — POST one-click : token valide →
  // suppression insérée + subscriber_link basculé `disabled`, réponse 200 JSON.
  it('POST token valide : suppression INSERT + subscriber_link disabled + 200 JSON', async () => {
    const email = 'kaoutar-unsub@exemple.test';
    // Pré-état : la cliente est une abonnée ENABLED (double opt-in confirmé).
    await db().insert(emailSubscriberLink).values(
      makeSubscriberLink({ email, status: 'enabled', unsubscribedAt: null }),
    );

    const token = generateUnsubToken(email);
    const res = await POST(unsubReq('POST', token) as never);

    // Oracle 1 — réponse one-click conforme (200 JSON, pas de HTML).
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ ok: true });

    // Oracle 2 — une ligne de suppression `unsubscribe` est posée.
    const supp = await db()
      .select()
      .from(emailSuppression)
      .where(eq(emailSuppression.email, email));
    expect(supp).toHaveLength(1);
    expect(supp[0]!.reason).toBe('unsubscribe');
    expect(supp[0]!.source).toBe('manual');
    expect(supp[0]!.detail).toBe('list-unsubscribe-one-click');

    // Oracle 3 — l'abonnement est basculé `disabled` avec un horodatage.
    const link = await db()
      .select()
      .from(emailSubscriberLink)
      .where(eq(emailSubscriberLink.email, email));
    expect(link).toHaveLength(1);
    expect(link[0]!.status).toBe('disabled');
    expect(link[0]!.unsubscribedAt).toBeInstanceOf(Date);
  });

  // CLI-INT-UNSUB-NOWHERE (volet 2) — la garantie forte : après désabonnement,
  // un envoi transactionnel FemiGlow vers cette adresse est REFUSÉ (status
  // suppressed) AVANT tout INSERT outbox et tout SMTP.
  it('après unsub, sendTransactional vers l\'adresse renvoie `suppressed` (plus aucun envoi)', async () => {
    const email = 'plus-rien@exemple.test';
    const token = generateUnsubToken(email);
    const res = await POST(unsubReq('POST', token) as never);
    expect(res.status).toBe(200);

    // Oracle — un envoi ultérieur (ex. confirmation de commande) est bloqué.
    const send = await sendTransactional({
      template: 'order-confirmation',
      to: { email, name: 'Kaoutar' },
      payload: {
        firstName: 'Kaoutar',
        orderId: 'FG-UNSUB-1',
        orderTotal: '199.00 MAD',
        itemsCount: 1,
        deliveryEstimate: '2-4 jours ouvrés',
      },
      idempotencyKey: 'order-confirm:FG-UNSUB-1',
      source: 'test',
    });
    expect(send.status).toBe('suppressed');
    expect(send.outboxId).toBeNull();
    // Et AUCUN SMTP n'a été tenté (court-circuit en amont du render/INSERT).
    expect(sendMailCalls).toHaveLength(0);
  });

  // CLI-INT-UNSUB-TOKEN-KO — token invalide → 400, AUCUNE écriture en base
  // (ni suppression, ni mutation subscriber_link). Pas de 500, pas de fuite.
  it('POST token invalide : 400 et aucune écriture (ni suppression ni subscriber)', async () => {
    // Une ligne abonnée préexistante NE doit PAS être touchée par un token KO.
    const email = 'intacte@exemple.test';
    await db().insert(emailSubscriberLink).values(
      makeSubscriberLink({ email, status: 'enabled', unsubscribedAt: null }),
    );

    const res = await POST(unsubReq('POST', 'ceci-nest-pas-un-token') as never);

    // Oracle 1 — refus propre (400, jamais 500).
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('invalid-or-expired');

    // Oracle 2 — table de suppression totalement vide.
    const supp = await db().select().from(emailSuppression);
    expect(supp).toHaveLength(0);

    // Oracle 3 — l'abonnée préexistante reste ENABLED (non touchée).
    const link = await db()
      .select()
      .from(emailSubscriberLink)
      .where(eq(emailSubscriberLink.email, email));
    expect(link[0]!.status).toBe('enabled');
    expect(link[0]!.unsubscribedAt).toBeNull();
  });

  // CLI-INT-UNSUB-TOKEN-KO (variante expiré) — un token réel mais expiré est
  // rejeté comme un token falsifié : 400, aucune écriture. On signe à une date
  // ancienne pour que `now` > exp (la route utilise Date.now() courant).
  it('POST token EXPIRÉ : 400 et aucune suppression', async () => {
    const email = 'expire@exemple.test';
    // Token signé il y a 100 jours (validité = 90 j) → expiré au verify courant.
    const past = Date.now() - 100 * 24 * 60 * 60 * 1000;
    const expiredToken = generateUnsubToken(email, past);

    const res = await POST(unsubReq('POST', expiredToken) as never);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('invalid-or-expired');

    const supp = await db().select().from(emailSuppression);
    expect(supp).toHaveLength(0);
  });

  // CLI-INT-UNSUB-TOKEN-KO (variante token absent) — POST sans `t` → 400
  // `missing-token`, aucune écriture.
  it('POST sans token : 400 missing-token, aucune écriture', async () => {
    const res = await POST(unsubReq('POST') as never);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('missing-token');
    expect(await db().select().from(emailSuppression)).toHaveLength(0);
  });

  // CLI-INT-UNSUB-IDEM — double-clic / re-soumission one-click : 2 POST avec le
  // même token → toujours 200, et UNE SEULE ligne de suppression (la PK email +
  // onConflictDoNothing garantit l'idempotence ; pas de doublon, pas de crash).
  it('double POST même token : idempotent → 1 seule suppression, toujours 200', async () => {
    const email = 'double-clic@exemple.test';
    await db().insert(emailSubscriberLink).values(
      makeSubscriberLink({ email, status: 'enabled', unsubscribedAt: null }),
    );
    const token = generateUnsubToken(email);

    const res1 = await POST(unsubReq('POST', token) as never);
    const res2 = await POST(unsubReq('POST', token) as never);

    // Oracle 1 — les deux clics renvoient 200 (confirmation stable).
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // Oracle 2 — exactement une ligne de suppression (ON CONFLICT DO NOTHING).
    const supp = await db()
      .select()
      .from(emailSuppression)
      .where(eq(emailSuppression.email, email));
    expect(supp).toHaveLength(1);

    // Oracle 3 — subscriber_link reste `disabled` (re-UPDATE idempotent).
    const link = await db()
      .select()
      .from(emailSubscriberLink)
      .where(eq(emailSubscriberLink.email, email));
    expect(link[0]!.status).toBe('disabled');
  });

  // UX4-PARCOURS-004 (GET non destructif) — clic/préfetch depuis le lien d'un
  // email : page de CONFIRMATION HTML 200, mais AUCUNE suppression posée et
  // subscriber_link INTACT. C'est le cœur du fix UX-PUB-004 : un préfetch GET
  // (Gmail/Outlook safelinks, antivirus) ne doit plus désinscrire sans
  // intention. La suppression n'a lieu qu'au POST.
  it('UX4-PARCOURS-004 : GET token valide → page « Confirmer » NON destructive (0 suppression, link intact)', async () => {
    const email = 'lien-email@exemple.test';
    await db().insert(emailSubscriberLink).values(
      makeSubscriberLink({ email, status: 'enabled', unsubscribedAt: null }),
    );
    const token = generateUnsubToken(email);

    const res = await GET(unsubReq('GET', token) as never);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    // La page invite à CONFIRMER (≠ « désinscription confirmée » de l'ancienne
    // version qui agissait immédiatement) et nomme l'adresse + le réabonnement.
    expect(html).toContain('Confirmer la désinscription');
    expect(html).toContain(email);
    expect(html).toContain('Me réabonner');
    // Pas de fuite technique dans la page rendue.
    expect(html).not.toMatch(/stack|exception/i);

    // Oracle central UX-PUB-004 : le GET n'a RIEN supprimé.
    const supp = await db()
      .select()
      .from(emailSuppression)
      .where(eq(emailSuppression.email, email));
    expect(supp).toHaveLength(0);
    // Le subscriber_link reste ENABLED, non touché.
    const link = await db()
      .select()
      .from(emailSubscriberLink)
      .where(eq(emailSubscriberLink.email, email));
    expect(link[0]!.status).toBe('enabled');
    expect(link[0]!.unsubscribedAt).toBeNull();
  });

  // UX4-PARCOURS-004 (POST destructif après confirmation) — le POST du même
  // token (déclenché par le bouton « Confirmer » de la page) exécute bien la
  // suppression. GET puis POST : seul le POST écrit.
  it('UX4-PARCOURS-004 : GET (rien) puis POST (token) → suppression posée par le POST seul', async () => {
    const email = 'confirme-apres-get@exemple.test';
    await db().insert(emailSubscriberLink).values(
      makeSubscriberLink({ email, status: 'enabled', unsubscribedAt: null }),
    );
    const token = generateUnsubToken(email);

    // 1. GET = page de confirmation, aucun effet.
    await GET(unsubReq('GET', token) as never);
    expect(
      await db().select().from(emailSuppression).where(eq(emailSuppression.email, email)),
    ).toHaveLength(0);

    // 2. POST = exécution de la désinscription.
    const post = await POST(unsubReq('POST', token) as never);
    expect(post.status).toBe(200);
    const supp = await db()
      .select()
      .from(emailSuppression)
      .where(eq(emailSuppression.email, email));
    expect(supp).toHaveLength(1);
    expect(supp[0]!.reason).toBe('unsubscribe');
    const link = await db()
      .select()
      .from(emailSubscriberLink)
      .where(eq(emailSubscriberLink.email, email));
    expect(link[0]!.status).toBe('disabled');
  });

  // UX4-PARCOURS-005 — réabonnement : après une désinscription, POST
  // action=resubscribe retire la suppression `unsubscribe` ET ré-active le
  // subscriber_link. Chemin de retour direct (UX-PUB-005).
  it('UX4-PARCOURS-005 : POST action=resubscribe retire la suppression + ré-active le link', async () => {
    const email = 'reabo@exemple.test';
    await db().insert(emailSubscriberLink).values(
      makeSubscriberLink({ email, status: 'enabled', unsubscribedAt: null }),
    );
    const token = generateUnsubToken(email);

    // Désinscription d'abord.
    await POST(unsubReq('POST', token) as never);
    expect(
      await db().select().from(emailSuppression).where(eq(emailSuppression.email, email)),
    ).toHaveLength(1);

    // Réabonnement.
    const reReq = new Request(
      `http://localhost/api/mail/unsubscribe?action=resubscribe&t=${encodeURIComponent(token)}`,
      { method: 'POST' },
    );
    const res = await POST(reReq as never);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('Réabonnement confirmé');

    // Oracle 1 — la suppression `unsubscribe` est retirée.
    const supp = await db()
      .select()
      .from(emailSuppression)
      .where(eq(emailSuppression.email, email));
    expect(supp).toHaveLength(0);
    // Oracle 2 — le subscriber_link est ré-activé.
    const link = await db()
      .select()
      .from(emailSubscriberLink)
      .where(eq(emailSubscriberLink.email, email));
    expect(link[0]!.status).toBe('enabled');
    expect(link[0]!.unsubscribedAt).toBeNull();
  });

  // UX4-PARCOURS-005 (garde-fou : ne réveille PAS un bounce) — le réabonnement
  // ne retire QUE la suppression `unsubscribe`. Une adresse suppressée pour
  // `hard_bounce` reste suppressée après un POST resubscribe (on ne ré-injecte
  // pas une adresse qui rebondit).
  it('UX4-PARCOURS-005 : resubscribe ne touche pas une suppression `hard_bounce`', async () => {
    const email = 'rebondit@exemple.test';
    await db().insert(emailSuppression).values({
      email,
      reason: 'hard_bounce',
      detail: 'hard bounce',
      source: 'stalwart',
    });
    const token = generateUnsubToken(email);

    const reReq = new Request(
      `http://localhost/api/mail/unsubscribe?action=resubscribe&t=${encodeURIComponent(token)}`,
      { method: 'POST' },
    );
    const res = await POST(reReq as never);
    expect(res.status).toBe(200);

    // La suppression `hard_bounce` est PRÉSERVÉE.
    const supp = await db()
      .select()
      .from(emailSuppression)
      .where(eq(emailSuppression.email, email));
    expect(supp).toHaveLength(1);
    expect(supp[0]!.reason).toBe('hard_bounce');
  });

  // CLI-INT-UNSUB-TOKEN-KO (GET) — token invalide → page d'erreur DIGNE :
  // 400, HTML « Lien invalide », aucune fuite d'info (pas d'email, pas de
  // détail technique), aucune écriture.
  it('GET token invalide : 400 page « Lien invalide » sans fuite, aucune écriture', async () => {
    const res = await GET(unsubReq('GET', 'token-pourri') as never);
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('Lien invalide');
    // Oracle anti-fuite : la page d'erreur n'expose ni la raison technique
    // interne (`invalid-or-expired`) ni un quelconque email.
    expect(html).not.toContain('invalid-or-expired');
    expect(html).not.toContain('@exemple.test');

    expect(await db().select().from(emailSuppression)).toHaveLength(0);
  });

  // CLI-INT-UNSUB (sans subscriber_link) — un destinataire transactionnel pur
  // (jamais inscrit newsletter, donc pas de ligne subscriber_link) se désinscrit
  // quand même : la suppression est posée, l'UPDATE subscriber_link ne matche
  // rien mais ne fait pas échouer la transaction.
  it('unsub d\'une adresse sans subscriber_link : suppression posée, pas de crash', async () => {
    const email = 'jamais-inscrite@exemple.test';
    const token = generateUnsubToken(email);

    const res = await POST(unsubReq('POST', token) as never);
    expect(res.status).toBe(200);

    const supp = await db()
      .select()
      .from(emailSuppression)
      .where(eq(emailSuppression.email, email));
    expect(supp).toHaveLength(1);
    // Aucune ligne subscriber_link n'a été créée par effet de bord.
    const link = await db()
      .select()
      .from(emailSubscriberLink)
      .where(eq(emailSubscriberLink.email, email));
    expect(link).toHaveLength(0);
  });

  // ── GARDE-FOU (bug d'origine CORRIGÉ vague 2) ──────────────────────────────
  // Historique : l'en-tête `List-Unsubscribe` de outbox.ts émettait
  //   <.../api/mail/unsubscribe?email=<adresse en clair>>
  // alors que CE handler ne lit QUE `?t=<token signé>` (route.ts:59,68) → le
  // one-click natif Gmail/Apple Mail répondait 400 missing-token sans
  // désinscrire. CORRIGÉ : outbox.ts émet désormais `?t=${generateUnsubToken}`
  // (couvert par CLI-INT-UNSUB-HDR-001/002, outbox-unsub-header.integration).
  //
  // Ce test reste comme GARDE-FOU du contrat route : la forme `?email=` (sans
  // token) DOIT être rejetée — accepter une adresse en clair permettrait de
  // désinscrire n'importe qui sans authentification.
  it('garde-fou : forme `?email=` sans token rejetée (400), aucune désinscription', async () => {
    const email = 'header-oneclick@exemple.test';
    await db().insert(emailSubscriberLink).values(
      makeSubscriberLink({ email, status: 'enabled', unsubscribedAt: null }),
    );

    // Reproduit l'ANCIENNE URL d'en-tête (param `email`, forme bugguée d'origine).
    const headerUrl = `http://localhost/api/mail/unsubscribe?email=${encodeURIComponent(email)}`;
    const res = await POST(new Request(headerUrl, { method: 'POST' }) as never);

    // Comportement ACTUEL (bug) : la route ne trouve pas `t` → 400 missing-token.
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('missing-token');

    // Conséquence du bug : AUCUNE désinscription n'a eu lieu.
    expect(await db().select().from(emailSuppression)).toHaveLength(0);
    const link = await db()
      .select()
      .from(emailSubscriberLink)
      .where(eq(emailSubscriberLink.email, email));
    expect(link[0]!.status).toBe('enabled');
  });
});
