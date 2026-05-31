# 06 — Wizard de campagne — Spécification ultra-détaillée

> Document **central** pour l'implémentation du wizard `/admin/emails/campaigns/new`. Layout, validations, états, transitions, focus order, raccourcis, edge cases, et **scénarios de test atomiques** par composant et par étape. Référence obligatoire pour le dev frontend de la campagne broadcast (M3).

## §1 — Objectif & critères de réussite

Permettre à une utilisatrice **non-technique** (Souheila, équipe FemiGlow) de créer et planifier une campagne email en **< 15 min** sans assistance, avec :
- 6 étapes distinctes, progression visible, sauvegarde implicite à chaque étape.
- Validation **par étape** (impossible d'avancer sans champs requis).
- **Aperçu** systématique du rendu final (subject + body) avec variables résolues sur destinataire test.
- Garde-fou anti-erreur : avertir avant chaque action destructive ou irréversible.
- Reprise possible : un brouillon survit refresh, fermeture, change de device.
- Accessible clavier (tab order + raccourcis), conforme WCAG AA.
- Couvert par tests unitaires (Jest), intégration UI (RTL + MSW), E2E (Playwright).

**Critère de succès** : un utilisateur naïf qui suit le wizard sans formation crée et planifie sa campagne sans avoir besoin d'aide externe.

## §2 — Vue d'ensemble du wizard

### 2.1 — Les 6 étapes

| # | Étape | Question posée | Sortie persistée |
|---|---|---|---|
| 1 | **Type** | Quel type de campagne ? | `email_campaign_link.type` : `regular` ou `ab_test` |
| 2 | **Audience** | À qui envoyer ? | `audienceLinkIds[]` + estimate count |
| 3 | **Template** | Quel design ? | `templateSlug` + variables défaut |
| 4 | **Compose** | Sujet + variables ? | `subject`, `preheader`, `payloadJson` (variables resolved) |
| 5 | **Schedule** | Quand envoyer ? | `scheduledFor` (now / planned) |
| 6 | **Review & Send** | Validation finale | `status: 'scheduled'` ou `'sending'` |

### 2.2 — Layout global

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Retour  •  Brouillon enregistré il y a 2 s  •  [Quitter & garder] │
├──────────────────────────────────────────────────────────────────────┤
│ ●━━━━━●━━━━━●━━━━━○━━━━━○━━━━━○                                       │
│  Type   Audience  Template  Compose  Planif.  Vérif.                 │
│  ✓      ✓         ●         …       …        …                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│                    [zone contenu de l'étape]                          │
│                                                                       │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│ [⬅ Précédent]                                  [Suivant ➡] (disabled?)│
└──────────────────────────────────────────────────────────────────────┘
```

### 2.3 — Composants

```
components/admin/emails/wizard/
├── CampaignWizard.tsx          ← orchestrateur (state, persistence, nav)
├── WizardShell.tsx             ← layout commun (header, progress, footer)
├── WizardProgress.tsx          ← stepper visuel (clickable on completed steps)
├── WizardFooter.tsx            ← boutons prev / next + state
├── steps/
│   ├── StepType.tsx
│   ├── StepAudience.tsx
│   ├── StepTemplate.tsx
│   ├── StepCompose.tsx
│   ├── StepSchedule.tsx
│   └── StepReview.tsx
├── useCampaignWizard.ts        ← hook état + persistence draft
├── wizardSchema.ts             ← Zod par étape + global
└── wizardConstants.ts          ← labels, ordre des steps, helpers
```

### 2.4 — État (hook `useCampaignWizard`)

```ts
type WizardState = {
  draftId: string;                    // ulid, créé au step 1
  currentStep: 1 | 2 | 3 | 4 | 5 | 6;
  completedSteps: Set<number>;
  type: 'regular' | 'ab_test';
  audienceLinkIds: string[];
  excludeSuppressed: boolean;
  estimatedRecipients: number | null;
  templateSlug: string | null;
  templateVersion: number | null;
  subject: string;
  preheader: string;
  payload: Record<string, unknown>;   // variables resolved
  abVariant?: { subjectB: string; payloadB: Record<string, unknown> };
  scheduleMode: 'now' | 'scheduled';
  scheduledFor: Date | null;
  timezone: string;
  testRecipient: string;              // adresse pour test send
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  error: string | null;
};
```

### 2.5 — Persistence du draft

Pattern :
1. Au mount step 1 (si pas de `draftId` en URL) → server action `createCampaignDraft()` → INSERT `email_campaign_link(status='draft', name='Sans titre', …)` → redirect `?draftId=<ulid>&step=1`.
2. Chaque changement de step **avant** transition → server action `saveCampaignDraft(draftId, patch)`. Debounced 800 ms sur les changements rapides (subject typing).
3. À la sortie volontaire (Quitter & garder) → toast "Brouillon enregistré, retrouve-le dans Campagnes."
4. À la fermeture brutale (window close) → `navigator.sendBeacon` envoie le snapshot final.

### 2.6 — Navigation entre étapes

| Action | Comportement |
|---|---|
| Bouton **Suivant** | Valide l'étape courante (Zod), si OK : `saveCampaignDraft` + transition next |
| Bouton **Précédent** | Pas de validation, garde l'état, transition prev |
| Click sur step terminé (stepper) | Saut direct si step ≤ currentStep, sinon disabled |
| Raccourci `Ctrl/Cmd + ➡` | Suivant |
| Raccourci `Ctrl/Cmd + ⬅` | Précédent |
| Raccourci `Ctrl/Cmd + S` | Force save draft (toast confirme) |
| Raccourci `Esc` | "Quitter & garder ?" modal |
| Refresh page | Lit `draftId` depuis URL → SSR pré-rempli depuis DB |
| Bouton navigateur ⬅ | Standard ; prompt si dirty |

### 2.7 — Transitions visuelles

- Step content : `translateX(20px)` → `0` + `opacity 0 → 1`, durée 300 ms, easing `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Progress bar : segments se remplissent en 400 ms.
- `prefers-reduced-motion: reduce` → transitions instantanées.

## §3 — Étape 1 — Type de campagne

### 3.1 — Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ Étape 1 — Type de campagne                                           │
│                                                                       │
│ Quel type de campagne souhaites-tu créer ?                            │
│                                                                       │
│ ┌──────────────────────────────┐  ┌──────────────────────────────┐  │
│ │ ◉ Campagne classique         │  │ ○ Test A/B                   │  │
│ │                              │  │                              │  │
│ │ Un seul email envoyé à toute │  │ Compare 2 variantes (sujet   │  │
│ │ l'audience.                  │  │ ou contenu) sur un échantillon│  │
│ │                              │  │ pour choisir la meilleure.   │  │
│ │ • Le plus courant            │  │ • Recommandé > 2 000 contacts│  │
│ │ • Idéal débutant             │  │ • +1 étape supplémentaire    │  │
│ └──────────────────────────────┘  └──────────────────────────────┘  │
│                                                                       │
│ Nom interne *                                                         │
│ [Bienvenue printemps 2026_______________________________]             │
│ ↑ pour t'y retrouver dans la liste — pas visible des destinataires.   │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 — Validations (Zod)

```ts
const StepTypeSchema = z.object({
  type: z.enum(['regular', 'ab_test']),
  name: z.string().min(3, 'Au moins 3 caractères').max(80, 'Maximum 80 caractères'),
});
```

### 3.3 — États

| État | UI |
|---|---|
| idle | Cartes type cliquables, name vide |
| name-typing | Compteur live `12/80`, validation visuelle |
| validating (next) | Bouton "Suivant" → loader 200ms |
| save-error | Toast rose "Impossible d'enregistrer le brouillon. Réessayer." |

### 3.4 — Edge cases

- Si l'utilisateur tape un nom déjà existant (active campagne) → warning "Une campagne porte déjà ce nom" (non bloquant, c'est OK de dupliquer).
- A/B test sélectionné : insère une étape `4.5 — Variant B` (cf. §6.5 bis).

### 3.5 — Focus order

1. Card "Classique" (focus visible par défaut)
2. Card "A/B"
3. Input "Nom interne"
4. Bouton "Suivant"

### 3.6 — Tests atomiques

| Test | Outil | Scénario |
|---|---|---|
| `StepType.render` | Jest+RTL | Rendu initial : 2 cards, input name, bouton Suivant disabled |
| `StepType.selectType` | Jest+RTL | Click sur card A/B → state.type = 'ab_test' |
| `StepType.nameValidation` | Jest+RTL | Tape "ab" → error visible ; tape "abc" → no error |
| `StepType.next-disabled-when-invalid` | Jest+RTL | Type sélectionné mais name vide → bouton disabled |
| `StepType.draft-create-on-mount` | MSW | Mount avec pas de draftId → POST /api/admin/emails/campaigns/draft appelé |
| `StepType.draft-resume` | MSW | Mount avec draftId existant → GET pré-remplit le state |
| `StepType.E2E happy` | Playwright | User remplit type + name → click Suivant → arrive sur step 2 |
| `StepType.E2E refresh` | Playwright | User remplit, refresh page, retrouve son state |
| `StepType.E2E exit-keep` | Playwright | User clique "Quitter & garder" → toast → liste campagnes contient le draft |
| `StepType.a11y` | jest-axe | 0 violation a11y |
| `StepType.keyboard` | Playwright | Tab atteint dans l'ordre les 4 éléments, Enter sur card sélectionne |

## §4 — Étape 2 — Audience

### 4.1 — Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ Étape 2 — Audience                                                   │
│                                                                       │
│ À qui envoyer cette campagne ?                                        │
│                                                                       │
│ Listes ciblées                                                        │
│ Recherche : [_______________]                                         │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ ☑ Newsletter            3 247 contacts                            │ │
│ │   ⓘ Public, double opt-in. Croissance +124 (7 j).                 │ │
│ │ ☐ Clientes premium      412 contacts                              │ │
│ │ ☐ Esthéticiennes pro    89 contacts                               │ │
│ │ ☐ Promo printemps       1 240 contacts                            │ │
│ │ ⊕ + Créer une nouvelle liste                                       │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│ Options avancées                                                      │
│ ☑ Exclure les contacts désabonnés / bouncés / dans la suppression     │
│ ☐ Ré-envoyer aux destinataires d'une campagne précédente (re-engage)  │
│                                                                       │
│ ┌─── Estimation envoi ──────────────────────────────────────────────┐ │
│ │ Listes sélectionnées : 1                                         │ │
│ │ Total contacts (avant dédup) : 3 247                             │ │
│ │ Doublons retirés : —                                              │ │
│ │ Suppression list exclue : 12                                     │ │
│ │ ──                                                                │ │
│ │ Envois estimés : 3 235                                            │ │
│ └───────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 — Validations

```ts
const StepAudienceSchema = z.object({
  audienceLinkIds: z.array(z.string()).min(1, 'Sélectionne au moins une liste'),
  excludeSuppressed: z.boolean(),
});
```

### 4.3 — Comportements

- Recherche sur le nom de la liste (filtre live).
- Pour chaque liste : ⓘ tooltip donne type, opt-in mode, growth 7j.
- Bouton "+ Créer nouvelle liste" → modal léger (nom + type + opt-in mode) → API Listmonk → ajoute à la liste.
- Estimation **recalculée en live** via `POST /api/admin/emails/audience/estimate` debounced 400 ms après dernière interaction.
- **Si 0 estimé** : warning rouge "Aucun destinataire après exclusion. Vérifie tes filtres."

### 4.4 — Edge cases

- Listmonk indisponible → fallback "Impossible de charger les listes. [Réessayer] ou [Continuer sans actualiser]." (state cached).
- Estimation > 10 000 contacts → warning amber "Envoi important, prévois 2-5 min."
- Liste ayant 0 contact → grisée avec hint "Liste vide".

### 4.5 — Tests atomiques

| Test | Outil | Scénario |
|---|---|---|
| `AudienceSelector.render` | Jest+RTL | Listes affichées, search input |
| `AudienceSelector.search-filter` | Jest+RTL | Tape "premium" → seule "Clientes premium" visible |
| `AudienceSelector.multi-select` | Jest+RTL | Click 2 listes → state.audienceLinkIds.length === 2 |
| `AudienceSelector.estimate-update` | MSW | Sélection liste → POST /estimate appelé → affichage 3 235 |
| `AudienceSelector.estimate-debounced` | Jest+RTL fake timers | 3 toggles rapides → 1 seul call après 400 ms |
| `AudienceSelector.create-new-list` | MSW | Modal → submit → POST Listmonk → liste apparaît + sélectionnée |
| `AudienceSelector.listmonk-down` | MSW | GET /lists → 500 → message d'erreur + retry button |
| `AudienceSelector.empty-result-warning` | MSW | estimate = 0 → warning visible |
| `StepAudience.E2E happy` | Playwright | Sélection 1 liste → Suivant → step 3 |
| `StepAudience.E2E listmonk-down` | Playwright (avec MSW intercept) | Listmonk 500 → user voit erreur, peut retry |
| `AudienceSelector.a11y` | jest-axe | 0 violation |

## §5 — Étape 3 — Template

### 5.1 — Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ Étape 3 — Template                                                   │
│                                                                       │
│ Choisis un design pour ton email.                                     │
│                                                                       │
│ Catégorie : [Tous] [Broadcast ●] [Saisonniers] [Promo]                │
│ Recherche : [_______________]                                         │
│                                                                       │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│ │ [thumbnail]  │ │ [thumbnail]  │ │ [thumbnail]  │ │ [thumbnail]  │  │
│ │ Newsletter   │ │ Bienvenue    │ │ Promo classic│ │ Annonce      │  │
│ │ basique v2   │ │ printemps    │ │ -20%         │ │ produit      │  │
│ │ 1 240 envois │ │ 0 envoi      │ │ 412 envois   │ │ 89 envois    │  │
│ │ ⓘ           │ │ ⓘ           │ │ ⓘ           │ │ ⓘ           │  │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │
│                                                                       │
│ Sélectionné : Bienvenue printemps                                     │
│ ┌─── Aperçu rapide ────────────────────────────────────────────────┐ │
│ │ [Iframe preview desktop, variables avec sample values]          │ │
│ │                                                                   │ │
│ │ Variables : {{first_name}} {{product_url}} {{cta_label}}         │ │
│ │ Tu pourras les personnaliser à l'étape suivante.                 │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│ Ou bien :                                                             │
│ [Ouvrir l'éditeur Listmonk pour template HTML libre ↗]                │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.2 — Validations

```ts
const StepTemplateSchema = z.object({
  templateSlug: z.string().min(1, 'Sélectionne un template'),
});
```

### 5.3 — Comportements

- Liste templates depuis `email_template_meta WHERE category IN ('broadcast', 'automation') AND active = true`.
- Click sur card → sélection visuelle (border brand-sauge, checkmark) + preview update.
- Lien "Ouvrir l'éditeur Listmonk" → ouvre `/admin/emails/listmonk/admin/templates/new` dans nouveau tab. Au retour, refresh list.
- Si templateSlug n'existe plus (supprimé entre temps) → toast + sélection reset.

### 5.4 — Edge cases

- Pas de templates dispo → empty state "Aucun template broadcast. [Créer un template ↗]"
- Template marqué `active=false` → grisé, tooltip "Désactivé, ne peut être utilisé"

### 5.5 — Tests atomiques

| Test | Outil | Scénario |
|---|---|---|
| `StepTemplate.render` | Jest+RTL | Cards affichées, catégories cliquables |
| `StepTemplate.category-filter` | Jest+RTL | Click "Promo" → seuls templates Promo |
| `StepTemplate.select-card` | Jest+RTL | Click card → state.templateSlug set + preview iframe src updated |
| `StepTemplate.preview-render` | MSW | GET /api/admin/emails/templates/:slug/preview → HTML reçu → iframe srcdoc |
| `StepTemplate.no-templates` | MSW | GET /templates → [] → empty state + CTA |
| `StepTemplate.E2E happy` | Playwright | Sélection card → preview visible → Suivant → step 4 |
| `StepTemplate.a11y` | jest-axe | 0 violation, iframe a title |

## §6 — Étape 4 — Compose

### 6.1 — Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ Étape 4 — Compose                                                    │
│                                                                       │
│ Personnalise le contenu.                                              │
│                                                                       │
│ ┌─── Sujet (objet du mail) ──────────────────────────────────────┐ │
│ │ [✨ Découvre tes rituels printemps_____________________]  47/78 │ │
│ │ Variables disponibles : [+ {{first_name}}]                      │ │
│ │ ⓘ 30-50 caractères idéaux. Évite > 2 emojis (anti-spam).        │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌─── Preheader (texte d'aperçu) ─────────────────────────────────┐ │
│ │ [Une sélection douce pour cette saison_______________]  39/100  │ │
│ │ ⓘ Visible juste après le sujet dans la boîte de réception.      │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│ ┌─── Variables du template ──────────────────────────────────────┐ │
│ │ {{first_name}}      Texte    [____________________]  💡 dynam.  │ │
│ │ {{product_url}}     URL      [https://femiglow-maroc.com/p/...] │ │
│ │ {{cta_label}}       Texte    [Découvrir]                        │ │
│ │ {{discount_code}}   Texte    [PRINTEMPS20]                      │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ⓘ "💡 dynam." : variable substituée pour chaque destinataire.       │
│                                                                       │
│ ┌─── Aperçu boîte de réception ──────────────────────────────────┐ │
│ │ FemiGlow                                       il y a 1 min      │ │
│ │ ✨ Découvre tes rituels printemps                                 │ │
│ │ Une sélection douce pour cette saison — Bonjour Souheila, dé…    │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│ ┌─── Aperçu complet ─────────────────────────────────────────────┐ │
│ │ [Desktop] [Mobile]   [Envoyer test à : me@…__] [Envoyer test]  │ │
│ │ ┌──────────────────────────────────────────────────────────┐   │ │
│ │ │ [iframe full preview, variables résolues sample]         │   │ │
│ │ └──────────────────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.2 — Validations

```ts
const StepComposeSchema = z.object({
  subject: z.string().min(3, 'Trop court').max(140, 'Trop long'),
  preheader: z.string().max(200).optional().default(''),
  payload: z.record(z.unknown()).refine((p, ctx) => {
    // toutes les variables required du template doivent être présentes
    const meta = ctx.path; // accès au templateMeta via closure
    for (const v of meta.variables.filter(v => v.required)) {
      if (!p[v.name] || (typeof p[v.name] === 'string' && p[v.name].trim() === '')) {
        ctx.addIssue({ code: 'custom', path: [v.name], message: 'Variable requise' });
      }
    }
    return true;
  }),
});
```

### 6.3 — Comportements

- Variables détectées via `meta.variables` du template sélectionné en step 3.
- Type variable :
  - `text` → input
  - `url` → input type="url" avec validation
  - `image-url` → input + bouton "Upload" (redirige Listmonk media manager iframe) → URL retournée
  - `dynamic` (ex. `first_name`) → input désactivé, badge "Substitué par destinataire", optionnel : fallback value (`Bonjour Souheila` si first_name vide)
- Preview rebuild **automatiquement** debounced 600 ms après dernière interaction.
- "Envoyer test" :
  - `POST /api/admin/emails/campaigns/:draftId/test-send`
  - Envoi via Stalwart immédiat (utilise sendTransactional avec idempotency `test-send:${draftId}:${timestamp}`)
  - Toast "Envoyé à me@… (peut prendre quelques secondes)."
- Compteur emojis : detect via regex `/\p{Emoji_Presentation}/gu` → si > 2 → warning amber.
- A/B variant : si type === 'ab_test', un toggle "Variante B" duplique cette zone pour subjectB + payloadB.

### 6.4 — Edge cases

- Variable required mais payload vide → impossible d'aller à step 5 (button disabled + scroll to first error).
- Test send Stalwart KO → toast rouge "Test impossible : SMTP unreachable. [Voir réglages]".
- Test send vers une adresse dans suppression list → toast amber "Adresse dans suppression list, test refusé."
- Subject vide après debounce → preview affiche "(sujet vide)" en gris.

### 6.5 — Tests atomiques

| Test | Outil | Scénario |
|---|---|---|
| `StepCompose.render` | Jest+RTL | Champs subject/preheader, variables list, preview iframe |
| `SubjectComposer.counter` | Jest+RTL | Tape 50 chars → compteur `50/78`, classe `ok` |
| `SubjectComposer.emoji-warning` | Jest+RTL | Tape "✨🌸🎀 hello" → warning visible |
| `SubjectComposer.insert-variable` | Jest+RTL | Click "+ {{first_name}}" → texte injecté à la position du curseur |
| `Variables.required-error` | Jest+RTL | Vide une variable required → error visible + button next disabled |
| `Preview.live-update` | Jest+RTL fake timers | Change subject → après 600ms, iframe srcdoc updated |
| `Preview.MSW-render` | MSW | POST /preview avec payload → HTML rendered |
| `TestSend.success` | MSW | Click "Envoyer test" → POST 200 → toast success |
| `TestSend.suppression-block` | MSW | adresse dans suppression → API 422 → toast amber |
| `StepCompose.E2E happy` | Playwright | Remplit subject + vars → preview visible → Suivant |
| `StepCompose.E2E test-send` | Playwright | Test send fonctionne (mock Stalwart) |
| `StepCompose.a11y` | jest-axe | 0 violation |

### 6.5 bis — A/B Variant (étape 4.5 conditionnelle)

Si `type === 'ab_test'`, on insère après l'étape 4 une **étape 4.5** dédiée à la variante B :
- Champ "Sujet B" + "Payload B" (uniquement les variables qui diffèrent).
- Choix du split : `50/50` (défaut) ou `90/10` (canary).
- Choix du critère de victoire : `open_rate` (défaut) ou `click_rate`.
- Durée du test avant promotion automatique du winner : 24h / 48h / 7j / manuel.

Tests : variantes Jest pour le toggle, MSW pour POST `/campaigns/:id/ab-test`.

## §7 — Étape 5 — Schedule

### 7.1 — Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ Étape 5 — Planification                                              │
│                                                                       │
│ Quand envoyer la campagne ?                                           │
│                                                                       │
│ ┌──────────────────────────────┐  ┌──────────────────────────────┐  │
│ │ ◉ Envoyer maintenant         │  │ ○ Planifier                  │  │
│ │ Envoi déclenché à la         │  │ Choisis date + heure +       │  │
│ │ validation finale.           │  │ fuseau.                       │  │
│ └──────────────────────────────┘  └──────────────────────────────┘  │
│                                                                       │
│ [si "Planifier" sélectionné :]                                       │
│ Date : [📅 14/05/2026]  Heure : [⏰ 09:00]                            │
│ Fuseau : [Africa/Casablanca ▾] (par défaut)                          │
│                                                                       │
│ ┌─── Récap ────────────────────────────────────────────────────┐    │
│ │ Programmé pour : jeudi 14 mai 2026 à 09:00 (Africa/Casablanca)│    │
│ │ Soit dans : 17 h 32 min                                       │    │
│ │ Estimation envoi total : 3 235 emails                         │    │
│ │ Durée estimée : ~2 min (Stalwart 30 msg/s observé)            │    │
│ └───────────────────────────────────────────────────────────────┘    │
│                                                                       │
│ ⚠ Vendredi/dimanche soir → ouvertures historiquement +faibles.        │
│   Suggéré : mardi / mercredi 9 h-11 h.                               │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.2 — Validations

```ts
const StepScheduleSchema = z.object({
  scheduleMode: z.enum(['now', 'scheduled']),
  scheduledFor: z.date().nullable(),
  timezone: z.string(),
}).refine((d) => d.scheduleMode === 'now' || (d.scheduledFor && d.scheduledFor > new Date()), {
  message: 'La date planifiée doit être dans le futur',
});
```

### 7.3 — Comportements

- Date picker custom (déjà utilisé dans admin), heure en `select` step 15 min.
- Fuseau par défaut : settings admin (`Africa/Casablanca`).
- "Suggested time" — heuristique sur `mv_email_template_perf` + jour de la semaine.
- Durée estimée : `recipients / 30 msg/s` (capacité Stalwart observée).
- Warning si scheduledFor < now + 5 min : "Planification trop proche, envoie plutôt maintenant ?"

### 7.4 — Edge cases

- Planif à 23h59 → confirmation "Confirmer envoi nocturne ?" (UX préventif).
- Conflit fuseau : si l'admin a changé son TZ navigateur, on affiche " (votre heure locale : 10:00)" en plus.
- Si > 50 campagnes scheduled → warning "File très chargée, certaines pourraient se chevaucher."

### 7.5 — Tests atomiques

| Test | Outil | Scénario |
|---|---|---|
| `StepSchedule.toggle` | Jest+RTL | Click "Planifier" → date picker visible |
| `StepSchedule.future-validation` | Jest+RTL | Date passée → error visible, button disabled |
| `StepSchedule.timezone-default` | Jest+RTL | Mount → tz "Africa/Casablanca" prérempli |
| `StepSchedule.duration-estimate` | Jest+RTL | recipients = 3000 → "~2 min" |
| `StepSchedule.suggested-time` | MSW | GET /suggestions → ouvre slot 09:00 mardi |
| `StepSchedule.E2E happy` | Playwright | Choisi planif demain 09:00 → step 6 |
| `StepSchedule.a11y` | jest-axe | 0 violation |

## §8 — Étape 6 — Review & Send

### 8.1 — Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ Étape 6 — Vérification finale                                        │
│                                                                       │
│ Récap                                                                 │
│ ┌────────────────────────────────────────────────────────────────┐  │
│ │ Type            : Campagne classique                            │  │
│ │ Nom interne     : Bienvenue printemps 2026                       │  │
│ │ Audience        : Newsletter (3 247 contacts)                    │  │
│ │ Suppression     : 12 exclus                                       │  │
│ │ Envois estimés  : 3 235                                           │  │
│ │ Template        : Bienvenue printemps v1                          │  │
│ │ Sujet           : ✨ Découvre tes rituels printemps                │  │
│ │ Preheader       : Une sélection douce pour cette saison           │  │
│ │ Variables       : 3 dynamiques + 2 fixes                          │  │
│ │ Planification   : jeudi 14 mai 2026, 09:00 (Africa/Casablanca)    │  │
│ └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│ ✅ Conformité                                                          │
│  • SPF / DKIM / DMARC alignés                                         │
│  • List-Unsubscribe one-click injecté                                 │
│  • Mention "se désinscrire" présente dans le footer                   │
│  • Audience double opt-in confirmée                                    │
│                                                                       │
│ Aperçu final                                                          │
│ [Desktop] [Mobile]                                                    │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ [Full preview iframe sandboxed]                                  │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│ ☐ Je confirme que j'ai relu le contenu et que l'envoi est légitime.   │
│                                                                       │
│ [⬅ Étape précédente]                          [📨 Planifier l'envoi]  │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.2 — Validations

```ts
const StepReviewSchema = z.object({
  acknowledged: z.boolean().refine(v => v === true, { message: 'Confirme avant d\'envoyer.' }),
});
```

### 8.3 — Comportements

- Récap **read-only**. Pour modifier, click sur ligne → retour au step concerné.
- Boutons "Modifier" inline sur chaque ligne du récap.
- Section conformité affiche les checks réels :
  - SPF/DKIM/DMARC : ping API Stalwart settings.
  - List-Unsubscribe : vérifie que les headers sont bien ajoutés au moment de l'envoi.
  - Double opt-in : check Listmonk list `optin_mode === 'double'`.
- Si une vérif échoue → affichage rouge + impossibilité de submit (button disabled + tooltip explicatif).
- Click "Planifier l'envoi" :
  - Validation finale globale (Zod sur toutes les étapes).
  - `POST /api/admin/emails/campaigns/:draftId/finalize` :
    - sync template Listmonk si pas déjà fait.
    - Crée la campagne côté Listmonk via API.
    - Schedule ou trigger send_now.
    - UPDATE `email_campaign_link.status = 'scheduled' | 'sending'`.
    - logAuditEvent.
  - Redirect vers `/admin/emails/campaigns/[id]` avec toast "Campagne planifiée pour le 14/05 09:00."
- Si planif "now" → barre de progression d'envoi temps réel via SSE.

### 8.4 — Edge cases

- Listmonk down au moment de finalize → toast rouge "Service emailing indisponible. Brouillon conservé, réessayer plus tard." (campagne reste en `draft`).
- Click double sur Submit → idempotency via `idempotency_key` dans la mutation → 2e call répond OK sans double-création.
- Conflit : un autre admin a modifié la campagne entre-temps → diff visible "Modifications détectées, recharger ?"

### 8.5 — Tests atomiques

| Test | Outil | Scénario |
|---|---|---|
| `StepReview.render` | Jest+RTL | Récap complet, checkbox ack, button disabled |
| `StepReview.checkbox-enables-button` | Jest+RTL | Click ack → button enabled |
| `StepReview.modify-inline` | Jest+RTL | Click "Modifier" sur ligne audience → navigate step 2 |
| `StepReview.conformity-check` | MSW | GET /conformity → all green → section verte |
| `StepReview.conformity-fail` | MSW | DKIM fail → section rouge + button disabled |
| `StepReview.finalize-success` | MSW | POST /finalize → 200 → redirect + toast |
| `StepReview.finalize-listmonk-down` | MSW | POST /finalize → 503 → toast rouge, draft preserved |
| `StepReview.finalize-double-click` | MSW | Submit × 2 rapidement → 1 seul POST avec idempotency |
| `StepReview.E2E happy` | Playwright | Tout le flow 1→6 → submit → arrive sur campaign detail |
| `StepReview.E2E modify-revert` | Playwright | Modifier audience step 2 → revenir step 6 → récap mis à jour |
| `StepReview.a11y` | jest-axe | 0 violation, checkbox associée à label |

## §9 — Hooks détaillés

### 9.1 — `useCampaignWizard`

```ts
export function useCampaignWizard(initial?: WizardState) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get('draftId');
  const stepFromUrl = Number(searchParams.get('step') ?? '1') as 1|2|3|4|5|6;

  const [state, dispatch] = useReducer(reducer, initial ?? initialState);
  const debouncedSave = useDebouncedCallback(save, 800);

  // Auto-save on changes
  useEffect(() => {
    if (state.isDirty) debouncedSave(state);
  }, [state.draftId, state.subject, state.preheader, JSON.stringify(state.payload), …]);

  // beforeunload
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (state.isDirty && !state.isSaving) {
        e.preventDefault();
        e.returnValue = '';
        navigator.sendBeacon(`/api/admin/emails/campaigns/${state.draftId}/draft`, JSON.stringify(state));
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    'Mod+s': () => save(state),
    'Mod+ArrowRight': () => goNext(),
    'Mod+ArrowLeft': () => goPrev(),
    'Escape': () => promptExit(),
  });

  return {
    state,
    actions: { setType, setAudiences, setTemplate, setSubject, …, goNext, goPrev },
  };
}
```

### 9.2 — Reducer

Actions :
- `INIT_FROM_DRAFT(state)` — depuis SSR
- `SET_TYPE(type, name)`
- `SET_AUDIENCES(ids, excludeSuppressed)`
- `SET_ESTIMATE(count)` — provient d'un fetch async
- `SET_TEMPLATE(slug, version)`
- `SET_SUBJECT(s)`
- `SET_PREHEADER(p)`
- `SET_VARIABLE(name, value)`
- `SET_SCHEDULE(mode, date, tz)`
- `SET_ACK(bool)`
- `GO_STEP(n)`
- `SAVE_STARTED`
- `SAVE_OK(savedAt)`
- `SAVE_ERROR(err)`

## §10 — Server actions

`apps/web/src/lib/admin/emails/wizard-actions.ts` :

```ts
'use server';
export async function createCampaignDraft(input: { type: 'regular' | 'ab_test'; name: string }) { /* INSERT email_campaign_link status=draft */ }
export async function saveCampaignDraft(draftId: string, patch: Partial<WizardState>) { /* UPDATE */ }
export async function estimateAudience(audienceLinkIds: string[], excludeSuppressed: boolean): Promise<{ count: number; suppressed: number }> { /* Listmonk + suppression */ }
export async function testSendCampaign(draftId: string, recipient: string): Promise<{ ok: true; sentAt: string } | { ok: false; reason: string }> { /* sendTransactional */ }
export async function checkConformity(draftId: string): Promise<ConformityReport> { /* checks DKIM/SPF/optin */ }
export async function finalizeCampaign(draftId: string, idempotencyKey: string): Promise<{ campaignId: string }> { /* sync Listmonk + schedule */ }
export async function discardCampaignDraft(draftId: string): Promise<void> { /* UPDATE status=cancelled */ }
```

## §11 — Accessibilité — checklist complète

| Élément | Exigence | Implémentation |
|---|---|---|
| Progress bar | role="progressbar", aria-valuemin/max/now | Composant `WizardProgress` |
| Step titles | `<h2>` par étape | Hiérarchie respectée |
| Cards type/audience/template | role="radio" ou checkbox selon multi/mono | aria-checked, aria-labelledby |
| Inputs | label associé, aria-describedby pour aide/erreur | tous |
| Errors | aria-live="polite", aria-invalid="true" sur input | toast + inline |
| Buttons | aria-label si icon-only | Tous |
| Navigation clavier | Tab + Enter + Esc + flèches dans le stepper | Test Playwright dédié |
| Skip-link | "Aller au contenu de l'étape" au top | présent |
| Focus management | À chaque step transition, focus sur premier élément interactif | implementé via `useEffect` |
| Color contrast | AA partout, AAA pour les CTA primary | vérifié |
| Reduced motion | Transitions désactivées | media query |

## §12 — Performance

- Le wizard est **dynamiquement importé** (`dynamic(() => import('./CampaignWizard'), { ssr: false })`). Bundle ~40 KB gz.
- Preview iframe `srcdoc` (pas d'URL externe, pas de réseau).
- Estimation audience debounced 400 ms.
- Variable rendering / preview rebuild debounced 600 ms.
- Auto-save debounced 800 ms.
- Test send : un seul en cours à la fois (button disabled pendant).

## §13 — Telemetry & analytics

Events tracking instrumentés (via `tracking_events_log` admin) :

| Event | When | Payload |
|---|---|---|
| `wizard_started` | Mount step 1 | `{ draftId, source: 'campaigns_list' | 'direct' }` |
| `wizard_step_completed` | Click "Suivant" valid | `{ draftId, step }` |
| `wizard_step_back` | Click "Précédent" | `{ draftId, fromStep, toStep }` |
| `wizard_save_draft` | Auto-save success | `{ draftId, step }` |
| `wizard_exit_keep` | Click "Quitter & garder" | `{ draftId, lastStep }` |
| `wizard_finalize` | Submit step 6 | `{ draftId, audienceSize, mode: 'now' | 'scheduled' }` |
| `wizard_error` | Toute erreur visible | `{ draftId, step, code, message }` |

Permet de mesurer : taux abandon par step, durée par step, taux d'erreur.

## §14 — Références

- `04-frontend-admin.md` §3.5 — emplacement de la route
- `05-ui-ux-design.md` §3 — primitives utilisées (Card, KpiTile, …)
- `07-templates-system.md` — système de templates + variables
- `08-tests-strategy.md` — patterns Jest/MSW/Playwright complets
- `03-backend-integration.md` §3, §7 — sendTransactional, Listmonk client
- Pattern wizard existant FemiGlow : `apps/web/src/app/(admin)/admin/tracking/` (si présent)
