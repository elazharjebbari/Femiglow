# CHANGELOG GTM

> *Une entrée par modification publiée du conteneur GTM.*

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

---

## [Non publié]

### En préparation
- Container `GTM-FEMIGLOW` — création initiale (cf. `docs/gtm/15-plan-action`).
- Generator `scripts/gtm-generate.ts`.
- Pusher API `scripts/gtm-push.ts`.
- **10 events `fg_chat_*` à intégrer** depuis l'assistant
  conversationnel (cf. doc 13). Ajoute 10 tags GA4 + 2 tags Meta
  + 5 custom dimensions (`chat_session_id`, `chat_language`,
  `chat_attributed`, `chat_intent`, `chat_role`) + Variable JS
  `Chat Attributed`. 12 tickets `GTM-CHAT-001..012`, charge ~ 2 j.
- **UI admin Export GTM** `/admin/tracking/gtm` (cf. doc 14) :
  preview pretty-printed, téléchargement container.json par env,
  copie presse-papier, diff vs distant, push API en Phase 2.
  17 tickets `GTM-EXP-001..017`, charge ~ 5 j.

---

## [v1.0.0] — yyyy-mm-dd — initial

### Added
- Container `GTM-FEMIGLOW` créé en environnement Live, Stage, Preview, Dev.
- 38 triggers Custom Event (1 par event du catalogue).
- ~ 87 tags : 1 GA4 Cfg, 38 GA4 Evt, 13 Meta, 11 TikTok, 8 Snap,
  7 Pinterest, 5 Google Ads, 2 Consent Mode, 2 Aux JS.
- Service Account CI configuré, GitHub workflow `gtm-sync.yml`.

### Notes
- Bandeau consent : pré-snippet `gtag('consent', 'default')` posé
  dans `apps/web/src/app/layout.tsx`.
- Pixels TikTok / Snap / Pinterest activés en prod uniquement
  (en preview, GA4 seul).
