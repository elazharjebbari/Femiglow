# Recap audit — synthèse des 4 causes racines

> Source complète : [`docs/chat-conversations-leads-audit-2026-05/01-audit-detail.md`](../../chat-conversations-leads-audit-2026-05/01-audit-detail.md).

## Symptômes constatés

1. `/admin/chat/conversations` affiche 100 conversations dont la majorité avec PAGE "—" et CONVERSION "—" (vides).
2. `/admin/chat/leads` affiche 28 leads dont des leads issus du wizard `/kit` (firstName=`yasmine`, `test` avec phone `+212751592310`, marqués `converted WIZARD` côté `/admin/leads`).

## Les 4 causes racines

### C1 — Ghost sessions wizard polluent `chat_session`

Le wizard checkout (`/api/checkout/lead`) insère intentionnellement des rows "fantômes" dans `chat_session` pour satisfaire la FK `chat_lead.session_id`. Ces rows ont :
- ID préfixé `s_xxx` (client-side via `ensureSessionId()` en `sessionStorage`)
- `status='open'` jamais clôturé
- Pas de `chat_message` rattaché

Code coupable : `src/lib/checkout/repos/session-repo.ts:80-93` (commentaire explicite "session 'fantôme'").

### C2 — `adminQueries.listChatLeads` ignore la colonne `source`

La table `chat_lead` a déjà un enum `source` avec 6 valeurs (`chat_widget`, `wizard_kit`, `wizard_commander`, `newsletter`, `admin`, `inline`), mais la query admin **ne filtre pas dessus**. Tous les leads remontent dans `/admin/chat/leads`.

Code coupable : `src/lib/chat/admin/queries.ts:278-297`.

### C3 — `adminQueries.listConversations` ignore la présence de messages

`SELECT * FROM chat_session` direct, sans JOIN sur `chat_message`. Une session sans aucun message est listée comme conversation valide.

Code coupable : `src/lib/chat/admin/queries.ts:235-241`.

### C4 — Bootstrap chat prématuré

`sessionService.getOrCreate()` crée immédiatement une row `chat_session` au premier appel `/api/chat/session`, avant tout message utilisateur. Pollution même hors wizard, observable via les 5 IDs `cs_xxx` avec `page=NULL` dans la preview.

Code coupable : `src/lib/chat/services/session-service.ts:37-69`.

## Pourquoi maintenant ?

- KPIs chat divisés par des sessions ghost → ratios sous-estimés.
- Équipe Care reçoit des leads wizard à rappeler alors qu'ils sont déjà au step 2/3 → double appel possible.
- Export CSV digest hebdo pollué.

## Que NE PAS faire

- ❌ Drop des rows historiques de `chat_session` avec préfixe `s_` (casse les FK `chat_lead.session_id`).
- ❌ Renommer les IDs (immutable PK).
- ❌ Modifier l'enum `source` (cohérence avec `chat_lead.source` et taxonomie tracking).
- ❌ Bloquer le wizard checkout (il a besoin du pivot session pour les leads).

## Ce que ce sprint VA faire

- ✅ Ajouter `chat_session.kind` (`'chat' | 'wizard_pivot' | 'system'`) pour discriminer proprement.
- ✅ Filtrer côté query admin (rétro-compatible via feature flag).
- ✅ Backfill `kind` sur l'historique (pas de drop).
- ✅ Ajouter tests à 4 niveaux pour garantir non-régression.
