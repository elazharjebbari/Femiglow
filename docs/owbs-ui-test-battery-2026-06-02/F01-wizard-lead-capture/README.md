# F01 — Wizard : capture lead optimiste (étape `lead_capture`)

**Surface :** `LeadCaptureStep` (`data-testid="wizard-step-lead"`), `useLeadCaptureMutation`,
`wizard-store`, `lead-sync-queue`. **Public :** acheteuse. **Endpoints :** `POST /api/checkout/lead` (fetch de fond).

## 1. Fonctionnement optimal (ce qui doit se passer)

1. L'acheteuse arrive sur l'étape lead (depuis `wizard-step-cart` via le bouton « commander », ou directement selon la config `steps`).
2. Elle saisit **prénom** (`name="firstName"`, ≥ 2), **téléphone** (`name="phone"`, masqué, ≥ 6 chiffres), coche **consentement** (`name="consent"`). Un **honeypot** `website` reste vide.
3. La validation est **onChange** (`react-hook-form mode:'onChange'`) : le bouton `wizard-lead-submit` se **déverrouille** dès que `isValid`.
4. Au clic submit, **flag ON** : `leadId` est généré **client** (`cl_…`), `setLeadId` + `goToStep('address')` **immédiatement** (l'UI affiche `wizard-step-address` en < ~1 s), la création part en **tâche de fond** (file). **flag OFF** : `await wizardClient.createLead()` puis `goToStep` (legacy).
5. Le tracking `lead_capture` (Enhanced Conversions / Advanced Matching) est émis avec le `leadId`.

## 2. Points à vérifier (tous angles)

### UI / UX / Design
- L'étape suivante apparaît **sans gel** perceptible (pas de spinner bloquant en optimiste).
- États visibles : champ invalide (aria-invalid + message), bouton disabled→enabled, état `submitting` (legacy) / transition immédiate (optimiste).
- Le masque téléphone **n'empêche pas** la saisie latine en AR (séquence latine forcée).
- Pas de double-soumission au double-tap (idempotence + état submit).

### Frontend (comportement)
- `goToStep('address')` **avant** toute résolution réseau (optimiste).
- En optimiste, `wizardClient.createLead` **n'est pas** appelé (c'est la file).
- Le `leadId` posé dans le store == celui de l'envelope enfilée.

### Backend (contrat)
- L'envelope envoyée : `endpoint='/api/checkout/lead'`, `method='POST'`, header `Idempotency-Key`, payload = `createLeadInputSchema` **avec** `leadId`.
- Rejeu (même Idempotency-Key) ⇒ pas de doublon (upsert).

### Data
- Après sync, une row `chat_lead` existe avec `lead_captured_at`, `last_touched_step='lead'`, le phone normalisé E.164.

### Sécurité
- Honeypot `website` non vide ⇒ submit **bloqué** (schema `z.string().max(0)`).
- `leadId` client mal formé ⇒ rejet serveur (regex `^cl_[0-9a-z]{20,}$`).

### a11y / i18n
- Champs labellisés, erreurs annoncées (`aria-invalid`, message lié) ; axe 0 violation ; FR/AR/EN ; RTL en AR.

## 3. Diagramme (séquence optimiste)
Voir [`../F01-wizard-lead-capture/flow.puml`](flow.puml) (clic → goToStep immédiat → enqueue en fond).

## 4. Oracle principal
> Sous réseau bridé/coupé sur `/api/checkout/lead`, **`wizard-step-address` devient visible < 1,5 s** après le clic, **sans** message d'erreur, et une envelope `lead_create` est en file.

## 5. Plans : [`scenarios.csv`](scenarios.csv) · [`test-plan.md`](test-plan.md) · [`business-scenarios.md`](business-scenarios.md)
