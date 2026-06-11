# ADR-0001 — Avancement optimiste de l'UI (découplage transition / réseau)

- **Statut :** Accepté
- **Date :** 2026-06-01
- **Décideurs :** équipe FemiGlow
- **Réf exigences :** FR-02, FR-05, NFR-01

## Contexte

`use-wizard-mutations.ts` appelle `await wizardClient.<mutation>()` **puis**
`goToStep()`. La transition d'étape est donc gatée par le RTT réseau. Le travail
serveur est léger : le coût est le réseau (origine mono-région, sans CDN, mobile).

## Décision

Inverser l'ordre : **`goToStep()` immédiatement** au submit (transition optimiste),
puis **enfiler** la mutation dans `lead-sync-queue` pour envoi en tâche de fond.
La transition d'étape ne dépend plus d'aucune E/S réseau.

Garde-fous :
- La transition optimiste n'est **pas** un état métier irréversible : la
  conversion finale reste serveur-autoritaire (cf. ADR-0002 §conversion).
- Les validations **synchrones locales** (Zod côté client : format téléphone,
  champs requis, consentement) restent bloquantes **avant** l'`enqueue` — on
  n'avance que sur une saisie valide, mais sans réseau.

## Conséquences

- **+** Transition perçue instantanée (NFR-01) indépendamment du réseau.
- **+** Les rows partielles continuent d'être écrites (FR-05) car l'envelope part quand même → scanner d'abandon + funnel préservés.
- **−** Une erreur serveur n'est plus visible « en ligne » à l'instant du clic → nécessite un canal d'erreur différé non-bloquant (FR-11) + idempotence/retry robustes.
- **−** Risque d'« avancer puis échouer » : mitigé par retry file + flush beacon + conversion auto-suffisante.

## Alternatives rejetées

- **Persist différé unique (tout client, écriture finale)** : supprime aussi la latence mais **casse le scanner d'abandon** (pas de rows partielles) et dégrade l'analytics par étape. Rejeté (cf. design §7).
- **Spinner « optimiste » factice** : masque le délai sans le supprimer ; ne résout pas la friction réelle.
