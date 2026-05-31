# 17 — Workflow de modération

Spécification du processus complet de modération d'un témoignage, depuis la soumission jusqu'à la publication (ou le rejet), avec auto-flags, vision ML pour détection de visages, SLA, audit log et e-mails de retour.

## 1. Cycle de vie d'un témoignage

```
              POST /api/rituals/submit
                       │
                       ▼
         ┌──── PENDING (status initial) ─────┐
         │                                    │
         ▼                                    ▼
  Sanitization body              Vision ML faces (par photo)
  (emojis, espaces, etc.)        ──────────────────────────
         │                       │ OK : photo OK              │
         │                       │ MANUAL_REVIEW : à examiner │
         │                       │ REJECTED_FACE : visage     │
         │                       └────────────────────────────┘
         │                                    │
         ▼                                    ▼
  Auto-flags detection           Photo flags ajoutés à
  (link, forbidden, length)      auto_flags du témoignage
         │                                    │
         └──────────────┬─────────────────────┘
                        ▼
         ┌──── Queue de modération ───┐
         │  Tri par priorité auto-flag │
         └──────────────┬──────────────┘
                        │
                  Modératrice lit
                        │
              ┌─────────┼─────────┐
              ▼         ▼         ▼
        Approuver   Rejeter   Masquer
              │         │         │
              ▼         ▼         ▼
          APPROVED  REJECTED  HIDDEN
              │         │         │
              ▼         ▼         ▼
   Visible    E-mail   Pas visible,
   sur wall   à        archivé
              l'auteure
```

## 2. SLA et engagement

### 2.1 SLA publié

**24 à 48 heures** entre `created_at` et décision de modération.

Affiché à l'initiée :

- Sur la confirmation post-soumission : « Nous l'ouvrirons sous 24 à 48 heures. »
- Sur la page politique : « Nous le lisons à la main, dans nos heures de calme, sous 48 heures. »
- Sur l'e-mail d'approbation : implicite (envoyé au moment de la publication).

### 2.2 Alerte SLA dans l'admin

- À **36 h** sans décision, indicateur jaune sur la queue.
- À **48 h** sans décision, indicateur rouge + e-mail à la modératrice + webhook Slack si configuré.
- À **72 h** sans décision, escalade : e-mail à `admin@femiglow-maroc.com`.

### 2.3 Cadence réelle attendue

À 10 témoignages / mois (cible 6 mois), modération ~ 20-30 min / mois. Largement soutenable même en charge admin partielle.

## 3. Auto-flags

Détectés automatiquement à l'insertion. **Augmentent la priorité** dans la queue, **ne rejettent jamais** automatiquement.

| Flag | Détection | Action UI admin |
| --- | --- | --- |
| `face_detected` | Au moins une photo avec `faces_status = REJECTED_FACE` ou `MANUAL_REVIEW` | Badge orange `PRIORITÉ` |
| `emoji_detected` | Caractère Unicode `U+1F300-1F9FF` détecté dans `body_original` | Badge informatif |
| `link_external` | Pattern URL `https?://` ou `www.` dans `body` | Badge informatif |
| `email_in_body` | Pattern e-mail `\S+@\S+\.\S+` dans `body` | Badge informatif |
| `phone_in_body` | Pattern téléphone (`+212`, `06`, `07` Maroc) | Badge informatif |
| `body_short` | `body.length < 80` caractères | Badge informatif (sans rejet, parfois ce sont les meilleurs) |
| `body_long` | `body.length > 500` caractères | Badge informatif |
| `forbidden_word` | Mot d'une liste interdite (insultes, marques concurrentes, médical non prouvé) | Badge rouge `À EXAMINER` |
| `all_caps` | Plus de 50 % du body en majuscules | Badge informatif (forme criée) |
| `repetition` | Caractère ou mot répété > 5 fois consécutives | Badge informatif |

### 3.1 Liste de mots interdits

Stockée dans `app_config` section `rituals_forbidden_words`, éditable par admin. Catégories :

- **Insultes et grossièretés** (FR + AR transcrites en latin).
- **Noms de marques concurrentes** (vernis, semi-permanent, OPI, Essie, etc.).
- **Allégations médicales** (« guérit », « médicament », « cure de »).
- **Promesses commerciales non vérifiables** (« miracle », « instantané »).

La liste est **non publiée** côté front pour éviter le contournement.

## 4. Vision ML — détection de visages

### 4.1 Modèle utilisé

**MediaPipe Face Detection** (Google, open source, ~4 Mo). Choisi pour :

