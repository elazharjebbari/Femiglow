# F09 — Persistance & reprise (resume banner, hydratation, multi-onglet)

**Surface :** `wizard-store` (zustand persist), `ResumeBanner`
(`wizard-resume-banner`, `wizard-resume-dismiss`), `WizardShell` (hydratation),
`lead-sync-singleton` (reprise file). **Public :** acheteuse qui **revient**.

## 1. Fonctionnement optimal
- L'état wizard (leadId, currentStep, drafts) est **persisté** (sessionStorage/persist).
- À la reprise, `WizardShell` ré-hydrate et **recale l'étape** de façon cohérente
  (si `currentStep` n'est pas dans `steps`, retombe sur `steps[0]` ; cohérence leadId↔étape).
- Le **resume banner** propose de reprendre (si pertinent) et est **dismissible**.
- La **file** (`lead-sync-singleton`) ré-hydrate les envelopes non confirmées et reflush (idempotent → 1 lead).
- `syncDegraded` est **éphémère** (non persisté) — un reload ne « fige » pas une alerte.

## 2. Points à vérifier (tous angles)
### UX
- Reprise sans perte de saisie ; banner clair et dismissable ; pas d'étape incohérente affichée.
### Frontend
- Hydratation : `hydrated` passe à true ; pas de flash d'étape erronée ; cohérence leadId↔currentStep.
- `syncDegraded` **non** persisté (absent du `partialize`).
### Data
- Reprise file → **1** lead (pas de doublon) ; idempotence.
### Multi-onglet
- Deux onglets du wizard : pas de corruption d'état (sessionStorage par onglet) ; chacun cohérent.

## 3. Oracle principal
> Après reload en plein parcours, l'acheteuse retrouve son étape et sa saisie,
> la file rejoue sans créer de 2ᵉ lead, et aucune alerte dégradée résiduelle.

## 4. Plans : [`scenarios.csv`](scenarios.csv) · [`test-plan.md`](test-plan.md)
