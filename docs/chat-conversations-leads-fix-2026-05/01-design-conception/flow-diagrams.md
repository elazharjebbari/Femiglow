# Flow diagrams — avant / après

> Comparaison visuelle des flux d'écriture et de lecture.

## Flow 1 — Visiteur ouvre la home (sans interaction)

### Avant

```
Visitor          Widget            API                  DB
  │                │                │                    │
  │ GET /          │                │                    │
  ├───────────────►│ chat boot      │                    │
  │                ├───────────────►│ GET /api/chat/     │
  │                │                │   session          │
  │                │                ├───────────────────►│
  │                │                │ INSERT chat_session│
  │                │                │  id=cs_xyz         │
  │                │                │  page=NULL         │
  │                │                │  status='open'     │
  │                │                │  <pas de kind>     │
  │                │                ◄───────────────────┤
  │                │ session={...}  │                    │
  │                ◄───────────────┤                    │
                                    ★ Row pollue chat_session
                                    ★ Visible dans /admin/chat/conversations
                                    ★ Compteur conversations++ (faux positif)
```

### Après

```
Visitor          Widget            API                  DB
  │                │                │                    │
  │ GET /          │                │                    │
  ├───────────────►│ chat boot      │                    │
  │                ├───────────────►│ GET /api/chat/     │
  │                │                │   session          │
  │                │                ├───────────────────►│
  │                │                │ INSERT chat_session│
  │                │                │  id=cs_xyz         │
  │                │                │  kind='chat' ✨    │
  │                │                │  page=NULL         │
  │                │                │  status='open'     │
  │                │                ◄───────────────────┤
  │                │ session={...}  │                    │
  │                ◄───────────────┤                    │
                                    ★ Row toujours créée (C4 reporté)
                                    ★ PAS visible /admin/chat/conversations
                                      car aucun chat_message → filtre exclut
```

## Flow 2 — Visiteur remplit wizard step 1 sur /kit

### Avant

```
Visitor          Wizard            API                       DB
  │                │                │                         │
  │ Submit form    │                │                         │
  ├───────────────►│ ensureSessionId│                         │
  │                ├──┐             │                         │
  │                │  │ s_abc (sessionStorage)                │
  │                ◄──┘             │                         │
  │                │ POST /api/checkout/lead                  │
  │                ├───────────────►│ { sessionId: 's_abc' } │
  │                │                ├────────────────────────►│
  │                │                │ INSERT chat_session     │
  │                │                │  id=s_abc               │
  │                │                │  status='open'          │
  │                │                │  <pas de kind>          │
  │                │                ◄────────────────────────┤
  │                │                │ INSERT chat_lead        │
  │                │                │  session_id=s_abc       │
  │                │                │  source='wizard_kit'    │
  │                │                ◄────────────────────────┤
  │                │ {leadId:cl_z}  │                         │
  │                ◄───────────────┤                         │
                                    ★ Row s_abc dans chat_session
                                    ★ Visible /admin/chat/conversations (POLLUTION)
                                    ★ Lead visible /admin/chat/leads (POLLUTION)
```

### Après

```
Visitor          Wizard            API                       DB
  │                │                │                         │
  │ Submit form    │                │                         │
  ├───────────────►│ ensureSessionId│                         │
  │                ├──┐             │                         │
  │                │  │ s_abc (sessionStorage)                │
  │                ◄──┘             │                         │
  │                │ POST /api/checkout/lead                  │
  │                ├───────────────►│ { sessionId: 's_abc' } │
  │                │                ├────────────────────────►│
  │                │                │ INSERT chat_session     │
  │                │                │  id=s_abc               │
  │                │                │  kind='wizard_pivot' ✨ │
  │                │                │  status='open'          │
  │                │                ◄────────────────────────┤
  │                │                │ INSERT chat_lead        │
  │                │                │  session_id=s_abc       │
  │                │                │  source='wizard_kit'    │
  │                │                ◄────────────────────────┤
  │                │ {leadId:cl_z}  │                         │
  │                ◄───────────────┤                         │
                                    ★ Row s_abc avec kind='wizard_pivot'
                                    ★ PAS visible /admin/chat/conversations
                                      (filtre kind='chat' exclut)
                                    ★ Lead PAS visible /admin/chat/leads
                                      (filtre source ∈ {chat_widget,inline} exclut)
                                    ★ Lead RESTE visible /admin/leads global ✅
```

## Flow 3 — Visiteur ouvre le chat et tape un message

### Avant

```
Visitor          Widget          API                  DB
  │                │              │                    │
  │ Open chat      │              │                    │
  ├───────────────►│ (session déjà créée au boot)     │
  │ Type message   │              │                    │
  ├───────────────►│ POST /api/chat/message            │
  │                ├─────────────►│ INSERT chat_message│
  │                │              │  session_id=cs_xyz │
  │                │              │  role='user'       │
  │                │              ├───────────────────►│
                                    ★ Conv visible /admin/chat
                                      (à juste titre)
```

### Après

Identique, sauf que `chat_session.kind='chat'` est désormais set. La conv est visible dans `/admin/chat/conversations` parce qu'elle a kind='chat' ET un message.

## Flow 4 — Admin consulte /admin/chat/conversations

### Avant

