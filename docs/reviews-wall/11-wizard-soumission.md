# 11 — Wizard de soumission d'un rituel partagé

Le wizard est l'interface qui permet à une initiée de soumettre son témoignage. Il se présente en **3 étapes progressives**, avec une **étape de confirmation**. Il est accessible depuis deux points d'entrée :

1. **Le drawer du wall** — clic sur `Partager mon rituel →`. Le drawer bascule en mode wizard.
2. **L'e-mail J+45** — clic sur le bouton `Partager mon rituel` dans l'e-mail. Le drawer s'ouvre directement en wizard, avec `productKey`, `customerFirstName`, `customerCity` pré-remplis si la maison les connaît, et un `emailToken` HMAC validé serveur.

## 1. Posture éditoriale

Le wizard est un **acte d'écriture lent**. Il n'a pas la grammaire d'un formulaire e-commerce (champ obligatoire / champ optionnel / erreur rouge). Il a celle d'une lettre — chaque étape ouvre un nouveau paragraphe.

Cinq principes éditoriaux :

1. **Friction minimale dès l'étape 1** — soumettre est possible avec seulement texte + signal.
2. **Validation inline non agressive** — pas de message d'erreur tant que le champ n'a pas perdu le focus.
3. **Pas de progress bar criante** — un indicateur discret « 1 sur 3 » suffit, pas de barre orange qui flashe.
4. **Voix maison à chaque chaîne** — pas de « Champ obligatoire ». Plutôt « Vos mots resteront avec nous ».
5. **Sortie possible sans perte** — fermer le wizard sauvegarde un brouillon local 7 jours (localStorage).

## 2. Anatomie en étapes

### 2.1 Étape 1 — Votre rituel (obligatoire)

```
┌─────────────────────────────────────────┐
│  [← Revenir aux rituels]      1 sur 3   │
│                                         │
│  PARTAGER MON RITUEL                    │
│  Étape 1 — Votre voix                   │
│                                         │
│  ╌╌╌╌◆╌╌╌╌                              │
│                                         │
│  Qu'est-ce que le rituel a changé       │
│  pour vous ?                            │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Décrivez ce que vous avez       │   │
│  │ remarqué. Cinquante mots        │   │
│  │ suffisent.                      │   │
│  │                                 │   │
│  │                                 │   │
│  │                                 │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│  157 / 50 mots                          │
│                                         │
│                                         │
│  Recommanderiez-vous ce rituel à        │
│  une amie ?                             │
│                                         │
│  ○ Oui, sans hésiter                    │
│  ○ J'hésite                             │
│  ○ Pas pour moi                         │
│                                         │
│                                         │
│  ─────────────────────                  │
│  [Continuer →]                          │
│  Vous pouvez partager dès maintenant.   │
│  Les détails sont facultatifs.          │
└─────────────────────────────────────────┘
```

#### 2.1.1 Champ `body`

- **Composant** : `<textarea>` Cormorant Regular 17 pt encre, line-height 1.6.
- **Placeholder** : « Décrivez ce que vous avez remarqué. Cinquante mots suffisent. »
- **Min / max** : 50 mots / 250 mots indicatifs. Validation Zod côté serveur : 50 à 600 caractères. La limite mots est calculée et affichée en temps réel pour guider, mais ce sont les caractères qui font foi.
- **Compteur** : `[X / 50 mots]` Inter Regular 12 pt brume, sous le textarea.
  - Si < 50 mots : compteur en encre, neutre.
  - Si ≥ 50 mots : compteur passe en sauge-dark, message discret « Suffisamment dense pour être lue. »
  - Si > 250 mots : compteur passe en `#9C5B5B` (rouge feutre), message « Plus court invite à plus de lecture. »
- **Sanitization à la frappe** : emojis tapés sont **immédiatement** retirés avec un toast doux en haut « Les émoticônes ne sont pas dans notre grammaire. » 2 sec, fade-out.
- **Auto-save brouillon** : toutes les 15 sec dans `localStorage` clé `ritual-draft-v1`.
- **Validation submit** : `body.length >= 50 && body.length <= 600 && body.trim() !== ''`.

#### 2.1.2 Champ `would_recommend`

