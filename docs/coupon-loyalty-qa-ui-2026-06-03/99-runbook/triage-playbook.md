# Playbook de triage — quand un test est rouge

Arbre de décision rapide. But : distinguer **bug produit** (→ ticket + decision-log) de
**défaut de test** (→ corriger le test), sans jamais masquer un échec par un `skip`.

```
Test ROUGE
│
├─ L'erreur est-elle un timeout / "command not found" ?
│   ├─ "command not found"  → tu n'es pas dans apps/web. cd apps/web. Relancer.
│   └─ timeout Playwright    → tu attends un sélecteur absent. Vérifier le data-testid réel
│                              (lire la source du composant), ou attendre page.waitForResponse.
│
├─ MSW : "Cannot find … request handler" / unhandled request ?
│   → le composant appelle une URL non mockée. Ajouter le handler à couponsAdminHandlers/redeemHandlers
│     ou élargir le pattern. Vérifier server.use(...) dans le test ET le cycle beforeAll/afterEach/afterAll.
│
├─ react-hook-form : le submit ne fait rien / pas de requête ?
│   → setter programmatique non vu par RHF. Utiliser fireEvent.change / userEvent.type. En e2e: fill().
│
├─ L'oracle attendait X, on obtient Y.
│   ├─ Y est cohérent avec le comportement RÉEL du produit (vérifier la source) ?
│   │   ├─ Le produit est CORRECT, l'oracle était faux → corriger l'oracle + noter (decision-log, ajustement).
│   │   └─ Le produit est INCORRECT → BUG-xx dans decision-log, créer un ticket, garder le test rouge
│   │       documenté (xfail explicite avec lien) jusqu'à correction produit.
│   └─ Y vient d'un setup incomplet (store non semé, session non mockée, now non injecté) → corriger le setup.
│
├─ Flaky (vert/rouge alterné sous --repeat-each) ?
│   → source d'indéterminisme : Date.now()/random, ordre d'async non attendu, MSW non reset,
│     animation/transition. Injecter now, attendre explicitement, vérifier afterEach(resetHandlers).
│
├─ PII : un téléphone apparaît en clair ?
│   → BUG potentiel de masquage. Vérifier maskPhone en sérialisation. Ne jamais "ajuster" l'oracle PII.
│
└─ Charte : %/!/emoji/countdown détecté ?
    → régression de copie. Corriger le composant (pas le test). C'est un garde-fou voulu.
```

## Cas spécifiques connus

- **Stats / Grants admin échec silencieux** : `loadStats`/`loadGrants` ne gèrent pas l'erreur (no-op si
  `!res.ok`). Donc sur 403/500/network : **pas** de `role=alert`, et la table/span ne s'affiche pas.
  Oracle correct = `queryByRole('alert')` nul **et** absence du testid. (D03)
- **Create/Transition échec** : eux affichent `role=alert` avec `HTTP {status}` ; `network` (fetch throw)
  → « Erreur réseau. ».
- **Grant `not_yet_active`** en E2E redemption : ce n'est pas un bug, c'est le délai d'activation.
  Pré-activer (seed) avant F18. (D02)
- **Template post_purchase en pause** : F17 n'émet pas de code. Réactiver via le seed E2E.

## Escalade
Si un échec bloque > 30 min et n'est ni setup ni oracle : consigner BUG-xx (repro minimal, fichier,
ligne, attendu/obtenu) et passer à la feature suivante pour ne pas bloquer la vague.
