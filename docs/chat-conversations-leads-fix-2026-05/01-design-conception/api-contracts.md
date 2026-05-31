# API Contracts — signatures cible

> Toutes les signatures publiques (queries + endpoints) après le fix.

## 1. `adminQueries.listConversations` (modifié)

```ts
async listConversations(opts: {
  q?: string;
  language?: string;
  status?: ChatSessionRow['status'];
  fromDate?: Date;
  toDate?: Date;
  converted?: 'yes' | 'no';

  /**
   * CHA-LEAD-V2 — Filtre kind (default: ['chat']).
   * Override pour vues de debug ou pages d'audit dédiées.
   */
  kinds?: ReadonlyArray<ChatSessionKind>;

  /**
   * CHA-LEAD-V2 — Si true (default), exclut les sessions sans aucun
   * `chat_message` de role='user' status='sent'.
   * Désactivable via UI `?debug=ghosts`.
   */
  withMessagesOnly?: boolean;

  limit?: number;
}): Promise<ChatSessionRow[]>
```

**Comportement** :
- Feature flag `CHAT_ADMIN_FILTERS_V2=true` : applique `kinds` (default `['chat']`) + `withMessagesOnly` (default `true`).
- Feature flag off : ignore les nouveaux opts, comportement legacy.

---

## 2. `adminQueries.listChatLeads` (modifié)

```ts
async listChatLeads(opts: {
  outcome?: ChatLeadRow['outcome'];
  triggerReason?: ChatLeadRow['triggerReason'];
  fromDate?: Date;
  toDate?: Date;

  /**
   * CHA-LEAD-V2 — Sources visibles (default: ['chat_widget', 'inline']).
   * Override pour /admin/leads (vue fusionnée) ou audit.
   */
  sources?: ReadonlyArray<ChatLeadRow['source']>;

  limit?: number;
} = {}): Promise<ChatLeadRow[]>
```

**Comportement identique** à `listConversations` : feature flag gate.

---

## 3. `adminQueries.convertedSessionIds` (modifié)

```ts
async convertedSessionIds(opts: {
  fromDate?: Date;
  toDate?: Date;
  /** Default ['chat']. */
  kinds?: ReadonlyArray<ChatSessionKind>;
} = {}): Promise<string[]>
```

**But** : ne renvoyer que les session IDs convertis pour les `chat_session.kind` voulus. Sinon, on remonte des "conversions" wizard via la JOIN sur `chat_lead`.

---

## 4. `adminQueries.overviewKpis` (modifié)

```ts
async overviewKpis(
  window: KpiWindow = '7d',
  opts?: { kinds?: ReadonlyArray<ChatSessionKind> },
): Promise<{
  window: KpiWindow;
  sessions: number;             // <-- COUNT WHERE kind IN (opts.kinds ?? ['chat'])
  messagesUser: number;
  messagesAgent: number;
  conversions: number;          // <-- DISTINCT sessions IN ('chat') converted
  leadsCaptured: number;        // <-- COUNT chat_lead WHERE source IN ('chat_widget','inline')
  leadsConverted: number;
  feedbackPos: number;
  feedbackNeg: number;
  totalCostEur: number;
  latencyP50: number | null;
  latencyP95: number | null;
}>
```

---

## 5. `adminQueries.businessFunnel` (modifié)

```ts
async businessFunnel(
  window: KpiWindow = '30d',
  opts?: { kinds?: ReadonlyArray<ChatSessionKind> },
): Promise<{
  window: KpiWindow;
  counts: {
    sessions: number;
    messagesUserSessions: number;
    leadsOffered: number;
    leadsSubmitted: number;     // <-- COUNT chat_lead WHERE source IN (chat_widget, inline)
    conversions: number;
  };
  intentCounts: Record<string, number>;
}>
```

---

## 6. `adminQueries.careOverview` (modifié)

```ts
async careOverview(opts: {
  limit?: number;
  /** Default ['chat_widget', 'inline']. */
  sources?: ReadonlyArray<ChatLeadRow['source']>;
} = {}): Promise<{
  pendingLeads: ChatLeadRow[];
  frustrationEvents: Array<{ sessionId: string; occurredAt: Date }>;
}>
```

