# Repos — diffs précis

> Modifications aux 2 repos qui INSÈRENT dans `chat_session` pour rendre explicite le `kind`.

## 1. `sessionRepo` (chat natif)

**Fichier** : `apps/web/src/lib/chat/repos/session.ts`

**Diff** :

```diff
 /**
  * CHA-018 — Repository chat_session.
+ * CHA-LEAD-V2-01 — Insère explicitement `kind: 'chat'` pour tracer le path.
  */
 import { and, desc, eq, sql } from 'drizzle-orm';

 import { createId } from '@/lib/ids';
+import { logger } from '@/lib/logging/logger';

 import { requireChatDb } from '../db/client';
 import { chatSession, type ChatSessionInsert, type ChatSessionRow } from '../db/schema';

 export const sessionRepo = {
   // ... getById, getActiveByVisitor, listByVisitor inchangés ...

   async create(insert: Omit<ChatSessionInsert, 'id'>): Promise<ChatSessionRow> {
     const db = requireChatDb();
     const id = createId('cs');
-    const rows = await db.insert(chatSession).values({ ...insert, id }).returning();
+    // CHA-LEAD-V2-01 — On laisse insert.kind override possible (utile pour
+    // tests/seed) mais on garantit le default 'chat' explicite pour traçabilité.
+    const kind = insert.kind ?? 'chat';
+    const rows = await db.insert(chatSession).values({ ...insert, id, kind }).returning();
+    logger.info('chat.session.create', {
+      sessionId: id,
+      kind,
+      visitorId: insert.visitorId,
+      page: insert.page,
+    });
     return rows[0]!;
   },

   // ... update, touch, archive, forget inchangés ...
 };
```

**Notes** :
- `kind` est optional dans `insert` (Drizzle infère du schema avec default). On reste backward-compatible.
- Le log est essentiel pour différencier en prod les insert chat vs wizard.

## 2. `wizardSessionRepo` (wizard checkout)

**Fichier** : `apps/web/src/lib/checkout/repos/session-repo.ts`

**Diff** :

```diff
 /**
  * CHA-230 — Repository chat_session côté wizard (init paresseuse).
+ * CHA-LEAD-V2-01 — Insère explicitement `kind: 'wizard_pivot'` pour
+ * permettre la discrimination admin (filtres /admin/chat/conversations).
  */
 import { eq, sql } from 'drizzle-orm';

+import { logger } from '@/lib/logging/logger';
 import { requireChatDb } from '@/lib/chat/db/client';
 import { chatSession, type ChatSessionRow } from '@/lib/chat/db/schema';
 import { instructionRepo } from '@/lib/chat/repos/instruction';

 export const wizardSessionRepo = {
   async ensureForWizard(input: EnsureWizardSessionInput): Promise<ChatSessionRow> {
     const db = requireChatDb();

     // Fast path : la session existe déjà.
     const existing = await db
       .select()
       .from(chatSession)
       .where(eq(chatSession.id, input.sessionId))
       .limit(1);
     if (existing[0]) return existing[0];

     // Slow path : il faut créer la row. Exige une version d'instruction active.
     const active = await instructionRepo.active();
     if (!active) throw new NoActiveInstructionError();

     // INSERT ... ON CONFLICT DO NOTHING pour gérer la concurrence.
     const inserted = await db
       .insert(chatSession)
       .values({
         id: input.sessionId,
+        kind: 'wizard_pivot',         // <-- CHA-LEAD-V2-01
         visitorId: input.visitorId,
         language: input.language ?? 'fr',
         page: input.page ?? null,
         referrer: input.referrer ?? null,
         utm: input.utm ?? null,
         instructionVersionId: active.id,
         status: 'open',
       })
       .onConflictDoNothing({ target: chatSession.id })
       .returning();

     if (inserted[0]) {
+      logger.info('chat.session.create', {
+        sessionId: inserted[0].id,
+        kind: 'wizard_pivot',
+        visitorId: input.visitorId,
+        page: input.page ?? null,
+      });
       return inserted[0];
     }

     // Conflit → autre requête a gagné la course. Relire la row.
     const recheck = await db
       .select()
       .from(chatSession)
       .where(eq(chatSession.id, input.sessionId))
       .limit(1);
     if (!recheck[0]) {
       throw new Error('chat_session insertion race condition');
     }
     return recheck[0];
   },

   // ... touch inchangé ...
 };
```

## 3. `wizardLeadRepo` (lead wizard) — pas de modif

Le repo lead wizard est déjà correct : il insère `source` selon `input.source`. Aucune modification requise.

## 4. Tests d'invariant repos

