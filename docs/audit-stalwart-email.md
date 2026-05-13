# Audit — Intégration FemiGlow ↔ Stalwart (envoi d'emails automatique)

> **But.** Photographier l'écosystème mail déjà installé sur le VPS (Stalwart
> Mail Server + webmail, configuré par l'agent **Hermes**) et l'état des
> points d'envoi d'email côté application FemiGlow, afin d'établir le
> chemin le plus court vers un envoi transactionnel fiable depuis
> l'application Next.js. Pas de plan détaillé — uniquement des faits, des
> chemins de fichiers, et les correctifs préalables identifiés.

Date : 2026-05-11. VPS : `srv983171` (46.202.128.168).

---

## 1. Mémoire Hermes — ce qui en a été retenu

| Élément | Valeur |
|---|---|
| Home agent | `/home/hermes/.hermes` |
| Mémoires persistantes | `/home/hermes/.hermes/memories/` — **vide** |
| Sessions stockées | 1 session Telegram (`session_20260426_201331_a0f69d11.json`, message « Test ») |
| Compétences disponibles | `email/himalaya`, `productivity/google-workspace` (mais pas utilisées dans cette session) |
| Service gateway | `hermes-gateway.service` (actif) |

**Conclusion.** Aucune décision durable sur Stalwart n'a été persistée
dans la mémoire d'Hermes. La configuration a été appliquée directement
via `stalwart-cli` et de fichiers de bootstrap intermédiaires dans
`/tmp/` (cf. § 3). Tout l'état utile vit donc dans Stalwart lui-même
(RocksDB) et dans le DNS public.

---

## 2. Stalwart — service et binaire

