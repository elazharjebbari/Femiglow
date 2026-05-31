# Audit pollution conversations & leads chat — 2026-05

> **Symptômes signalés par la fondatrice (26 mai 2026)** :
> 1. Dans `/admin/chat/conversations`, plusieurs **conversations vides** apparaissent (aucun message, aucune page, aucune conversion).
> 2. Dans `/admin/chat/leads`, des **leads y figurent qui ne sont pas des leads chat** (ex. capture wizard checkout `/kit`).

Ce dossier consolide l'audit approfondi (preview admin live + lecture du code + schéma DB) et propose une remédiation chiffrée.

## Sommaire

| Fichier | Contenu |
|---|---|
| [`01-audit-detail.md`](./01-audit-detail.md) | Audit complet — architecture, causes racines, évidence code, citations DB |
| [`02-evidence-observations.md`](./02-evidence-observations.md) | Observations preview admin (Node 20, port 3001) — counts, échantillons d'IDs |
| [`03-recommandations.md`](./03-recommandations.md) | Plan de remédiation en 3 niveaux (quick fix, court terme, long terme) |

## TL;DR

| # | Cause racine | Impact | Sévérité |
|---|---|---|---|
| **C1** | Le wizard checkout (`/api/checkout/lead`) insère des **"ghost sessions"** dans `chat_session` (commentaire explicite `session "fantôme"` dans `wizardSessionRepo.ensureForWizard`) pour satisfaire la FK `chat_lead.session_id`. Ces rows ont des IDs préfixés `s_xxx` (générés client par `ensureSessionId()` en `sessionStorage`) au lieu de `cs_xxx` (chat natif via `createId('cs')`). Résultat : la table mélange deux espèces. | `/admin/chat/conversations` liste les ghosts → conversations apparemment vides (PAGE "—", CONVERSION "—"). | 🔴 **Haute** |
| **C2** | `adminQueries.listChatLeads()` ne **filtre pas la colonne `source`** alors que celle-ci a précisément un enum pour discriminer : `chat_widget`, `wizard_kit`, `wizard_commander`, `newsletter`, `admin`, `inline`. La page `/admin/chat/leads` montre donc tous les leads dont les leads wizard. | Confusion produit (Care voit des leads "yasmine" / "test" wizard converted dans la file chat). KPIs wrong. | 🔴 **Haute** |
| **C3** | `adminQueries.listConversations()` fait `SELECT * FROM chat_session` sans **jointure / filtre sur `chat_message`**. Une session sans message (ghost ou abandon précoce) est listée comme conversation valide. | Liste polluée, faux compteur de sessions converties (3/100 ≈ 3% vs réalité ≈ 3/<vraies sessions>). | 🟡 **Moyenne** |
| **C4** | `sessionService.getOrCreate()` crée une row `chat_session` **dès la première visite** d'une page où le widget chat se charge (statique côté serveur via `/api/chat/session`), avant tout message utilisateur. Pollution permanente même sans wizard. | Inflation du compteur sessions, dégrade les ratios "conversions/sessions". | 🟡 **Moyenne** |

## Schémas en jeu

```
┌─────────────────────┐   FK (cascade)   ┌─────────────────────┐
│   chat_session      │◄─────────────────│   chat_lead         │
│  (table partagée)   │                  │ source enum:        │
│  id: cs_xxx | s_xxx │                  │  • chat_widget      │
│  visitor_id         │                  │  • wizard_kit ⚠️    │
│  page (nullable)    │                  │  • wizard_commander │
│  status (open)      │                  │  • inline           │
└─────────────────────┘                  │ form_mode enum:     │
        ▲                                │  • chat ✅          │
        │                                │  • wizard_embed ⚠️  │
        │ FK (cascade)                   │  • wizard_cart ⚠️   │
┌─────────────────────┐                  │  • legacy_cart ⚠️   │
│   chat_message      │                  └─────────────────────┘
│  session_id         │
│  role (user/asst)   │  ←─── *Si une session a 0 message_user
│  content            │       et 0 message_assistant, c'est
└─────────────────────┘       un ghost wizard ou un init vide.*
```

## Référence rapide

- **Identité Node** : Node v20.10.0 / pnpm 9.15.9 (Node 16 rejette pnpm — voir `.nvmrc` recommandé).
- **Admin preview** : `http://localhost:3001/admin` (login `admin@femiglow.local`).
- **Tables impliquées** : `chat_session`, `chat_message`, `chat_lead`, `chat_conversation_event`.
- **Code central** :
  - `src/lib/checkout/repos/session-repo.ts` (ghost session creator)
  - `src/lib/checkout/client/visitor-id.ts` (préfixe `s_` côté client)
  - `src/lib/chat/repos/session.ts` (préfixe `cs_` côté serveur)
  - `src/lib/chat/admin/queries.ts` (queries sans filtre source)
  - `src/app/admin/chat/conversations/page.tsx` + `src/app/admin/chat/leads/page.tsx`

## Notes

- Cet audit est observationnel — aucun fix n'a été appliqué. Les recommandations sont dans [`03-recommandations.md`](./03-recommandations.md).
- Les counts cités proviennent du SSR live (session admin Node 20 sur DB locale) au 26/05/2026.
- Format taxonomie audit cohérent avec `docs/attribution-fix-2026-05/` et `docs/live-systems-fix-2026-05/`.