- Précision honnête (90 %+ sur visages frontaux).
- Faible coût (~ 800 ms par image sur Vercel Functions).
- Pas de dépendance cloud externe (privacy).

### 4.2 Pipeline

À l'upload d'une photo (`POST /api/rituals/submit`) :

1. **Validation** : mime, taille, dimensions.
2. **Sharp** : génération des variantes (display + thumb).
3. **EXIF strip** : pas de coordonnées GPS exposées.
4. **Job async enqueued** : `vision-ml-faces` avec `photoId`.
5. **Status initial** : `PENDING_CHECK`.

Job `vision-ml-faces` (worker server) :

```ts
1. Charge l'image variante display (≤ 1200 px).
2. Run MediaPipe.detectFaces() → returns array of bounding boxes + confidence.
3. Pour chaque détection :
   - confidence ≥ 0.85 ET bounding box ≥ 8% de l'image → faces_count++
4. Décision :
   - faces_count = 0 → faces_status = OK
   - faces_count >= 1 ET aucune face frontale (confidence < 0.95) → MANUAL_REVIEW
   - faces_count >= 1 ET face frontale (confidence >= 0.95) → REJECTED_FACE
5. UPDATE ritual_testimonial_photos.
6. Si tous les photos d'un témoignage ont leur status final :
   - Au moins une REJECTED_FACE → ajoute `face_detected` aux auto_flags du témoignage.
   - Toutes en MANUAL_REVIEW → ajoute `manual_review` aux auto_flags.
```

### 4.3 Affichage pour la modératrice

Photos affichées dans `/admin/rituals/[id]` avec :

- **OK** : photo sans marquage.
- **MANUAL_REVIEW** : photo avec rectangle orange autour de chaque face détectée, légende « Visage détecté, à examiner. »
- **REJECTED_FACE** : photo avec rectangle rouge, légende « Visage frontal détecté. Non publiable. »

### 4.4 Override modératrice

La modératrice peut :

- **Approuver la photo malgré le flag** (`MANUAL_REVIEW` → `OK`). Tracé dans audit : `ritual_admin_photo_face_overridden`.
- **Rejeter la photo seule** (`OK` ou `MANUAL_REVIEW` → `REJECTED_FACE` forcé). Le témoignage texte reste valide.
- **Re-run vision ML** : `POST /api/admin/rituals/[id]/photos/[photoId]/recheck` relance le job.

### 4.5 Politique en cas de doute

Quand un visage est partiellement visible (menton, sourire, hijab), le modèle classe en `MANUAL_REVIEW`. **Règle maison** :

- Si le regard n'est pas frontal → modératrice peut approuver. Exemple : `reviews1.jpg` et `reviews9.jpg` du dossier de référence.
- Si le visage occupe < 15 % de l'image → modératrice peut approuver.
- Si le sujet principal est clairement les mains et que le visage est en arrière-plan flou → approuver.

Cette nuance ne peut être automatisée — c'est précisément le rôle de l'humain dans la chaîne.

## 5. Sanitization du body

Pipeline appliqué à l'insertion :

```ts
function sanitizeBody(input: string): { sanitized: string; flags: string[] } {
  let body = input;
  const flags: string[] = [];

  // 1. Normalize Unicode NFC
  body = body.normalize('NFC');

  // 2. Strip emojis
  const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;
  if (emojiPattern.test(body)) {
    flags.push('emoji_detected');
    body = body.replace(emojiPattern, '');
  }

  // 3. Normalize apostrophes
  body = body.replace(/'/g, "’"); // ' → '
  body = body.replace(/(\s|^)"([^"]+)"(?=\s|$|[.,;:!?])/g, '$1« $2 »');

  // 4. Espaces fines insécables avant ponctuation forte
  body = body.replace(/(\S)\s+([:;?!])/g, '$1 $2');

  // 5. Trim & collapse spaces
  body = body.trim().replace(/\s{2,}/g, ' ');

  // 6. Detection patterns
  if (/https?:\/\/|www\./i.test(body)) flags.push('link_external');
  if (/\S+@\S+\.\S+/i.test(body)) flags.push('email_in_body');
  if (/(\+212|^06|^07)\d{8}/i.test(body)) flags.push('phone_in_body');
  if (body.length < 80) flags.push('body_short');
  if (body.length > 500) flags.push('body_long');

  const upperRatio = (body.replace(/[^A-Z]/g, '').length / body.length);
  if (upperRatio > 0.5) flags.push('all_caps');

  // 7. Forbidden words check
  const forbidden = await getForbiddenWords(); // from app_config
  for (const word of forbidden) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(body)) {
      flags.push('forbidden_word');
      break;
    }
  }

  return { sanitized: body, flags };
}
```