| Élément | Valeur |
|---|---|
| Version | **v0.16** (upgrade depuis v0.11 le 2026-04-27, backups dans `/etc/stalwart-mail-backup-upgrade/`, `/opt/stalwart-mail-backup-1777286152/`) |
| Service systemd | `stalwart-mail.service` — `active (running)` depuis 2026-05-07 13:56 UTC |
| Binaire | `/opt/stalwart-mail/stalwart-mail` (~92 Mo) |
| Config file | `/etc/stalwart-mail/etc/config.json` — fichier _minimaliste_ : pointe simplement vers la base RocksDB |
| Base de configuration | **RocksDB** dans `/var/lib/stalwart/` (toute la config domaine/comptes/DKIM/listener vit ici, pas en fichiers plats) |
| CLI | `/usr/local/bin/stalwart-cli` (variable `STALWART_URL`/`STALWART_USER`/`STALWART_PASSWORD` requises) |
| Hostname SMTP (banner) | `mail.lumiereacademy.com` (réponse `220` confirmée sur port 25/587) |
| Credentials root | `/root/stalwart-credentials.txt` (non lu pendant l'audit) |

Contenu de `config.json` :
```json
{ "@type": "RocksDb", "path": "/var/lib/stalwart/", "blobSize": 16834, "bufferSize": 134217728, "poolWorkers": null }
```

### 2.1 Ports en écoute

| Port | Protocole | Usage attendu |
|---|---|---|
| 25 | SMTP | Réception MX (entrant) |
| 110 / 995 | POP3 / POP3S | Lecture mails (clients) |
| 143 / 993 | IMAP / IMAPS | Lecture mails (webmail/clients) |
| 465 | SMTPS | Submission TLS implicite |
| 587 | Submission | Soumission STARTTLS — **port cible pour FemiGlow** |
| 4190 | ManageSieve | Filtres serveur |
| 8080 | HTTP | Console admin + JMAP + webmail (sans TLS, vu via boucle `::1`) |

> ⚠️ Le port `8080` est en clair. Le service est accessible publiquement via
> `https://mail.femiglow-maroc.com/` (TLS terminé par Stalwart, cf. § 3),
> mais aucun reverse-proxy nginx ne se trouve devant. Vérifier que `8080`
> n'est pas exposé hors du VPS (à confirmer avec `ufw`/firewall cloud).

### 2.2 Webmail / Admin

`curl https://mail.femiglow-maroc.com/` répond `200` avec une page HTML
servie par Stalwart (UI intégrée). C'est à la fois :
- la console d'administration (login `admin@lumiereacademy.com`),
- le webmail utilisateur,
- l'endpoint OIDC/JMAP — endpoint OpenID confirmé via
  `/.well-known/openid-configuration` (issuer = `https://mail.lumiereacademy.com`).

---

## 3. Domaines, comptes, DKIM, TLS

### 3.1 Domaines configurés

| Domaine | Rôle dans Stalwart |
|---|---|
| `lumiereacademy.com` | Domaine admin/hôte (banner SMTP, accountId=1 = `admin@lumiereacademy.com`) |
| `femiglow-maroc.com` | Domaine produit FemiGlow (domainId = `c` dans les fichiers de bootstrap) |

### 3.2 Comptes vus dans Stalwart

| Compte | Provenance | Notes |
|---|---|---|
| `admin@lumiereacademy.com` | logs (auth port 8080) | accountId=1 |
| `info@femiglow-maroc.com` | logs (auth submission port 587) | accountId=9 — **a déjà émis un message le 2026-05-11 16:00:04** vers `admin@lumiereacademy.com` |
| `contact@femiglow-maroc.com` | bootstrap JSON `/tmp/stalwart-account-contact-fmg.json` | rôle `User`, locale `fr_FR`, mot de passe en clair dans le JSON (à purger) |

### 3.3 Certificat TLS

| Élément | Valeur |
|---|---|
| Source | Let's Encrypt (chaîne ISRG Root X1 → E7) |
| SAN | `mail.femiglow-maroc.com`, `femiglow-maroc.com` |
| Validité | 2026-05-07 → 2026-08-05 |
| Type clé | ECDSA P-256 |
| Stockage | dans Stalwart (JSON `/tmp/stalwart-cert-femiglow4.json`, importé via CLI) |

### 3.4 DKIM

| Type | Sélecteur | État | Vérifié publiquement |
|---|---|---|---|
| RSA-2048 SHA-256 | `v1-rsa-20260507` | `stage: active`, headers signés `From,To,Subject,Date,Message-ID`, reports=true | ✅ `dig TXT v1-rsa-20260507._domainkey.femiglow-maroc.com` retourne la clé publique |
| Ed25519 SHA-256 | `v1-ed25519-20260507` | idem | ✅ TXT publié |

### 3.5 SPF / DMARC publics

```
femiglow-maroc.com   TXT  "v=spf1"
_dmarc.femiglow-maroc.com   TXT  "v=DMARC1; p=reject; rua=mailto:postmaster@femiglow-maroc.com"
```

- **DMARC** : `p=reject` ✅ (politique stricte).
- **SPF** : ⚠️ **cassé**. La valeur `v=spf1` seule n'autorise aucun
  émetteur ; combinée à `DMARC p=reject` et à des DKIM stricts, le moindre
  désalignement provoquera un rejet en réception. À comparer à
  `lumiereacademy.com` qui publie correctement
  `v=spf1 ip4:46.202.128.168 ~all`.

Correctif attendu (à publier en DNS chez le registrar) :

```
femiglow-maroc.com   TXT   v=spf1 ip4:46.202.128.168 mx -all
```

### 3.6 MX et résolution

```
femiglow-maroc.com.   MX   10 mail.lumiereacademy.com.
mail.femiglow-maroc.com.   A   46.202.128.168
femiglow.ma.   NXDOMAIN
```

- Le MX pointe vers `mail.lumiereacademy.com` (et non `mail.femiglow-maroc.com`). C'est volontaire (la machine sert les deux), mais il faut s'assurer que le HELO côté envoi est aligné avec le rDNS de `46.202.128.168` pour ne pas casser l'alignement DMARC.
- **`femiglow.ma` n'existe pas.** Tout `mailto:contact@femiglow.ma` du code (cf. § 5) est mort.

---

## 4. Anomalies opérationnelles repérées dans les logs

Logs : `/etc/stalwart-mail/logs/stalwart.YYYY-MM-DD` (rotation quotidienne).

| Sévérité | Sujet | Détail |
|---|---|---|
| 🔴 **bloquant** | Redis `NOAUTH` en boucle | Stalwart tente d'utiliser Redis (rate-limit, throttle, task locks) sans envoyer de mot de passe. Redis (`/etc/redis/redis.conf`) impose `requirepass …`. Conséquences : rate-limit IP HS, queue locks en échec → réessais permanents. Toutes les minutes : `Failed to lock event/task`. |
| 🟠 | HELO invalides en masse depuis `85.209.176.233` | Comportement scanner externe. Pas de fuite, mais combiné au bug Redis ci-dessus, les protections de débit ne s'appliquent pas. |
| 🟡 | Multiples relances `Mailbox does not exist` | Tentatives entrantes vers comptes inexistants (`service-client@lumiereacademy.com`…). Normal pour un MX exposé, ne perturbe pas l'envoi. |

> **Action préalable obligatoire avant tout envoi prod :** ajouter le mot
> de passe Redis à la config Stalwart (via CLI ou webmail admin →
> Settings → Storage → Redis). Sans cela, l'envoi marche mais les
> protections anti-abus et la file de retry sont dégradées.

---

## 5. État de l'application FemiGlow vis-à-vis du mail

### 5.1 Stack et environnement

| Élément | Valeur |
|---|---|
| Monorepo | `/var/www/femiglow` (`pnpm` workspace, une seule app `apps/web`) |
| Framework | Next.js 16 (`next-server v16.2.1` actif, service `femiglow.service` en marche) |
| URL publique | `https://femiglow-maroc.com` (`NEXT_PUBLIC_SITE_URL` dans `apps/web/.env`) |
| `.env` prod | `apps/web/.env` (76 lignes, fournit DB, sessions, chat, médias, **aucune** variable mail effective) |

### 5.2 Aucune dépendance d'envoi de mail

```
$ grep -E "nodemailer|resend|sendgrid|mailgun|postmark|smtp" apps/web/package.json
(aucun résultat)
```

Côté code, seul `RESEND_API_KEY` est déclaré dans `apps/web/src/lib/env.ts:9,69`
comme **optional**, jamais consommé.

### 5.3 Endpoints qui devraient envoyer un email — état réel

| Endpoint | Fichier | Comportement actuel |
|---|---|---|
| `POST /api/contact` | `apps/web/src/app/api/contact/route.ts` | Valide le formulaire, **`console.warn` puis retourne `{ok:true}`**. Aucun email envoyé. |
| `POST /api/newsletter` | `apps/web/src/app/api/newsletter/route.ts` | Idem : log + commentaire `// Phase 2 : intégration Resend Audiences ou Mailjet.` |
| `POST /api/chat/lead/email` | `apps/web/src/app/api/chat/lead/email/route.ts` | Capture l'email du visiteur dans `chat_session.utm.leadEmail`. Aucun envoi. |
| `POST /api/chat/lead/contact` | `apps/web/src/app/api/chat/lead/contact/route.ts` | Capture lead → insertion DB → **dispatch webhook** (best-effort via `lib/chat/services/lead-webhook.ts`). Aucun email. |

### 5.4 Adresses email codées en dur — incohérence de domaine

| Constante | Fichier | Valeur | Domaine vivant ? |
|---|---|---|---|
| `CONTACT_EMAIL` | `apps/web/src/app/(marketing)/contact/page.tsx:15` | `contact@femiglow.ma` | ❌ NXDOMAIN |
| `CONTACT_EMAIL` | `apps/web/src/components/forms/ContactForm.tsx:20` | `contact@femiglow.ma` | ❌ NXDOMAIN |
| `email` (JSON-LD Organization) | `apps/web/src/lib/seo/json-ld.tsx:29` | `contact@femiglow.ma` | ❌ NXDOMAIN |
| `ADMIN_BOOTSTRAP_EMAIL` (prod) | `apps/web/.env` | `admin@femiglow-maroc.com` | ✅ |
| Tests / mocks | `*.test.ts` | `admin@femiglow.ma`, `test@femiglow.ma` | n/a |

> Le code public affiche un email mort. Indépendamment de l'intégration
> Stalwart, c'est un correctif prioritaire (UX + DKIM/DMARC alignment).

### 5.5 Documentation existante sur l'email

- `docs/admin/recommandation-finale.md:253` indique :
  > « **Email transactionnel** : le câblage de Resend (déjà en env) sort
  > du périmètre admin v1. Sera ajouté quand un événement nécessitera
  > notification (ex. nouveau lead urgent). »
- `docs/admin/specifications/09-environnement/monitoring.md` mentionne
  l'envoi SMTP des alertes (P0, erreurs récurrentes) mais n'identifie
  pas de fournisseur.

**Décision implicite à acter** : abandonner Resend / Mailjet pour
l'**émetteur self-host Stalwart** déjà en place.

### 5.6 Infrastructure connexe réutilisable

| Brique existante | Localisation | Intérêt pour l'email |
|---|---|---|
| Moteur webhook (retry, backoff, anti-SSRF) | `apps/web/src/lib/webhooks/*` | Bon référentiel pour bâtir un `outbox` email côté DB (mêmes garanties at-least-once). |
| Logger applicatif | `apps/web/src/lib/logging/logger.ts` | Routera les erreurs d'envoi vers Sentry une fois branché. |
| Cron `tick` | `apps/web/src/app/api/cron/tick/route.ts` | Peut piloter le retry d'une éventuelle table `email_outbox`. |
| Cron services systemd FemiGlow | `femiglow-cron-*.service` | ⚠️ **tous en état `failed`** — séparé de l'email mais à corriger en parallèle pour qu'un cron de retry tienne. |

---

## 6. Surface d'intégration cible (résumé sans plan)

À partir de l'état ci-dessus, le câblage minimal viable se résume à :

1. **Prérequis serveur** (à faire avant tout code) :
   - Corriger SPF (§ 3.5).
   - Donner à Stalwart le mot de passe Redis (§ 4).
   - Vérifier `ufw` pour fermer `8080` au public si exposé.
   - Décider du compte d'envoi applicatif (recommandé : créer
     `noreply@femiglow-maroc.com` dédié à l'application, distinct de
     `contact@` et `info@`).
   - Vérifier le PTR/rDNS de `46.202.128.168` et l'aligner sur
     `mail.lumiereacademy.com` (ou ajouter un alias propre pour
     FemiGlow).

