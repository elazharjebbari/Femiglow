# Runbook — Incident en cours (CI rouge)

Procédure quand un job CI passe rouge sur `main` (ou prod).

## SLA

- Détection : automatique (Slack alert + email)
- Triage initial : **15 min**
- Décision (rollback ou fix forward) : **30 min**
- Fix livré ou rollback effectué : **< 2 h**

## Étape 1 — Triage (< 15 min)

Première personne disponible :
1. Lire l'alerte Slack (lien vers run CI)
2. Identifier le **job qui a planté** :
   - Lint / Type-check → erreur compile typique, fix rapide
   - Unit / Int → bug code, voir trace
   - Components → bug UI, voir snapshot
   - E2E → souvent timing/flaky
3. Identifier le **commit responsable** (PR mergée juste avant) → notifier auteur
4. Décider :
   - **Flaky probable** → rerun (1×) → si vert : surveiller, ticket si récurrent
   - **Bug réel** → escalade niveau 2

## Étape 2 — Décision (< 30 min)

| Cas | Action |
|-----|--------|
| Flaky récurrent | Quarantaine + ticket, ne pas bloquer main |
| Bug isolé non bloquant | Fix forward (PR rapide) |
| Bug critique en prod | **ROLLBACK immédiat** + post-mortem |
| Coverage drop > 5 % | Investigate cause, écrire tests manquants |

### Rollback procedure

```bash
# 1. Identifier le commit problématique
git log --oneline -10

# 2. Revert (préférable à reset hard)
git revert <commit-sha>
git push origin main

# 3. CI doit repasser vert
# 4. Notifier équipe + ouvrir post-mortem
```

### Fix forward procedure

```bash
# 1. Créer branche fix
git checkout -b fix/ci-XXX-description

# 2. Reproduire localement
pnpm test  # voir si reproduit
# si E2E :
pnpm test:e2e:debug e2e/...

# 3. Fix + test régression
# 4. Push + PR fast-track
# 5. Merge dès vert
```

## Étape 3 — Post-mortem (< 24h)

Pour incidents L3/L4 (rollback ou prod impact) :

```markdown
# Post-mortem — Incident YYYY-MM-DD

## Résumé
- Quand : <date + heure>
- Durée impact : <X heures>
- Sévérité : L1/L2/L3/L4

## Timeline
- 10:00 — Merge PR #XXX
- 10:15 — CI rouge détecté (alerte Slack)
- 10:18 — Triage : bug régression sur orchestrator
- 10:30 — Décision rollback
- 10:35 — Rollback effectué
- 10:38 — CI vert

## Cause racine
<analyse 5 whys>

## Pourquoi tests ne l'ont pas attrapé
<gap dans la couverture>

## Actions correctives
- [ ] Test régression écrit (ticket)
- [ ] Doc mise à jour (ticket)
- [ ] Process amélioré (ticket)

## Tickets associés
- CHA-XXX (fix)
- CHA-YYY (test régression)
- ...
```

## Cas spécifiques chat

### Provider LLM en erreur en CI

Symptôme : E2E `BS01` fail avec timeout sur `chat-message`.

Diagnostic :
```bash
# Vérifier MSW handlers ne sont pas bypassed
grep "passthrough\|.use(" apps/web/src/test/msw/
# Vérifier env vars test sont correctes
echo $OPENAI_API_KEY  # devrait être test-key-openai
```

Fix : s'assurer que MSW intercept TOUS les appels OpenAI en test.

### DB testcontainers timeout

Symptôme : Integration tests pendent sur `getTestDb()`.

Diagnostic :
```bash
docker ps  # voir si container postgres est up
docker logs <container-id>  # voir l'erreur init
```

Fix : nettoyer containers existants, recréer, vérifier port 5432 libre.

### Coverage drop sans cause apparente

Diagnostic :
```bash
# Comparer lcov rapport main vs PR
diff <(curl -s "https://codecov.io/api/main/lcov") \
     <(cat apps/web/coverage/lcov.info)
```

Cas fréquents :
- Code dead ajouté
- Branch non testée
- Fichier nouveau sans tests

## Communication

- **Slack #qa-chat** : alerte CI rouge
- **Slack #incidents** : si L3/L4
- **PR comment** : status update + lien post-mortem
- **GitHub Issue** : tracking incident jusqu'à fermeture
