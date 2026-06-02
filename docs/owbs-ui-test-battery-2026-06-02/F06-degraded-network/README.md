# F06 — Réseau dégradé / offline / conditions Maroc-mobile

**Surface :** transverse (wizard + file + transport) sous **réseau réel adverse**.
**Public :** acheteuse. **But :** prouver que l'expérience reste **fluide et sans
perte** dans les conditions cibles (3G instable, coupures, latence élevée).

## 1. Fonctionnement optimal
- **Latence élevée** : l'UI avance instantanément (optimiste) ; la sync se fait quand elle peut.
- **Coupure** : l'envelope reste en file ; reprise au rétablissement ou via beacon.
- **5xx transitoire** : retry silencieux (aucun bruit UI).
- **409** : drop propre (déjà appliqué côté serveur).
- En **tout** état, **zéro gel** et **zéro perte**.

## 2. Points à vérifier (tous angles)
### UX sous stress
- Aucune roue bloquante > 1 s sur les transitions optimistes, quel que soit le réseau.
- Aucun message d'erreur **prématuré** sur une simple lenteur.
- L'indicateur dégradé (F05) n'apparaît **que** sur échec **persistant**.
### Réseau
- Retry borné (pas de retry-storm batterie/CPU).
- `keepalive` + beacon couvrent la fermeture.
### Données
- Convergence : à la fin, le lead est persisté exactement une fois.

## 3. Conditions à simuler (matrice)
| Condition | Outil | Effet attendu |
|---|---|---|
| Latence 6 s | `route.fulfill` après delay | UI avance, sync tardive OK |
| Coupure (abort) | `route.abort()` | file conserve, reprise/beacon |
| 503 ×2 puis 201 | MSW `leadFlaky` | retry silencieux, succès |
| 409 | MSW `lead409` | drop sans boucle |
| Offline total (CDP) | `context.setOffline(true)` | file conserve, beacon au close |

## 4. Oracle principal
> Quelle que soit la condition réseau, l'acheteuse atteint l'étape suivante < 1,5 s
> et **aucun lead validé n'est perdu** (convergence à 1 lead).

## 5. Plans : [`scenarios.csv`](scenarios.csv) · [`test-plan.md`](test-plan.md)