`body_original` (avant sanitization) est stocké pour audit. `body` (post) est ce qui sera publié.

## 6. Workflow détaillé par action

### 6.1 Approuver

1. Modératrice clique `Approuver`.
2. Modal de confirmation simple : « Publier ce rituel ? »
3. Si auto-flag `face_detected` présent et au moins une photo `REJECTED_FACE` → **modal renforcée** : « Au moins une photo contient un visage frontal. Voulez-vous : `Publier sans cette photo` / `Annuler` ? »
4. UPDATE : `status = APPROVED`, `published_at = now()`, `updated_at = now()`.
5. INSERT `ritual_audit_log` : action `approved`.
6. Trigger : webhook `ritual_published` (si configuré), e-mail d'approbation à l'auteure (si `customer_hash` rattachable à un e-mail connu).
7. Refresh `ritual_aggregate` (sous 5 min via CRON, ou immédiat via trigger Postgres).

### 6.2 Rejeter

1. Modératrice clique `Rejeter`.
2. **Modale obligatoire** :
   - Champ texte `Raison interne` (mémoire admin, non envoyé).
   - Sélecteur `Template de message à l'auteure` :
     - `rituals-rejected-face.md` (visage détecté).
     - `rituals-rejected-other.md` (autre raison).
     - `Pas d'e-mail` (rejet silencieux, rare).
   - Si template choisi : zone d'édition pré-remplie, modifiable.
   - Bouton `Confirmer le rejet`.
3. UPDATE : `status = REJECTED`, `moderation_note = ...`, `updated_at = now()`.
4. INSERT `ritual_audit_log` : action `rejected`, note.
5. Si template choisi : envoi e-mail asynchrone via queue.
6. Le témoignage **n'est pas supprimé** — RGPD-friendly et auditable.

### 6.3 Masquer

Action sur un témoignage **déjà publié**, à retirer du wall sans le supprimer.

1. Modale : « Raison du masquage. »
2. UPDATE : `status = HIDDEN`, `moderation_note = ...`.
3. INSERT audit : action `hidden`.
4. Aucun e-mail à l'auteure par défaut. Option « Notifier l'auteure » disponible si la raison l'exige.

### 6.4 Restaurer

Sur un témoignage `HIDDEN` ou `REJECTED`.

1. Modale : « Voulez-vous re-publier ce rituel ? »
2. UPDATE : `status = APPROVED`, `published_at = now()` (mise à jour).
3. INSERT audit : action `restored`.

### 6.5 Mettre en avant / Retirer

Sur un témoignage `APPROVED`.

1. Limite vérifiée : max 3 `featured = true` simultanés.
2. Si déjà 3 : modale proposant de retirer le plus ancien.
3. UPDATE : `featured = true`.
4. INSERT audit : action `featured_on`.
5. `ritual_aggregate` rafraîchi (le module compact se met à jour).

### 6.6 Corriger une coquille

Pour de petites corrections typographiques (apostrophe droite → courbe, espace insécable manquant).

1. Modal d'édition avec le `body` actuel.
2. Diff visuel mis en évidence.
3. **Limite** : max 5 caractères modifiés.
4. Au-delà : action `corrected_substantially`, **demande de re-modération** (status repasse en `PENDING`, l'initiée n'est pas notifiée).
5. INSERT audit : action `corrected`, snapshot avant/après dans `payload`.

### 6.7 Suppression définitive (RGPD)

Sur demande explicite de l'auteure via `info@femiglow-maroc.com`.

