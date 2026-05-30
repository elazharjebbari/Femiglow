# Flake budget — anti-flake protocol

## Définition flake
Un test "flaky" passe une fois et échoue la fois suivante sans modification de code.

## Sources fréquentes
1. Race conditions (setTimeout sans wait)
2. Polling sans timeout explicite
3. Network mocks pas réinitialisés entre tests
4. Test order dependency (state global)
5. Vrais appels réseau qui filtrent en E2E

## Stratégie

### Avant merge PR
3 runs E2E consécutifs identiques :
```bash
for i in 1 2 3; do
  npx playwright test e2e/social-publishing/*.spec.ts --grep -v @live --reporter=line | tail -3
done
```

### Si flake détecté
1. Identifier le test
2. Investiguer cause (cf liste ci-dessus)
3. Fix ou quarantainisation :
   - Fix : préférer wait explicite, vérifier nettoyage, isoler state
   - Quarantine : `.skip` + issue GitHub `[FLAKE]` avec lien trace
4. PR fix indépendante

### Budget toléré
- 0 flake critical (P0)
- ≤ 1 flake quarantainisé toléré pour P1-P2
- 0 flake en live spec

## Métriques à suivre
- Run / fail / flake ratio sur dernier mois
- Test most-flaky list (top 5)
- Time-to-fix average

## Outils
- Playwright `--retries=0` en CI pour détecter (pas masquer)
- Coverage Sentry / SauceLabs pour historique
- Manual `for loop 3 runs` avant chaque PR critique