2. **Paramètres SMTP côté FemiGlow** (à injecter dans `.env`) :
   ```
   SMTP_HOST=mail.femiglow-maroc.com   # ou 127.0.0.1 si on évite le DNS
   SMTP_PORT=587                       # STARTTLS
   SMTP_USER=noreply@femiglow-maroc.com
   SMTP_PASSWORD=<à générer via Stalwart admin>
   MAIL_FROM="FemiGlow <noreply@femiglow-maroc.com>"
   MAIL_REPLY_TO=contact@femiglow-maroc.com
   ```

3. **Dépendance applicative** : ajouter `nodemailer` (ou `mailauth` +
   `smtp-connection`). Pas de SDK SaaS, on parle directement à Stalwart
   sur `127.0.0.1:587` (ou via TLS publique pour rester portable).

4. **Module mailer central** à créer (proposition de chemin) :
   `apps/web/src/lib/mail/{client,templates,outbox}.ts`. Le module est
   le **seul** appelant de nodemailer, expose `sendTransactional(name, payload, recipient)` et écrit dans une table `email_outbox` pour la
   reprise. Reuse exact des conventions du module `lib/webhooks/`.

5. **Points d'appel à câbler** (par ordre de valeur produit) :
   1. `POST /api/contact` → mail à `contact@femiglow-maroc.com` + accusé client.
   2. `POST /api/chat/lead/contact` → notification interne urgente (lead).
   3. `POST /api/chat/lead/email` → reprise de conversation (lien magique).
   4. `POST /api/newsletter` → confirmation double opt-in.
   5. Reset mot de passe admin / vérification email (à implémenter, n'existe pas).

6. **Constantes adresse à unifier** : remplacer `contact@femiglow.ma`
   par `contact@femiglow-maroc.com` partout (§ 5.4). Idéalement, exposer
   l'adresse via env (`NEXT_PUBLIC_CONTACT_EMAIL`) plutôt que constante
   en dur dans 3 fichiers.

7. **Observabilité** : étendre Sentry (cf.
   `docs/admin/specifications/09-environnement/monitoring.md`) avec un
   tag `mailer` + dashboard Stalwart (logs déjà détaillés dans
   `/etc/stalwart-mail/logs/`).

---

## 7. Risques et points de vigilance

| Risque | Probabilité | Mitigation |
|---|---|---|
| Mails marqués spam à cause du SPF cassé | **élevée** | Corriger SPF avant tout test prod (§ 3.5). |
| Stalwart Redis NOAUTH masque la perte de retries | **élevée** | Réparer Redis avant de générer du trafic mail. |
| Mauvais `From:` (alignment DMARC) | moyenne | Toujours envoyer depuis un compte du domaine signé (`@femiglow-maroc.com`). Vérifier le HELO = nom DNS aligné. |
| Conflit de comptes (admin lumiereacademy ↔ FemiGlow) | moyenne | Créer un compte applicatif `noreply@` dédié pour cloisonner. |
| Le compte `contact@femiglow-maroc.com` planifié dans `/tmp/*.json` contient un mot de passe en clair | moyenne | Purger `/tmp/stalwart-*.json` après import / rotation. |
| Crons FemiGlow tous en `failed` | moyenne | Bloque toute future stratégie de retry mail via cron — à résoudre en parallèle (hors-sujet email mais sur le chemin critique). |
| Webmail/admin sur `8080` non TLS | basse-moyenne | Soit on n'expose pas `8080` publiquement (firewall), soit on met nginx + LE devant. |

---

## 8. Inventaire bref des artefacts à consulter

- `/etc/stalwart-mail/etc/config.json` — pointeur RocksDB.
- `/var/lib/stalwart/` — base RocksDB (config persistée).
- `/etc/stalwart-mail/logs/stalwart.<date>` — logs détaillés (clé `…-error`, `…-success`, `auth.success`).
- `/etc/systemd/system/stalwart-mail.service` — unit file.
- `/usr/local/bin/stalwart-cli` — CLI (besoin `STALWART_URL`, user/password).
- `/root/stalwart-credentials.txt` — credentials (non lus pendant l'audit).
- `/tmp/stalwart-*.json` — fichiers de bootstrap (cert, DKIM RSA/Ed25519, compte contact). À ne **pas** garder en place.
- `/home/hermes/.hermes/` — mémoire et logs de l'agent Hermes (mémoire applicative vide).
- `/var/www/femiglow/apps/web/.env` — env prod FemiGlow.
- `/var/www/femiglow/apps/web/src/lib/env.ts` — schéma Zod des variables (à étendre).
- `/var/www/femiglow/apps/web/src/app/api/contact/route.ts`, `…/api/newsletter/route.ts`, `…/api/chat/lead/*` — premiers appelants.

---

## 9. Diagnostic en une phrase

L'écosystème mail est **opérationnel à 90 %** côté serveur (TLS, DKIM,
DMARC, ports, comptes) mais l'application FemiGlow n'a **aucun fil de
sortie** vers ce serveur ; les deux correctifs préalables critiques
sont la **publication d'un SPF fonctionnel** et l'**ajout du mot de
passe Redis dans la config Stalwart** — sans cela tout envoi
transactionnel se fera dans des conditions dégradées de réputation et
de retry.