```
Admin            Page              adminQueries          DB
  │                │                  │                    │
  │ GET /admin/    │                  │                    │
  │ chat/conv      │                  │                    │
  ├───────────────►│ listConversations│                    │
  │                ├─────────────────►│ SELECT *          │
  │                │                  │  FROM chat_session│
  │                │                  ├───────────────────►│
  │                │                  ◄───────────────────┤
  │                │                  ◄ 100 rows (mix all)│
                                    ★ Affiche ghosts wizard
                                    ★ Affiche bootstrap vides
```

### Après

```
Admin            Page              adminQueries          DB
  │                │                  │                    │
  │ GET /admin/    │                  │                    │
  │ chat/conv      │                  │                    │
  ├───────────────►│ listConversations│                    │
  │                ├─────────────────►│ SELECT *          │
  │                │                  │  FROM chat_session│
  │                │                  │ WHERE kind='chat'│✨
  │                │                  │  AND EXISTS (    │✨
  │                │                  │   SELECT 1 FROM  │
  │                │                  │   chat_message m │
  │                │                  │   WHERE m.session_id = s.id│
  │                │                  │     AND role='user'│
  │                │                  │     AND status='sent')│
  │                │                  ├───────────────────►│
  │                │                  ◄───────────────────┤
  │                │                  ◄ ~5-10 rows (chat purs)│
                                    ★ Seulement vraies conversations
```

## Flow 5 — Admin consulte /admin/chat/leads

### Avant

```
Admin            Page              adminQueries          DB
  │                │                  │                    │
  ├───────────────►│ listChatLeads    │                    │
  │                ├─────────────────►│ SELECT *           │
  │                │                  │  FROM chat_lead    │
  │                │                  ├───────────────────►│
  │                │                  ◄ 28 rows (mix)     │
                                    ★ Affiche wizard leads
```

### Après

```
Admin            Page              adminQueries          DB
  │                │                  │                    │
  ├───────────────►│ listChatLeads    │                    │
  │                ├─────────────────►│ SELECT *           │
  │                │                  │  FROM chat_lead    │
  │                │                  │ WHERE source IN   │✨
  │                │                  │  ('chat_widget',  │
  │                │                  │   'inline')       │
  │                │                  ├───────────────────►│
  │                │                  ◄ ~3-5 rows (chat purs)│
                                    ★ Seulement vrais chat leads
```

## Flow 6 — Cleanup endpoint (admin)

```
Admin            Page              API                    DB
  │                │                │                      │
  │ Click "Cleanup"│                │                      │
  ├───────────────►│ POST /api/admin/chat/cleanup-ghosts  │
  │                │  { dryRun: true }                    │
  │                ├───────────────►│                      │
  │                │                │ Auth check          │
  │                │                │ SELECT COUNT(*)     │
  │                │                │  FROM chat_session s│
  │                │                │  WHERE s.kind='wizard_pivot'│
  │                │                │    AND s.status='open'│
  │                │                │    AND NOT EXISTS (lead)│
  │                │                │    AND opened_at < NOW() - 30j│
  │                │                ├─────────────────────►│
  │                │                ◄ candidates=42       │
  │                │ {candidates:42}│                      │
  │                ◄───────────────┤                      │
  │ Confirm        │                │                      │
  ├───────────────►│ POST .../cleanup-ghosts              │
  │                │  { dryRun: false }                   │
  │                ├───────────────►│                      │
  │                │                │ UPDATE chat_session  │
  │                │                │  SET status='archived'│
  │                │                │  ... same WHERE      │
  │                │                ├─────────────────────►│
  │                │                ◄ archived=42         │
  │                │ {archived:42}  │                      │
  │                ◄───────────────┤                      │
                                    ★ Rows orphan archived
                                    ★ FK chat_lead intacts
                                    ★ Traçabilité dans logs
```

## Flow 7 — Feature flag toggle (rollback)

```
DevOps           Env Var           App                 DB
  │                │                  │                    │
  │ Set            │                  │                    │
  │ CHAT_ADMIN_   │                  │                    │
  │  FILTERS_V2   │                  │                    │
  │  =false       │                  │                    │
  ├───────────────►│                  │                    │
  │                │ Redeploy/restart │                    │
  │                ├─────────────────►│                    │
  │                │                  │ isChatAdmin...V2()│
  │                │                  │  returns false    │
  │                │                  │                    │
  │                │ admin queries    │                    │
  │                │ ignore filters   │                    │
  │                │                  │ SELECT * FROM ... │
  │                │                  │  (no kind/source) │
  │                │                  ├───────────────────►│
                                    ★ Comportement legacy
                                    ★ Données restent intactes
                                    ★ Re-toggle =true sans migration
```

## Synthèse des changements de comportement

| Flow | Insert/Lecture | Avant | Après |
|---|---|---|---|
| 1 (bootstrap) | Insert | `kind` absent | `kind='chat'` explicite |
| 2 (wizard) | Insert | `kind` absent | `kind='wizard_pivot'` explicite |
| 3 (chat msg) | Insert | inchangé | inchangé |
| 4 (admin conv) | Lecture | tout | filtré `kind='chat'` + EXISTS msg |
| 5 (admin leads) | Lecture | tout | filtré `source IN (...)` |
| 6 (cleanup) | Mutation | n/a | nouveau endpoint |
| 7 (rollback) | Toggle | n/a | flag réversible sans migration |
