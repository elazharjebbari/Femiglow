# F12 — Flag / rollout / kill-switch / parité legacy

**Surface :** `CHECKOUT_OPTIMISTIC_WIZARD_ENABLED` (serveur) + `NEXT_PUBLIC_…`
(client), toutes les surfaces gated. **Public :** **opérateur** (rollout) + garantie
transverse. **Le plus important pour le déploiement sûr.**

## 1. Fonctionnement optimal
- **Flag OFF (défaut)** : comportement **strictement identique** à l'existant
  (legacy `await` bloquant ; pas de file ; `/sync`→204 ; pas d'enqueue outbox ;
  chat legacy). **Parité bit-à-bit.**
- **Flag ON (client + serveur)** : chemin optimiste complet.
- **Kill-switch** : repasser le flag OFF rétablit le legacy **sans redeploy** (< 1 min).
- **Incohérence** client ON / serveur OFF : garde-fou — `/sync` répond 204, le serveur
  ne fait pas d'upsert optimiste (legacy), pas de casse.

## 2. Points à vérifier (tous angles)
### Parité legacy (anti-régression — priorité absolue)
- Sur **chaque** écran touché (wizard lead/address/thank-you, chat), flag OFF ⇒ comportement actuel intact.
- Aucun nouvel endpoint sollicité flag OFF (pas de `/sync`, pas d'enqueue).
### Cohérence d'activation
- `NEXT_PUBLIC_*` (client, inliné au **build**) ET serveur doivent être ON ensemble.
- Matrice flag (client×serveur) → comportement attendu sans casse.
### Ops
- Procédure de ramp documentée (canary→10%→50%→100%) ; kill-switch testé.

## 3. Matrice flag × comportement
| NEXT_PUBLIC (client) | serveur | Comportement attendu |
|---|---|---|
| false | false/true | Legacy (await). Routes idempotentes mais non sollicitées en optimiste. |
| true | true | Optimiste complet. |
| true | false | **Garde-fou** : `/sync`→204, upsert optimiste ignoré (legacy), aucune casse. |

## 4. Oracle principal
> Flag OFF : un parcours complet est **identique** à l'existant (aucun appel
> `/sync`, succès après réponse). Flag ON : optimiste. Bascule OFF→legacy sans redeploy.

## 5. Plans : [`scenarios.csv`](scenarios.csv) · [`test-plan.md`](test-plan.md)
