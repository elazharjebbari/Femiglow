# Boucle test → correction → re-vérification

> La batterie de tests est **dense** (couverture des angles, pas le compte). Cette boucle garantit qu'on **converge vers le vert** sans régresser. Elle s'applique dès qu'une porte (locale ou non-régression) est **rouge**.

## 1. Diagramme de la boucle

```
        ┌──────────────────────────┐
        │  Lancer la batterie ciblée│
        └────────────┬─────────────┘
                     │
              ┌──────▼──────┐   tout vert
              │  Résultat ? ├───────────────► SORTIE (lot Done)
              └──────┬──────┘
                rouge│
        ┌────────────▼─────────────┐
        │ 1. Trier les échecs       │  (régression vs nouveau vs flaky)
        │ 2. Cause racine (1 à la fois)
        │ 3. Corriger le CODE        │  (jamais affaiblir le test pour le faire passer)
        │ 4. Relancer SEULEMENT le sous-ensemble
        └────────────┬─────────────┘
                     │ vert local
        ┌────────────▼─────────────┐
        │ Relancer la batterie ciblée│  (re-vérif globale)
        └────────────┬─────────────┘
                     └────────► (retour au losange « Résultat ? »)
```

## 2. Règles de la boucle

1. **Une cause racine à la fois.** Ne pas empiler les correctifs.
2. **Ne jamais affaiblir un test** pour le rendre vert (pas de `skip`, pas d'assertion molle). Si un test est *faux*, le corriger explicitement avec justification (commit message).
3. **Régression d'abord.** Un échec sur la garde-fou (wizard, scanner i18n, build) est **bloquant prioritaire**.
4. **Flaky = bug.** Un test instable est traité comme un échec (attente déterministe, pas de `sleep` arbitraire). Pour le réseau : MSW. Pour l'async UI : `findBy*` / `waitFor`.
5. **Re-vérif globale.** Après correction, relancer **toute** la cible du lot (pas seulement le test corrigé) pour éviter les effets de bord.
6. **Garde non-régression** à chaque sortie de boucle : `typecheck`, `lint`, scanners i18n = 0.

## 3. Tri des échecs

| Type | Signe | Action |
|---|---|---|
| **Régression** | un test *qui passait* échoue | corriger en priorité, c'est un effet de bord |
| **Nouveau (attendu)** | nouveau test rouge car feature pas finie | implémenter la feature |
| **Contrat** | échec sur payload/nom/INV | réaligner sur `CONTRACT.md` (le contrat fait foi) |
| **Flaky** | passe/échoue sans changement | rendre déterministe (MSW, waitFor) |
| **Faux test** | l'assertion est incorrecte | corriger le test + justifier |

## 4. Commandes de la boucle (exemples)

```bash
# Cible d'un lot (rapide)
pnpm vitest run use-locale-transition
# Un seul test en watch pendant la correction
pnpm vitest watch -t "veil fallback"
# E2E ciblé
pnpm playwright test --grep "@locale-switcher RTL"
# Garde non-régression
pnpm typecheck && pnpm lint
node scripts/i18n-scan-fr.mjs && node scripts/i18n-scan-latin-ar.mjs
```

## 5. Journal de boucle (à tenir par lot)

| Itération | Tests rouges | Cause racine | Correctif | Re-vérif | État |
|---|---|---|---|---|---|
| 1 | … | … | … | … | rouge/vert |
| 2 | … | … | … | … | vert |

➡️ Sortie de boucle uniquement quand : **cible verte** ET **garde verte** ET **journal renseigné**.

## 6. Critère anti-« vert trompeur »

Pour chaque invariant, vérifier qu'il existe **au moins un test négatif** : on casse volontairement l'invariant en local → le test **doit** échouer. Si aucun test ne bronche, l'invariant n'est **pas** couvert (ajouter le test). C'est ce qui distingue une couverture *robuste* d'un compteur de tests.