- **Composant** : `<fieldset>` avec 3 `<label>` portant chacun un `<input type="radio">`.
- **Labels** :
  - `Oui, sans hésiter` (valeur `oui`)
  - `J'hésite` (valeur `hesite`)
  - `Pas pour moi` (valeur `non`)
- **Style** :
  - Radio caché, label cliquable plein largeur, fond crème pure, bordure 1 px ligne, padding 16 px.
  - État `:checked` (via `:has(input:checked)`) : bordure sauge-dark 2 px, fond sauge-pale.
  - Touch target ≥ 44 px sur chaque label.
- **Validation** : obligatoire pour passer à l'étape suivante.
- **Pas d'icône**, pas de couleur sémantique (rouge / vert). Le luxe ici est l'absence de jugement visuel.

#### 2.1.3 CTA bas d'étape

- `[Continuer →]` : bouton plein largeur encre, hauteur 56 px, visible uniquement si validation OK.
- Microcopy sous le bouton : « Vous pouvez partager dès maintenant. Les détails sont facultatifs. »
- Lien discret au-dessus : `Soumettre tel quel →` (Inter Medium 13 pt brume) — saute directement à la confirmation sans passer par étapes 2 et 3.

### 2.2 Étape 2 — Détails (recommandée, sautable)

```
┌─────────────────────────────────────────┐
│  [← Retour]               2 sur 3       │
│                                         │
│  PARTAGER MON RITUEL                    │
│  Étape 2 — Vos mots-clés                │
│                                         │
│  ╌╌╌╌◆╌╌╌╌                              │
│                                         │
│  Que diriez-vous en trois mots ?        │
│  (jusqu'à trois)                        │
│                                         │
│  ☐ Ongles plus lisses                   │
│  ☐ Plaque souple                        │
│  ☐ Cuticules apaisées                   │
│  ☐ Plus de casse                        │
│  ☐ Éclat naturel                        │
│  ☐ Rituel devenu habitude               │
│  ☐ Mains détendues                      │
│  ☐ Fini brillant                        │
│  ☐ Halal                                │
│                                         │
│                                         │
│  Une photo de vos mains ?               │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │  + Glisser ou choisir           │   │
│  │    jusqu'à 3 photos             │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Mains, gestes, table de soin.          │
│  Pour préserver l'intimité de la        │
│  maison, nous ne publions pas de        │
│  visage de face.                        │
│                                         │
│                                         │
│  ─────────────────────                  │
│  [Continuer →]                          │
│  [Passer cette étape →]                 │
└─────────────────────────────────────────┘
```

#### 2.2.1 Tags rituel

