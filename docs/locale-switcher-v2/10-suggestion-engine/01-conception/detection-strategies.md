# Stratégies de devinette de la langue préférée

> `guessPreferredLocale(strategies)` combine **plusieurs stratégies robustes**, chacune produisant un *vote pondéré* `(locale, weight, confidence)`. La fusion donne `{ guessedLocale, confidence, evidence[] }`. **Aucune** stratégie ne déclenche seule une intrusion : la confiance gouverne, et la décision finale reste un **choix** (INV-20, jamais d'auto-redirect).

## 1. Principe : faisceau d'indices pondéré (pas une règle unique)

On n'utilise **jamais** un seul signal (fragile). On **agrège** des votes et on calcule une **confiance** = force du consensus / contradiction. Plus les stratégies concordent, plus la confiance est haute.

```
guessPreferredLocale(signals, weights):
  votes = []
  for s in strategies: votes.push(s(signals))          # (locale, weight, conf)
  tally = weightedTally(votes)                          # somme pondérée par locale
  best  = argmax(tally)
  confidence = normalize(best.score - secondBest.score) # marge = confiance
  return { guessedLocale: best.locale, confidence, evidence: votes }
```

## 2. Les stratégies (robustes, fiables, pertinentes)

| # | Stratégie | Source | Force | Faiblesse | Poids défaut |
|---|---|---|---|---|---|
| S1 | **Cookie `NEXT_LOCALE`** (choix antérieur explicite) | cookie | très fiable (l'utilisateur a déjà choisi) | absent au 1er passage | **élevé** |
| S2 | **`priorLocale`** (langue de la dernière session) | stockage | fiable | nécessite un retour | élevé |
| S3 | **`Accept-Language`** (avec **q-weights**) | header | bon proxy, standard | parfois mal configuré | moyen |
| S4 | **Langue de la créa / `utm`** (`adLocale`) | utm/referrer | très pertinent sur trafic Meta | seulement si tagué | moyen-élevé |
| S5 | **Comportement in-page** : clic sur contenu d'une autre langue, hover répété sur le switcher | client | signal d'intention fort | rare | moyen (booste la confiance) |
| S6 | **Locale d'accès** (`accessLocale`) vs `Accept-Language` | url + header | détecte le *mismatch* (cœur du besoin) | — | (comparateur, pas vote) |
| S7 | **Script tapé** (si recherche/chat) : détection arabe vs latin | client | confirme AR | dépend d'une saisie | moyen |

> **Exclu volontairement** : **géolocalisation IP** comme signal *dur* (NN/g : « une personne à Tokyo ne lit pas forcément le japonais »). On peut l'utiliser comme *tie-breaker* **faible** et **désactivable**, jamais comme déclencheur (INV-20).

## 3. Calcul de la confiance

- **Consensus** (S1+S3+S4 pointent AR) → confiance **haute**.
- **Contradiction** (cookie FR mais Accept-Language AR) → confiance **basse** → on **ne propose pas** (le choix explicite S1 prime, ou on s'abstient).
- **Source unique faible** (seulement S3) → confiance **moyenne** → ne déclenche que les profils à `minConfidence` bas, et seulement à un breakpoint franc.
- Seuils `minConfidence` **par profil** (config) → l'admin règle l'agressivité.

## 4. Où s'exécute la devinette ?

- **Serveur (RSC)** pour S1/S2/S3/S4/S6 → résultat passé en **prop** → **pas de flash** (cohérent ADR-006). Le prompt n'apparaît jamais « en retard » ou en clignotant.
- **Client** pour S5/S7 (comportement/saisie) → ré-évaluation au fil de la session (met à jour la confiance).

## 5. Confidentialité (INV-20)

- Pas de profilage cross-site, pas d'IP stockée comme préférence.
- Signaux conservés **côté session** (cookies first-party minimaux : `NEXT_LOCALE`, `locale_suggestion_*`).
- Tout est **anonyme** et **éphémère** (sauf le choix explicite mémorisé, comme tout site multilingue).

## 6. Robustesse & fail-safe

- Toute stratégie peut **échouer silencieusement** (header absent, cookie illisible) → elle ne vote pas, sans casser la fusion.
- `guessPreferredLocale` est **pur** et **déterministe** → testable par table (jeux de signaux → locale + confiance attendues), cf. `03-data/.../fixtures` et plan de tests.
- Si **aucune** stratégie ne vote → `confidence = 0` → aucune proposition.

## 7. Éléments à vérifier / tester

- Consensus AR (S1+S3+S4) → `guessed=ar`, confiance haute.
- Contradiction (cookie FR vs Accept-Language AR) → confiance basse / abstention (S1 prime).
- Accept-Language q-weights respectés (`ar;q=0.9,fr;q=0.8` → ar).
- `adLocale` (utm) pèse correctement sur trafic Meta.
- Géoloc IP **n'est jamais** seule déclenchante (désactivée par défaut).
- Signal manquant → pas de vote, pas de crash.
- Pas de flash : la devinette serveur arrive en prop au 1er render.