1. Recherche par `customer_hash` (HMAC SHA-256 de l'e-mail).
2. Modale double confirmation : « Cette action est irréversible. »
3. Photos supprimées du stockage (Vercel Blob).
4. DELETE en cascade : témoignage + photos + audit log entries.
5. **Exception** : un enregistrement de suppression est conservé dans `app_audit_events` pour la conformité RGPD (DSAR audit trail).

## 7. E-mails de modération

Templates dans `apps/web/content/email-templates/rituals/` (cf. `10-interface-admin.md` § 14).

### 7.1 E-mails sortants

| Trigger | Template | Envoyé à |
| --- | --- | --- |
| Soumission acceptée et publiée | `rituals-approved.md` | Auteure (via `customer_hash` → e-mail si retrouvable) |
| Soumission rejetée — visage détecté | `rituals-rejected-face.md` | Auteure |
| Soumission rejetée — autre | `rituals-rejected-other.md` | Auteure |
| Photo seule rejetée | `rituals-photo-rejected.md` | Auteure |

### 7.2 E-mails internes

| Trigger | Destinataire |
| --- | --- |
| Nouvelle soumission | Modératrice (1 mail digest quotidien ou webhook Slack) |
| Témoignage en queue > 36 h | Modératrice |
| Témoignage en queue > 72 h | Admin escalade |

### 7.3 Headers d'e-mail

- **From** : `La maison FemiGlow <maison@femiglow-maroc.com>`
- **Reply-To** : `info@femiglow-maroc.com`
- **List-Unsubscribe** : `<mailto:info@femiglow-maroc.com?subject=unsub>`

## 8. Audit log

Toute action conserve une trace dans `ritual_audit_log`. Append-only.

### 8.1 Schéma rappel

```
id, testimonial_id, actor_id, action, note, payload, created_at
```

### 8.2 Vue admin

`/admin/rituals/[id]` affiche le log inversé chronologique :

```
─ 12 mai 14:32 · Souheila · approved · 
─ 12 mai 14:31 · Souheila · photo face overridden (photo #2)
─ 11 mai 16:33 · système · auto-flag face_detected
─ 11 mai 16:32 · système · created (source: email_j45)
```

Cliquer une ligne déploie le `payload` si présent (snapshot avant/après pour les `corrected`).

### 8.3 Rétention

Audit log conservé **5 ans** minimum (RGPD + audit interne). Pas de purge automatique.

## 9. Rôles RBAC

| Rôle | Approve | Reject | Hide | Restore | Feature | Correct | Delete RGPD |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **admin** | Oui | Oui | Oui | Oui | Oui | Oui | Oui (avec double conf) |
| **moderator** | Oui | Oui | Oui | Oui | Non | Oui (≤ 5 chars) | Non |
| **viewer** | Non | Non | Non | Non | Non | Non | Non |

Implémenté via `admin_users.role` existant.

## 10. Cas particuliers

### 10.1 Soumission depuis l'e-mail J+45 sans `body`

Le wizard valide côté client. Mais si un attaquant POST directement avec `body=""` :

- Validation Zod côté serveur rejette (400).
- Rate-limit s'applique normalement.
- Pas d'effet de bord BDD.

### 10.2 Doublon (même `customer_hash` deux fois)

- Premier essai dans les 30 j → 409 Conflict : « La maison a déjà reçu votre voix récemment. »
- Au-delà de 30 j → accepté (l'initiée peut témoigner à 6 mois, 1 an, etc.).

### 10.3 Témoignage sans `order_id`

Acceptable. `verified_purchase = false`. La modératrice voit le flag « Non vérifiée » et peut vérifier autrement (e-mail à l'auteure pour demander la commande).

### 10.4 Photo corrompue

Sharp throw, capture par le handler async, `faces_status = OK` n'est pas écrit. Le job sera retenté 3 fois (cron `rituals-faces-recheck-stale`). Au 4ᵉ échec, la photo passe en `MANUAL_REVIEW` et la modératrice peut décider.

## 11. Métriques de qualité du workflow

| Métrique | Cible | Source |
| --- | --- | --- |
| Délai médian de modération | < 24 h | `published_at - created_at` |
| Taux d'approbation | > 90 % | `APPROVED / (APPROVED + REJECTED)` |
| Taux d'auto-flag `face_detected` | < 5 % | Audit |
| Taux d'override manuel sur face_detected | > 30 % | Indique que MediaPipe est trop sévère sur cas valides |
| Taux de re-modération (corrected_substantially) | < 2 % | Indique stabilité |
| Taux de suppression RGPD | < 0,5 % | Demandes explicites |

## 12. Synthèse — règles d'or modération

1. **Aucun rejet automatique.** Tout passe par une humaine.
2. **Auto-flags élèvent la priorité, ne décident pas.**
3. **Le texte original (`body_original`) est conservé** — toujours pouvoir revenir.
4. **Le délai 24-48 h est publié et tenu.**
5. **Les e-mails de retour sont éditoriaux, pas administratifs.** Voix maison à chaque template.
6. **Vision ML est un appui, pas un juge.** La modératrice override en cas de doute légitime (hijab, sourire).
7. **L'audit log est immuable et conservé 5 ans.**
8. **La suppression RGPD est totale**, sauf trace de suppression dans `app_audit_events`.
9. **Le rôle `viewer` n'a aucune action** — utile pour stagiaires ou observateurs.
10. **Souheila est la modératrice principale**, par défaut. La maison peut habiliter d'autres modératrices via `admin_users.role = 'moderator'`.
