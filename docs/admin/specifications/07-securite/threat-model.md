# Modèle de menaces (STRIDE)

Analyse par flux fonctionnel. Chaque ligne identifie : la menace, sa
catégorie STRIDE, son impact, sa probabilité et le contrôle mitigeant.

## Légende

| Code | Catégorie |
|---|---|
| S | Spoofing — usurpation d'identité |
| T | Tampering — altération de données |
| R | Repudiation — déni d'action |
| I | Information disclosure — fuite |
| D | Denial of service |
| E | Elevation of privilege |

| Niveau | Probabilité | Impact |
|---|---|---|
| L | faible | mineur |
| M | moyen | sérieux |
| H | élevé | critique |

## 1. Authentification admin

| # | Menace | Catégorie | Prob. | Impact | Contrôle |
|---|---|---|---|---|---|
| T1.1 | Brute-force sur le mot de passe | S | M | H | rate-limit IP+email 5/15min, argon2id, mot de passe ≥ 12 char |
| T1.2 | Vol du cookie de session (XSS) | S | L | H | CSP strict, HttpOnly, échappement React |
| T1.3 | Replay du cookie après vol | S | L | H | rotation 8h (maxAge), iron-session signé |
| T1.4 | Attaque CSRF sur action critique | S | L | M | SameSite=Lax, Origin check, mutations en POST |
| T1.5 | Phishing → credentials | S | M | H | hors scope tech ; sensibilisation utilisatrice |
| T1.6 | Compromise email de récupération | S | L | H | aucune récupération auto v1 (rotation manuelle DPO) |

## 2. Création de lead via formulaire public

| # | Menace | Catégorie | Prob. | Impact | Contrôle |
|---|---|---|---|---|---|
| T2.1 | Spam massif (flood) | D | H | M | rate-limit IP 10/h sur `/api/public/contact` |
| T2.2 | Injection SQL via champ `message` | T | L | H | Drizzle paramétré, pas de string concat |
| T2.3 | XSS persistant via `full_name` | T | M | M | échappement React au render, pas de `dangerouslySetInnerHTML` |
| T2.4 | Soumission falsifiée (bot) | S | H | L | reCAPTCHA v3 sur formulaires (post-v1) |
| T2.5 | Soumission via API directe sans consentement | T | M | M | validation `consent_at` côté serveur, refus si absent |

## 3. Émission webhook

| # | Menace | Catégorie | Prob. | Impact | Contrôle |
|---|---|---|---|---|---|
| T3.1 | Endpoint malveillant volant les leads | I | M | H | URL HTTPS imposée, validation manuelle à la création, audit |
| T3.2 | Replay de payload (relecture) | T | L | M | `Idempotency-Key` + signature HMAC |
| T3.3 | MITM sur le payload | I/T | L | H | TLS obligatoire, signature HMAC SHA-256 |
| T3.4 | DoS du consommateur (retry agressif) | D | L | M | backoff exponentiel + max 5 tentatives |
| T3.5 | Fuite secret HMAC (logs, snapshot) | I | L | H | secret chiffré at-rest, redacted dans logs |
| T3.6 | Endpoint configuré ciblant infra interne (SSRF) | T/E | L | H | validation URL : pas de `127.0.0.1`, `169.254.*`, `localhost`, RFC1918 en prod |

## 4. Cron tick

| # | Menace | Catégorie | Prob. | Impact | Contrôle |
|---|---|---|---|---|---|
| T4.1 | Déclenchement non autorisé | E | M | M | `Authorization: Bearer ${CRON_SECRET}` obligatoire |
| T4.2 | Concurrent reads (deux invocations) → double envoi | T | M | M | `FOR UPDATE SKIP LOCKED` en SQL |
| T4.3 | Tick bloqué → file qui s'accumule | D | L | M | timeout 50s, alerte sur ratio failed > 50 % |

## 5. Console admin (UI)

| # | Menace | Catégorie | Prob. | Impact | Contrôle |
|---|---|---|---|---|---|
| T5.1 | XSS via lead `notes` malicieuses | T/I | L | M | rendu via React (escape par défaut), markdown sandboxé via DOMPurify si activé |
| T5.2 | Clickjacking | T | L | M | `X-Frame-Options: DENY` |
| T5.3 | Information leak via cache navigateur | I | L | M | `Cache-Control: no-store` sur réponses admin |
| T5.4 | Open redirect via `?next=` | S | L | M | validation : `next` doit commencer par `/admin/` et ne pas contenir `//` |

## 6. Base de données

| # | Menace | Catégorie | Prob. | Impact | Contrôle |
|---|---|---|---|---|---|
| T6.1 | Vol de la base (snapshot Neon) | I | L | H | secrets chiffrés (`pgp_sym_encrypt`), mots de passe hash argon2 |
| T6.2 | Élévation de privilèges via SQL injection | E | L | H | Drizzle paramétré, jamais d'`sql.raw()` sur input user |
| T6.3 | Suppression accidentelle | T | L | H | soft-delete par défaut, PITR Neon 7 jours |
| T6.4 | Accès direct au DB par dev → fuite PII | I | M | H | rotation credentials, accès via Neon role limité, audit |

## 7. Vie privée

| # | Menace | Catégorie | Prob. | Impact | Contrôle |
|---|---|---|---|---|---|
| T7.1 | Logs contenant emails clairs | I | M | M | redaction automatique dans logger |
| T7.2 | Sentry capturant des PII | I | L | M | `beforeSend` strip `password`, `email`, `phone` |
| T7.3 | Export CSV envoyé par erreur | I | M | M | export téléchargé localement, pas d'email sortant ; audit chaque export |
| T7.4 | Lead non purgé après demande effacement | I/R | M | H | procédure RGPD documentée + audit trail |

## 8. Disponibilité

| # | Menace | Catégorie | Prob. | Impact | Contrôle |
|---|---|---|---|---|---|
| T8.1 | Neon en panne | D | L | H | Vercel + Neon SLAs ; mode dégradé : formulaires retournent 503 + retry banner |
| T8.2 | Vercel en panne | D | L | H | aucun mitigation v1 ; documenté |
| T8.3 | Coût explosif (attaque sur quotas) | D | L | M | Vercel quotas, alertes budget |

## Matrice de couverture

Chaque ligne du modèle est mappée à un ou plusieurs contrôles dans
[`controles.csv`](./controles.csv).

## Révision

Ce document est révisé :
- À chaque évolution majeure de l'architecture.
- Au minimum annuellement.
- Après tout incident de sécurité.
