# 90 — Boucle de correction & vérification

> Tout rouge est une **information**. Cette boucle transforme chaque échec en
> garde-fou permanent, sans introduire de régression.

## Cycle (par défaut S1/S2)

```
[1] REPRODUIRE   -> test rouge minimal, déterministe (pas de flaky)
      |
[2] DIAGNOSTIQUER-> couche fautive (UI / state / réseau / serveur / data)
      |              POV opérateur : "qu'aurait vu/subi l'utilisateur ?"
[3] CORRIGER     -> fix ciblé (code OWBS) OU fix du test si oracle faux
      |
[4] VÉRIFIER     -> le rouge devient vert ; l'oracle reste perceptible
      |
[5] NON-RÉGRESSION-> suite du module + suite du périmètre vertes
      |
[6] DURCIR       -> garder le test comme garde-fou ; ajouter variantes proches
      |
[7] TRACER       -> defect-log (id, sévérité, cause, fix, tests) + tableau de bord
```

## Règles
- **Un rouge = une cause.** Si un test échoue pour 2 raisons, le scinder.
- **Rouge utile d'abord** : pour un garde-fou de bug, écrire le test qui échoue
  *avant* le fix, et vérifier qu'il échoue **pour la bonne raison**.
- **Pas de fix sans test.** Tout correctif de code embarque/active son test.
- **Anti-flaky** : si un test est instable, le rendre déterministe (réseau/horloge
  contrôlés, `findBy`/`waitFor`/`expect.poll`) **avant** de continuer — un flaky
  est un défaut S2.
- **Triage par sévérité** (cf. quality-gates) : S1 bloque la vague ; S2 avant fin de
  vague ; S3 backlog tracé.

## Classes de bugs attendues (heuristiques de diagnostic)
| Symptôme UI | Cause probable | Où regarder |
|---|---|---|
| Bouton submit jamais actif | validation onChange / honeypot ciblé | F01 (name selectors, isValid) |
| Gel 6 s à la transition | flag non propagé au bundle / legacy | F12 (NEXT_PUBLIC build), F01 |
| Double commande | idempotence / double-tap | F02/F14 (idem-key, order_create) |
| Lead perdu après fermeture | beacon non émis (iOS) | F04 (pagehide+visibility, webkit) |
| Doublon après reload | reprise non idempotente | F09/F14 (hydrate + upsert) |
| Indicateur bloque la nav | modale au lieu de status | F05 (role=status, non bloquant) |
| ROAS faussé | generate_lead/purchase sans value | F07/F14 (tracking en fond) |
| Effet dead invisible | pas d'UI/alerte outbox | F11 (GAP) |
| Lead optimiste absent en admin | projection états | F10 (états dérivés) |

## Defect log (format) — voir [`reporting-and-dashboards.md`](reporting-and-dashboards.md)
`id, module, scenario, severity(S1/S2/S3), symptom_ui, root_cause, fix, tests_added, status`
