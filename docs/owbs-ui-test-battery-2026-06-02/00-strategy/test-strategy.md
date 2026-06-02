# 00 — Stratégie de test (UI / opérateur)

## 1. Intention

Garantir une **qualité minimale très supérieure** d'OWBS en testant **les
interfaces** comme un humain les utilise. On part du **risque d'usage réel**, pas
de la couverture de lignes. On cible explicitement les **zones peu/non testées** :
le comportement perceptible des écrans (acheteuse + admin) sous conditions
adverses, et la **gestion opérationnelle** du nouveau système.

## 2. Ce qui est déjà couvert vs. ce que cette batterie ajoute

| Déjà couvert (dossier ingénierie) | Ajouté ici (UI/opérateur) |
|---|---|
| Logique pure file (FIFO/retry/backoff/miroir) | Ce que **voit/subit** l'acheteuse pendant un retry (spinner ? gel ? indicateur ?) |
| Upsert/outbox/worker (pglite) | Ce que **voit l'opérateur** d'un lead capturé/abandonné/converti et d'un effet `dead` |
| `lead-service` (mocks) | Parcours **métier complets** (saisie→perte réseau→fermeture→reprise→conversion) |
| e2e chromium (2 cas) | Matrices e2e **denses** : timing, beacon, reload, i18n/RTL, a11y, multi-onglet, double-clic |

## 3. Pyramide (orientée UI)

```
        Playwright (parcours réels, build flag-ON) ── « l'expérience marche »
      MSW (réseau réel simulé, réaction UI observée) ── « l'UI réagit bien »
   RTL/Vitest (composant via DOM/rôles/états visibles) ── « l'écran rend bien »
```

- **RTL ≈ 55 %** des cas (rapides, déterministes, focalisés écran).
- **MSW ≈ 25 %** (réseau adverse : latence/5xx/409/offline/désordre).
- **Playwright ≈ 20 %** (parcours métier, timing perçu, beacon, reprise, a11y, i18n).

## 4. Principes non négociables

1. **Observer le DOM, pas l'implémentation.** Sélection par rôle ARIA / libellé / `data-testid`, jamais par classe interne ou état Zustand privé (sauf assertion d'invariant explicite).
2. **Oracle perceptible.** Chaque scénario a un critère **visible** de succès/échec (un libellé, un état, un timing).
3. **Déterminisme.** Horloge et réseau **contrôlés** (faux timers, MSW, `page.route`). Zéro `sleep` arbitraire en attente d'un état (utiliser `findBy`/`waitFor`/`expect.poll`).
4. **Parité legacy d'abord.** Pour chaque écran : un garde-fou « flag OFF ⇒ comportement actuel intact ».
5. **Conditions réelles.** On modélise mobile/Maroc : réseau lent (3G), coupures, bfcache iOS, double-tap, retour arrière, onglet masqué.
6. **Accessibilité = test de 1ʳᵉ classe** (axe, focus, lecteur d'écran), pas un extra.
7. **i18n/RTL systématique** sur les écrans touchés (FR/AR/EN).
8. **Anti-flaky.** Pas d'attente sur le temps réel ; assertions sur l'**état observable**, retries Playwright bornés, fixtures synthétiques (zéro PII réelle).

## 5. Personae & conditions modélisées

| Persona | Contexte | Conditions à exercer |
|---|---|---|
| **Salma** (acheteuse) | iPhone Safari, 3G instable, Rabat | latence, coupure, fermeture onglet, bfcache, AR/RTL |
| **Yassine** (acheteur) | Android Chrome, wifi correct | double-tap submit, retour arrière, reload |
| **Nadia** (opératrice admin) | Desktop Chrome, back-office | filtrer/lire/agir sur leads, superviser outbox/worker, basculer le flag |
| **Bot** | Script | honeypot, flood `/sync` (rate-limit) |

## 6. Définition d'« assez testé » par module

Un module est **vert** quand : (a) tous les scénarios `P0/P1` de sa matrice
passent sur les 3 couches pertinentes ; (b) la **parité legacy** est prouvée ;
(c) **a11y** (axe 0 violation) et **i18n/RTL** sont couverts si l'écran est
concerné ; (d) au moins **2 scénarios métier complets** passent en Playwright.

Détail des portes : [`quality-gates.md`](quality-gates.md). Outils/harness :
[`tooling-and-harness.md`](tooling-and-harness.md). Exécution :
[`../90-execution/`](../90-execution/).