**Fichier nouveau** : `apps/web/src/lib/chat/repos/session.kind.test.ts`

```ts
/**
 * CHA-LEAD-V2-01 — Vérifie que `sessionRepo.create()` insère bien kind='chat'.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client', () => {
  const mockChain = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  };
  return {
    requireChatDb: () => mockChain,
    __mockChain: mockChain,
  };
});

import { sessionRepo } from './session';

describe('sessionRepo.create — kind invariant', () => {
  const { __mockChain } = await import('../db/client') as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('insère kind="chat" par défaut', async () => {
    __mockChain.returning.mockResolvedValue([{ id: 'cs_test', kind: 'chat' }]);

    await sessionRepo.create({
      visitorId: 'v_test',
      language: 'fr',
      page: '/kit',
      referrer: null,
      instructionVersionId: 'iv_test',
      status: 'open',
    });

    expect(__mockChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'chat' }),
    );
  });

  it('respecte un kind override (utile pour seed/tests)', async () => {
    __mockChain.returning.mockResolvedValue([{ id: 'cs_sys', kind: 'system' }]);

    await sessionRepo.create({
      kind: 'system',
      visitorId: 'v_sys',
      language: 'fr',
      page: null,
      referrer: null,
      instructionVersionId: 'iv_test',
      status: 'open',
    });

    expect(__mockChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'system' }),
    );
  });

  it('génère un id préfixe cs_', async () => {
    __mockChain.returning.mockResolvedValue([{ id: 'cs_abc' }]);

    await sessionRepo.create({
      visitorId: 'v_test',
      language: 'fr',
      page: null,
      referrer: null,
      instructionVersionId: 'iv_test',
      status: 'open',
    });

    expect(__mockChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringMatching(/^cs_[a-z0-9]{20}$/),
      }),
    );
  });
});
```

**Fichier nouveau** : `apps/web/src/lib/checkout/repos/session-repo.kind.test.ts`

```ts
/**
 * CHA-LEAD-V2-01 — Vérifie que `wizardSessionRepo.ensureForWizard()` insère
 * bien kind='wizard_pivot'.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock similaire au précédent
vi.mock('@/lib/chat/db/client');
vi.mock('@/lib/chat/repos/instruction', () => ({
  instructionRepo: {
    active: vi.fn().mockResolvedValue({ id: 'iv_test', isActive: true }),
  },
}));

import { wizardSessionRepo } from './session-repo';

describe('wizardSessionRepo.ensureForWizard — kind invariant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('insère kind="wizard_pivot" pour une nouvelle session', async () => {
    // ... setup chain mock pour fast path (no existing) puis insert ...
    const mockInsert = vi.fn().mockResolvedValue([{
      id: 's_test',
      kind: 'wizard_pivot',
    }]);
    
    await wizardSessionRepo.ensureForWizard({
      sessionId: 's_test',
      visitorId: 'v_test',
      language: 'fr',
      page: '/kit',
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'wizard_pivot' }),
    );
  });

  it('ne touche pas une session existante (idempotence)', async () => {
    // Mock existing row
    // ... assert no insert called ...
  });
});
```

## 5. Logging — convention

Tous les inserts dans `chat_session` doivent logger un événement structuré pour permettre l'audit ex-post :

```json
{
  "level": "info",
  "event": "chat.session.create",
  "sessionId": "cs_xxx | s_xxx",
  "kind": "chat | wizard_pivot | system",
  "visitorId": "v_xxx",
  "page": "/kit | null",
  "ts": "ISO 8601"
}
```

Cela permet de tracker en prod la répartition des kind sans avoir à query la DB.

## 6. Liste exhaustive des INSERT chat_session

Avant le fix, on cherchait `chatSession` insert. Liste complète des paths :

| Path | Fichier | Kind après fix |
|---|---|---|
| Chat widget bootstrap | `src/lib/chat/repos/session.ts:create()` | `'chat'` |
| Wizard step 1 | `src/lib/checkout/repos/session-repo.ts:ensureForWizard()` | `'wizard_pivot'` |
| Newsletter standalone (s'il existe) | À chercher / inexistant aujourd'hui | `'system'` (à câbler) |
| Admin seed (tests / dev) | `scripts/seed-chat.ts` (s'il existe) | `'chat'` par défaut |

**Vérification** : grep pour s'assurer qu'aucun INSERT ne contourne ces 2 repos :

```bash
grep -rn "insert(chatSession)" apps/web/src --include="*.ts" | grep -v test
```

Attendu : seulement `session.ts:46` et `session-repo.ts:81`.

Si d'autres apparaissent → audit complémentaire requis avant merge.