---

## 7. `wizardSessionRepo.ensureForWizard` (modifié)

```ts
async ensureForWizard(input: {
  sessionId: string;
  visitorId: string;
  language?: string | null;
  page?: string | null;
  referrer?: string | null;
  utm?: Record<string, string> | null;
}): Promise<ChatSessionRow>
```

**Comportement modifié** : insère désormais `kind: 'wizard_pivot'` explicite (au lieu du default).

---

## 8. `sessionRepo.create` (légère modif)

```ts
async create(insert: Omit<ChatSessionInsert, 'id'>): Promise<ChatSessionRow>
```

**Comportement modifié** : insère désormais `kind: insert.kind ?? 'chat'` explicite (cohérent avec le default mais traçable dans les logs).

---

## 9. Nouveau endpoint `POST /api/admin/chat/cleanup-ghosts`

### Request

```http
POST /api/admin/chat/cleanup-ghosts
Cookie: <admin_session>
Content-Type: application/json

{
  "dryRun": true,        // si true, retourne le count sans archiver
  "olderThanDays": 30,   // optionnel, default 30
  "kinds": ["wizard_pivot"]  // optionnel, default ['wizard_pivot']
}
```

### Response (200)

```json
{
  "candidates": 42,
  "archived": 0,          // 0 si dryRun=true, sinon = candidates
  "dryRun": true,
  "criteria": {
    "olderThanDays": 30,
    "kinds": ["wizard_pivot"],
    "withoutLead": true
  }
}
```

### Erreurs

- `401 Unauthorized` : pas de session admin valide
- `403 Forbidden` : session admin mais role insuffisant (`super_admin` requis)
- `400 BadRequest` : `olderThanDays < 7` (sécurité — pas de purge agressive)
- `500 InternalServerError` : DB indisponible

### Permissions

- Cookie session admin OU header `Bearer <ADMIN_SESSION_PASSWORD>`.
- Rate limit : 5 requêtes / heure / admin.

---

## 10. Frontend prop contracts

### `SourceBadge` (nouveau composant)

```tsx
interface SourceBadgeProps {
  source: ChatLeadRow['source'];
  className?: string;
  /** Si true, ajoute le tooltip "Lead capturé via X". */
  withTooltip?: boolean;
}

export function SourceBadge(props: SourceBadgeProps): JSX.Element;
```

### `ChatConversationsPage` (modifié)

Nouveaux query params :
- `?debug=ghosts` : si présent, `withMessagesOnly=false` (admin avancé).
- `?kind=wizard_pivot` : filtre explicite.

### `ChatLeadsPage` (modifié)

Nouveaux query params :
- `?source=chat_widget` : filtre source spécifique.
- `?source=all` : montre toutes les sources (vue debug).

---

## 11. Contrats de logs

### À l'insert chat_session (chat natif)

```json
{
  "level": "info",
  "event": "chat.session.create",
  "sessionId": "cs_xxx",
  "kind": "chat",
  "visitorId": "v_xxx",
  "page": "/kit",
  "ts": "2026-05-26T..."
}
```

### À l'insert chat_session (wizard pivot)

```json
{
  "level": "info",
  "event": "chat.session.create",
  "sessionId": "s_xxx",
  "kind": "wizard_pivot",
  "visitorId": "v_xxx",
  "page": "/kit",
  "ts": "2026-05-26T..."
}
```

### À l'admin cleanup

```json
{
  "level": "info",
  "event": "chat.admin.cleanup_ghosts",
  "candidates": 42,
  "archived": 42,
  "dryRun": false,
  "by": "admin@femiglow.local",
  "ts": "2026-05-26T..."
}
```

---

## 12. Versioning & deprecation

Les anciens signatures restent compatibles : `listConversations({ q: '...' })` sans `kinds` ni `withMessagesOnly` continue de fonctionner. Le feature flag décide du comportement.

Quand `CHAT_ADMIN_FILTERS_V2=true` devient le défaut permanent (post-shipping J+30), on pourra :
- Retirer le flag (code dans tous les cas applique les filtres).
- Maintenir les opts `kinds`/`withMessagesOnly` pour les vues de debug.
- Documenter le breaking change dans CHANGELOG.