- **Composant** : grid de checkboxes 2 colonnes desktop, 1 colonne mobile.
- **Liste fermée** (modifiable dans l'admin via `app_config`) :
  1. Ongles plus lisses
  2. Plaque souple
  3. Cuticules apaisées
  4. Plus de casse
  5. Éclat naturel
  6. Rituel devenu habitude
  7. Mains détendues
  8. Fini brillant
  9. Halal
- **Limite** : max 3. Une fois 3 cochés, les autres deviennent disabled (opacité 40 %), avec tooltip « Trois suffisent. »
- **Style** : case `:checked` → bordure sauge-dark, fond sauge-pale, sans icône check.
- **Optionnel** : si 0 coché, soumission OK.

#### 2.2.2 Photos

- **Composant** : zone drag & drop + bouton `+ Glisser ou choisir`.
- **Affordance** :
  - Drag visible : bordure 2 px en pointillés sauge-dark.
  - Drop OK : bordure 2 px solide sauge.
- **Validation client** :
  - Max 3 photos.
  - Formats acceptés : JPEG, PNG, HEIC, WebP.
  - Taille max 5 Mo / photo. Si dépassé, **compression** automatique côté client (Canvas API, qualité 0.85) avant upload.
  - Dimensions min 600 × 600 px.
- **Aperçu** : après upload, vignettes 100×100 px alignées, bouton `×` pour retirer.
- **Côté serveur** :
  - Upload vers Vercel Blob (ou stockage local en dev).
  - Job async vision ML faces detection.
  - Si `faces_count > 0 && faces_status = REJECTED_FACE` au check immédiat : **alert non bloquante** au témoin : « La photo contient un visage. Pour préserver l'intimité de la maison, voudriez-vous la remplacer ? » avec choix `Remplacer` / `Conserver pour relecture humaine`.
- **Microcopy** sous la zone :
  - « Mains, gestes, table de soin. »
  - « Pour préserver l'intimité de la maison, nous ne publions pas de visage de face. »

#### 2.2.3 CTAs bas d'étape

- `[Continuer →]` : suivant étape.
- `[Passer cette étape →]` : passe directement à la confirmation, sans étape 3.
- `[← Retour]` : retour étape 1 (sans perte de données).

### 2.3 Étape 3 — Vous (recommandée)

```
┌─────────────────────────────────────────┐
│  [← Retour]               3 sur 3       │
│                                         │
│  PARTAGER MON RITUEL                    │
│  Étape 3 — Votre signature              │
│                                         │
│  ╌╌╌╌◆╌╌╌╌                              │
│                                         │
│  Comment souhaitez-vous signer ?        │
│                                         │
│  Prénom (apparaîtra publiquement)       │
│  ┌─────────────────────────────────┐   │
│  │ Amal                            │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Ville                                  │
│  ┌─────────────────────────────────┐   │
│  │ Rabat                       [▾] │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Initiée depuis                         │
│  ┌──────────┬─────────────────────┐    │
│  │ Février  │ 2026                │    │
│  └──────────┴─────────────────────┘    │
│                                         │
│  ☐ Signer anonymement                   │
│    (la maison gardera votre prénom      │
│    en mémoire, mais publiera            │
│    « Une initiée, Rabat »)              │
│                                         │
│                                         │
│  ─────────────────────                  │
│  [Partager mon rituel →]                │
│  [Passer cette étape →]                 │
└─────────────────────────────────────────┘
```

#### 2.3.1 Champs

| Champ | Composant | Validation |
| --- | --- | --- |
| **Prénom** | `<input type="text">` Inter 15 pt | 1 à 30 caractères, lettres + espaces + apostrophes + traits d'union |
| **Ville** | `<select>` avec autocomplete Inter 15 pt | Liste fixée : Rabat, Casablanca, Salé, Tanger, Marrakech, Fès, Agadir, Oujda, Tétouan, Meknès, Kénitra, Autre |
| **Initiée depuis** | 2 `<select>` (mois + année) | Mois 1–12, année 2024–année courante |
| **Anonymat** | `<input type="checkbox">` | Si coché : `is_anonymous = true`, signature affichée « Une initiée, [Ville] » |

Tous **optionnels**. Si l'initiée laisse vide, la carte affichera « Une initiée » (anonymat par défaut). Le but : ne pas forcer l'identité.

#### 2.3.2 Pré-remplissage depuis e-mail J+45

Si `emailToken` validé, la maison récupère depuis la table `orders` :

- `customerFirstName` → champ Prénom pré-rempli.
- `customerCity` → champ Ville pré-rempli (si la maison l'a stocké au checkout).
- `paid_at` → champ « Initiée depuis » pré-rempli au mois du paiement.

L'initiée peut tout modifier.

#### 2.3.3 CTAs bas d'étape

- `[Partager mon rituel →]` : déclenche le `POST /api/rituals/submit`.
- `[Passer cette étape →]` : soumission immédiate avec champs vides (anonymat par défaut).
- `[← Retour]` : retour étape 2.

### 2.4 Étape de confirmation

```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│              ╌╌╌╌◆╌╌╌╌                  │
│                                         │
│         La maison reçoit                │
│         votre rituel.                   │
│                                         │
│         Nous l'ouvrirons sous           │
│         24 à 48 heures.                 │
│                                         │
│         Vous recevrez un mot            │
│         quand il sera publié.           │
│                                         │
│                                         │
│         Avec soin,                      │
│         Souheila · FemiGlow             │
│                                         │
│                                         │
│              ╌╌╌╌╌╌╌╌╌╌                 │
│                                         │
│         [Continuer la lecture]          │
│                                         │
└─────────────────────────────────────────┘
```

- Centré, Cormorant Italic 22 pt encre.
- Fleuron en haut et bas.
- Bouton `Continuer la lecture` ramène au drawer en mode liste, scroll position préservée.
- Si fermeture (croix ou ESC), la page parente est restaurée.
- Auto-close 8 secondes si pas d'action.

## 3. Indicateurs de progression

Coin haut droit du wizard :

```
                                    2 sur 3
```

Inter Regular 12 pt brume. Pas de barre, pas de fill.

Si l'initiée saute des étapes :

```
                                    Étape 2 — passée
```

## 4. Brouillon local et reprise

### 4.1 Sauvegarde

```ts
localStorage.setItem('ritual-draft-v1', JSON.stringify({
  body,
  wouldRecommend,
  ritualTags,
  authorFirstName,
  authorCity,
  initiatedSince,
  isAnonymous,
  photoBlobKeys, // upload déjà fait, on garde la référence Vercel Blob
  timestamp: Date.now(),
}));
```

### 4.2 Restauration

Au mount du wizard, si `ritual-draft-v1` existe :

- Si timestamp > 7 jours → ignoré, supprimé.
- Sinon, modal au mount :
  ```
  La maison a gardé votre rituel en mémoire.
  Voulez-vous le reprendre ou recommencer ?

  [Reprendre]  [Recommencer]
  ```

### 4.3 Nettoyage

À la soumission réussie, `localStorage.removeItem('ritual-draft-v1')`.

## 5. États du wizard

| État | Description |
| --- | --- |
| `step_1_idle` | Étape 1 vierge |
| `step_1_typing` | Saisie en cours, validation en temps réel |
| `step_1_valid` | Validation OK, CTA actif |
| `step_2_uploading` | Photos en cours d'upload (spinner sur chaque vignette) |
| `step_2_face_warning` | Modal alerte visage détecté |
| `step_3_submitting` | Bouton désactivé, spinner sur CTA |
| `submit_success` | Confirmation affichée |
| `submit_error` | Bannière rouge feutré « La maison n'a pas pu recevoir. Essayez à nouveau ou écrivez à info@femiglow-maroc.com. » |

## 6. Validation côté serveur — récap

À chaque `POST /api/rituals/submit` :

1. **CSRF** : token Iron-session vérifié.
2. **Rate limit** : 1 soumission / IP / 24 h ; 1 / `customer_hash` / 30 j.
3. **Zod schema** : `RitualTestimonialSubmit`.
4. **Sanitization** : pipeline détaillé dans `08-architecture-data.md` § 8.
5. **Auto-flags** : détection emoji, lien externe, mots interdits, longueur anormale.
6. **Photo jobs** : enqueue vision ML faces detection async.
7. **Customer hash check** : si déjà soumis sur 30 j, retourner `409 Conflict` avec message « La maison a déjà reçu votre voix récemment. »
8. **Insert** : `status = PENDING`, `created_at = now()`.
9. **Webhook** (si configuré) : `ritual_submitted` push vers Slack admin.

Réponse `202 Accepted` :

```json
{
  "data": {
    "publicSlug": "k7m3qp2x",
    "status": "PENDING",
    "estimatedPublishHours": 48
  }
}
```

## 7. Erreurs et leurs messages

| Code | Statut | Message à l'initiée |
| --- | --- | --- |
| `RATE_LIMIT` | 429 | « La maison a déjà reçu votre voix récemment. Si vous voulez nous écrire, info@femiglow-maroc.com reste ouverte. » |
| `VALIDATION_ERROR` (body trop court) | 400 | « Quelques mots de plus aideront d'autres initiées. » |
| `VALIDATION_ERROR` (body trop long) | 400 | « Plus court invite à plus de lecture. » |
| `VALIDATION_ERROR` (signal manquant) | 400 | « Auriez-vous l'amitié de nous dire si vous reprendriez ce rituel ? » |
| `PHOTO_TOO_LARGE` | 400 | « Votre photo est généreuse — pourriez-vous nous la donner sous 5 Mo ? » |
| `INVALID_EMAIL_TOKEN` | 401 | « Le lien depuis votre boîte mail n'est plus valide. Vous pouvez toujours partager depuis [la page rituels partagés]. » |
| `INTERNAL` | 500 | « La maison n'a pas pu recevoir votre rituel. Essayez à nouveau dans quelques minutes, ou écrivez-nous à info@femiglow-maroc.com. » |

Pas d'alerte rouge agressive — bannière sauge-pale avec icône ⓘ et texte en encre.

## 8. Accessibilité du wizard

| Élément | Pratique |
| --- | --- |
| Fieldset / radio | `<fieldset><legend>` correctement labellisé |
| Textarea | Label visible + `aria-describedby` pointant vers le compteur de mots |
| Checkboxes tags | `<fieldset><legend>` + chaque `<label>` |
| Datepicker | `<select>` natifs (pas custom) pour mois et année — accessibilité gratuite |
| Photos | `<input type="file" accept="image/*" multiple>` natif + drop zone |
| Navigation steps | Bouton retour explicite, focus se replace sur le premier champ de l'étape précédente |
| Confirmation | `role="status" aria-live="polite"` |

## 9. Animations

| Action | Durée | Easing |
| --- | --- | --- |
| Bascule entre étapes | 280 ms fade-cross | `in-out-silk` |
| Apparition compteur mots ≥ 50 | 200 ms fade | `out-soft` |
| Apparition aperçu photo | 240 ms scale + opacity | `out-soft` |
| Confirmation | 400 ms fade-in + 600 ms apparition fleuron | `out-soft` |
| Toast emoji retiré | 200 ms slide-down + 200 ms fade-out après 2 sec | `out-soft` |

Toutes désactivées avec `prefers-reduced-motion: reduce`.

## 10. Tracking dédié au wizard

| Événement | Quand | Payload |
| --- | --- | --- |
| `ritual_submit_start` | Wizard ouvert | `entry_point` (drawer / email), `prefilled` (boolean) |
| `ritual_submit_step_view` | Étape affichée | `step` (1/2/3) |
| `ritual_submit_step_complete` | Validation étape OK | `step`, `time_spent_ms` |
| `ritual_submit_step_skip` | Étape sautée | `step` |
| `ritual_submit_word_count_milestone` | Body atteint 50 mots | (aucun) |
| `ritual_submit_emoji_stripped` | Emoji retiré à la frappe | `emoji_count` |
| `ritual_submit_photo_upload_start` | Drop ou click upload | `count` |
| `ritual_submit_photo_upload_success` | Upload OK | `photo_index`, `byte_size` |
| `ritual_submit_photo_face_detected` | Vision ML face detected | `faces_count` |
| `ritual_submit_photo_replaced` | Photo remplacée après alerte face | (aucun) |
| `ritual_submit_success` | Soumission réussie | `has_photos`, `tag_count`, `signal`, `is_anonymous` |
| `ritual_submit_error` | Erreur soumission | `error_code` |
| `ritual_submit_abandoned` | Wizard fermé sans soumettre | `last_step`, `time_spent_ms` |
| `ritual_submit_draft_resumed` | Reprise de brouillon | `draft_age_hours` |

## 11. Tests

Tests Vitest dans `apps/web/src/components/sections/rituals/wizard/*.test.tsx` :

- Étape 1 : validation body min/max, sanitization emoji, choix signal.
- Étape 2 : limit 3 tags, upload photo, face detection alert.
- Étape 3 : pré-remplissage depuis email token, validation prénom.
- Brouillon : sauvegarde / reprise / nettoyage.

Tests Playwright e2e :

- Parcours complet depuis le drawer (3 étapes + confirmation).
- Parcours raccourci depuis e-mail J+45 (lien pré-rempli).
- Cas erreur rate-limit.
- Cas photo avec visage détecté → message + replacement.

## 12. Synthèse — règles d'or du wizard

1. **L'étape 1 doit pouvoir être soumise seule.** Toute friction au-delà tue la conversion.
2. **Pas de message d'erreur rouge en cours de frappe.** Validation au blur, messages doux.
3. **Voix maison à toutes les chaînes.** Pas un seul « Champ obligatoire » ni « Erreur ».
4. **Brouillon local 7 jours** pour ne jamais perdre l'effort d'écriture.
5. **Anonymat par défaut si rien n'est rempli en étape 3.** Pas d'obligation d'identité.
6. **Photo facultative, jamais bloquante.** L'alerte face est non bloquante (replace ou conserver pour relecture).
7. **Confirmation = lettre, pas notification.** Pas de checkmark vert, pas de toast — une vraie page de remerciement éditoriale.
