# Glossaire technique

Vocabulaire utilisé tout au long du dossier.

| Terme | Définition |
|---|---|
| **Ghost session** | Row `chat_session` insérée par le wizard checkout (préfixe `s_xxx`) pour satisfaire la FK `chat_lead.session_id`. Pas de messages. Pas une vraie conversation. |
| **Bootstrap session** | Row `chat_session` créée par `sessionService.getOrCreate()` au premier hit du widget, AVANT que l'utilisateur ait ouvert/écrit quoi que ce soit. Souvent avec `page=NULL`. |
| **Real chat session** | Row `chat_session` avec ≥1 `chat_message` de role=`user` et status=`sent`. C'est ce que la fondatrice attend de voir dans `/admin/chat/conversations`. |
| **`kind`** | Nouvelle colonne discriminateur que ce sprint ajoute à `chat_session`. Enum : `'chat'`, `'wizard_pivot'`, `'system'`. |
| **`source`** | Colonne existante sur `chat_lead`. Enum : `'chat_widget'`, `'wizard_kit'`, `'wizard_commander'`, `'newsletter'`, `'admin'`, `'inline'`. |
| **`formMode`** | Colonne existante sur `chat_lead`. Enum : `'wizard_embed'`, `'wizard_cart'`, `'legacy_cart'`, `'chat'`. |
| **`triggerReason`** | Colonne existante sur `chat_lead`. Décrit POURQUOI le lead a été capturé (ex. `'purchase-intent'`, `'frustration'`, `'inline-contact'`). N'indique PAS la source. |
| **`outcome`** | Colonne existante sur `chat_lead`. État courant : `'pending'`, `'reached'`, `'no-answer'`, `'converted'`, `'discarded'`. |
| **CHA-LEAD-V2** | Préfixe des commits / branches de ce sprint (cohérent avec `CHA-XXX` pour les sprints chat précédents). |
| **Backfill** | Mise à jour SQL one-shot pour remplir `kind` sur les rows historiques avant que la colonne soit utilisée par les filtres. |
| **Feature flag** | `CHAT_ADMIN_FILTERS_V2` env var. Si `true`, active les filtres `kind='chat'` et `source IN (...)`. Si `false`, comportement legacy (toutes les rows). |
| **Cleanup endpoint** | `/api/admin/chat/cleanup-ghosts` (POST, admin-only). Archive les ghosts orphelins (sans lead lié) > 30j. |
| **Smoke test** | Vérification post-deploy via `pnpm tsx scripts/smoke-chat-purity.ts --url https://...`. |
| **Pivot session** | Synonyme de "ghost session" — terme plus neutre utilisé dans le nouveau modèle. |
| **Pollution rate** | Ratio (rows polluées / total rows) — KPI à observer après backfill. |

## Préfixes d'ID

| Préfixe | Origine | Géré par | Visible dans |
|---|---|---|---|
| `cs_<20 chars>` | `createId('cs')` côté serveur | `sessionRepo.create()` | `chat_session.id` (kind=chat) |
| `s_<random>` | `createNanoId('s')` côté client | `ensureSessionId()` (sessionStorage) | `chat_session.id` (kind=wizard_pivot) |
| `cl_<20 chars>` | `createId('cl')` côté serveur | `wizardLeadRepo`/`leadRepo` | `chat_lead.id` |
| `cm_<20 chars>` | `createId('cm')` côté serveur | `messageRepo.append()` | `chat_message.id` |
| `v_<random>` | `createNanoId('v')` côté client | `ensureVisitorId()` (localStorage) | `chat_session.visitor_id` (wizard path) |

## Sigles

- **DoD** — Definition of Done (critères d'acceptation)
- **ADR** — Architecture Decision Record
- **MSW** — Mock Service Worker (tests intégration)
- **SLA** — Service Level Agreement (KPI temps de réponse Care)
- **PII** — Personally Identifiable Information (RGPD)
- **RGPD** — Règlement Général sur la Protection des Données
- **CSv2** — Content Studio V2 (autre projet en parallèle, sans rapport)
