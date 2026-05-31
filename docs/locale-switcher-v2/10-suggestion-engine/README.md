# Moteur de suggestion linguistique — sous-dossier

> Couche **intelligente, pilotable, auditable** qui décide **s'il faut**, **à qui**, et **quand** proposer une bascule de langue — au **bon moment psychologique**, sans déranger. **Désactivée par défaut pour tout le monde** (INV-13).
>
> Étend `docs/locale-switcher-v2/` (mêmes invariants, mêmes formats). Voir `../CONTRACT.md` §7 (artefacts, events, INV-13→INV-20).

## Pourquoi un « moteur » et pas un simple nudge ?
Le nudge one-shot du plan de base (`LocaleNudge`) répond à *« proposer une fois »*. La demande ici est un **système d'ingénierie** : détecter la langue d'accès, **deviner** la langue préférée par **plusieurs stratégies robustes**, puis ne **proposer qu'aux bons profils, au bon moment**, le tout **entièrement configurable** (créer/éditer des profils de déclenchement **et** d'exclusion), avec **audit**. Le `LocaleNudge` devient une *présentation* gouvernée par ce moteur (ADR-010).

## Arborescence
```
10-suggestion-engine/
├── README.md
├── 00-study/
│   ├── consumer-psychology.md       ← science du timing d'interruption (sources)
│   ├── behavioral-profiles.md       ← taxonomie : signaux, profils trigger / exclusion
│   └── comparative-approaches.md    ← analyses comparatives + PROPOSITION FINALE
├── 01-conception/
│   ├── decisions-adr.md             ← ADR-010…
│   ├── detection-strategies.md      ← devinette de langue (multi-stratégies)
│   ├── architecture.puml            ← signaux → politique → décision → prompt
│   └── eligibility-state-machine.puml
├── 02-config/
│   ├── engine-config-schema.yaml    ← config admin-éditable (profils, poids, caps)
│   ├── profiles-catalog.csv         ← profils par défaut (trigger + never)
│   ├── admin-feature-spec.md        ← UI admin de pilotage + création de profils
│   └── audit-model.md               ← observabilité : « ça se déclenche-t-il bien ? »
├── 03-data/
│   ├── signals-catalog.csv          ← catalogue exhaustif des signaux
│   └── events-telemetry.json        ← events du moteur (CONTRACT §7.3)
├── 04-frontend/
│   └── engine-runtime.md            ← runtime client (collecte, scoring, prompt)
└── 05-tests/
    ├── vitest-plan.csv
    ├── playwright-plan.csv
    ├── msw-handlers.md
    └── coverage-matrix.csv
```

## Principes directeurs
1. **Off par défaut** (INV-13) ; rien ne s'affiche tant qu'un profil n'est pas activé.
2. **Zones calmes inviolables** (INV-14/15) : checkout, formulaire actif, lecture longue → **jamais**.
3. **Moment opportun** (INV-17) : on attend un *breakpoint* de tâche (faible charge mentale), pas le milieu d'un geste.
4. **Borné & respectueux** (INV-16/20) : ≤ 1 proposition / cooldown, dismiss persistant, jamais d'auto-redirect.
5. **Pilotable de bout en bout** (INV-18) : créer/éditer/supprimer profils trigger **et** exclusion, régler poids/seuils/cooldowns.
6. **Auditable** (INV-19) : chaque décision (montrée/supprimée) tracée avec sa raison.

## Intégration au plan global
La proposition finale est intégrée dans `../08-plan-action/plan-action.md` (lots **L9→L12**), `../08-plan-action/backlog.csv`, `../08-plan-action/dependencies.puml`, et pilotée par `../09-runbook/runbook.md` (section moteur + audit). Voir aussi `../09-runbook/delivery-checklist.txt`.
