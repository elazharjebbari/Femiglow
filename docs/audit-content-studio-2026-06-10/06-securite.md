# 06 — Sécurité

## 1. Authentification & autorisation : globalement saine

- **36/36 routes** `/api/admin/content-studio/**` appellent `requireAdminApi()` en tête de handler (vérifié exhaustivement route par route). Aucune route non protégée.
- Session : cookie `femiglow_admin_session` via iron-session, secret `ADMIN_SESSION_PASSWORD` (≥32 chars), TTL 8 h, vérification `expiresAt` (`lib/auth/session.ts:24-37`).
- Double garde : `requireContentStudioEnabled()` (flag env, 403) + `requireAdminApi()` (`lib/content-studio/auth.ts:8-25`).
- Routes v2 média (`upload-and-crop|trim`) : auth + **rate-limit IP** + flag. ✔
- Limite : **pas de notion de rôle** — toute session admin a tous les droits du studio, y compris publier. Acceptable à l'échelle actuelle (un opérateur), à revoir si l'équipe grandit (séparer « éditer » de « publier »).

## 2. Constats

| # | Sévérité | Constat | Référence / reco |
|---|---|---|---|
| 1 | **Majeur** | **Bypass d'auth cron par header spoofable** : `GET /api/cron/content-studio/social-publish-scheduler` accepte `x-vercel-cron: 1` comme authentification. Hors Vercel (déploiement VPS/LiteSpeed ici), **n'importe quel client peut envoyer ce header** et déclencher l'exécution des jobs de publication planifiés sans secret. Combiné au bug « cancel ne purge pas les jobs », un appel externe peut faire publier un post annulé. | `social-publish-scheduler/route.ts:60-62`. Supprimer le bypass ou exiger `CRON_SECRET` systématiquement + strip du header au reverse-proxy. |
| 2 | **Critique** (sûreté plus que sécurité) | **Pas de kill-switch dry_run/live** : la frontière entre « simulation » et « publication réelle sur les comptes Instagram de clients » repose sur la présence d'un compte `dry_run` actif en base, avec repli silencieux sur `eligible[0]` (compte réel possible). | `admin-service.ts:554-563`. Env-flag global vérifié au niveau adapter (existe sur la branche backup : `SOCIAL_PUBLISHING_MODE`). |
| 3 | Mineur | Flag `CONTENT_STUDIO_LEGACY_POSTIZ_DISABLED` appliqué côté UI seulement ; la route legacy `postiz-draft` reste appelable par API directe (headers Deprecation/Sunset présents, pas de blocage) | `postiz-draft/route.ts:17-30` |
| 4 | Mineur | `health` répond à toute session admin même studio désactivé (expose `mode: drizzle|memory`) — probablement voulu, à documenter | `health/route.ts:12` |
| 5 | Mineur | Pages v2 `create` et `library` rendues **sans vérifier** `CONTENT_STUDIO_V2_ENABLED` (home et plan le vérifient) — incohérence de gating ; l'auth admin reste requise | `app/admin/content-studio-v2/*/page.tsx` |

## 3. Validation, injection, XSS

- zod `.strict()` avec bornes sur quasi tous les payloads ; pas de JSON non validé accepté (`03-backend-fonctionnement.md` §7).
- SQL : drizzle paramétré partout, pas de SQL brut concaténé observé dans le périmètre.
- XSS : un seul `dangerouslySetInnerHTML` (`PlatformPreview.tsx:88,279-285`) avec échappement manuel `& < >` — correct aujourd'hui (contenu hors attribut), fragile par construction. Reco : rendu en nœuds React.
- Upload : route v2 avec rate-limit ; la route legacy d'upload renvoie un 400 propre sur non-multipart **uniquement sur la branche backup** (`f96e69df`) — sur master, comportement non durci.

## 4. Secrets & fuites

- Aucune fuite de stack/message interne dans les réponses HTTP (`formatErrorResponse` uniforme).
- Redaction des payloads provider par liste de clés (`token|secret|password…`, `social-publishing/repository.ts:121-131`) — ne couvre pas un secret incrusté dans une valeur string.
- Secrets en env uniquement (`.env` gitignoré, vérifié non tracké) ; le script cron lit `CRON_SECRET` à l'exécution sans l'écrire dans le crontab ni les logs (pattern correct — mais le script est actuellement absent du working tree, cf. `01-etat-des-lieux.md` §4).
- Postiz : clé API portée par l'adapter ; les attempts persistés sont redactés avant écriture.

## 5. Surface d'exposition réseau

- L'app (quand elle tourne) n'écoute que sur 127.0.0.1 derrière LiteSpeed — pas d'exposition directe.
- Les crons internes exigent `Authorization: Bearer ${CRON_SECRET}` (ex. `media-optimize`), **sauf** le scheduler social (constat #1).
- Attention au voisinage serveur : :8012 est désormais occupé par un autre projet (corolle-reviews) — toute remise en route du staging doit choisir un port libre, et le vhost LiteSpeed doit être re-pointé (aujourd'hui staging.femiglow-maroc.com → 404).
