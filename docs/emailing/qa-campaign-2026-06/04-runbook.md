# RUNBOOK — exécution de la campagne QA emailing

> Ce runbook pilote `03-plan-action-global.md`. Il est conçu pour être exécuté
> par un humain OU par un agent (Claude Code) session par session. Chaque étape
> est idempotente : on peut reprendre à n'importe quel checkpoint.

## R0 — Préambule (à chaque session)

```bash
cd /var/www/femiglow-email-tests          # worktree dédié, branche feat/email-test-campaign
git pull --rebase origin feat/email-test-campaign 2>/dev/null || true
cd apps/web
pnpm install --frozen-lockfile
pnpm tsc --noEmit                          # doit être propre avant de commencer
```

État d'avancement : consulter/mettre à jour `07-etat-avancement.yaml`
(créé en R1; UNE entrée par étape avec statut `todo|in_progress|done|blocked`).

⚠️ **Interdits absolus** (mémoire projet) :
- ne JAMAIS lancer les tests d'intégration/E2E contre la DB ou le serveur prod;
- ne JAMAIS `pnpm reset` / `db:provision` hors DB de test;
- prod : `pnpm build` ⇒ toujours suivi de `systemctl restart femiglow.service`
  (ne concerne ce runbook que si un fix P0 est déployé).

## R1 — Initialiser le suivi

```bash
# Première session uniquement
cat > docs/emailing/qa-campaign-2026-06/07-etat-avancement.yaml <<'EOF'
campagne: qa-emailing-2026-06
demarree_le: "<date ISO>"
phases:
  p0-fondations:    { statut: todo, etapes: { msw-server: todo, factories: todo, db-test: todo, fixtures: todo, smtp-test: todo, scripts-npm: todo, canaris: todo } }
  p1-stabilisation: { statut: todo, bugs: { lead-tag: todo, webhook-stalwart: todo, reaper-sending: todo, sweep-runs: todo, bulk-erreurs: todo, render-ordre: todo, triggers: todo, frequency: todo } }
  p2-unit:          { statut: todo }
  p3-composant-msw: { statut: todo, modules: { cockpit: todo, automations: todo, audiences: todo, campagnes: todo, templates: todo, dashboard: todo } }
  p4-integration:   { statut: todo }
  p5-contract:      { statut: todo }
  p6-e2e:           { statut: todo }
  p7-scenarios:     { statut: todo, scenarios: { S1: todo, S2: todo, S3: todo, S4: todo, S5: todo } }
  p8-durcissement:  { statut: todo }
EOF
```

## R2 — Boucle d'exécution standard (toute étape)

1. **Sélectionner** la première étape `todo` dans l'ordre des phases
   (07-etat-avancement.yaml). La passer `in_progress`.
2. **Lire** le module concerné : `modules/<module>/README.md` + `test-matrix.csv`
   + `test-plan.yaml` (ordre des suites, prérequis).
3. **Implémenter** les tests de l'étape (les `specs/` du module donnent les
   squelettes à adapter — ils référencent les IDs de matrice).
4. **Exécuter** :
   ```bash
   pnpm vitest run <chemins de l'étape>      # unit / composant / intégration
   pnpm playwright test e2e/emails-<module>* # e2e seulement
   ```
5. **Boucle de correction** (cf. plan §boucle transversale) :
   - rouge à cause du CODE → corriger le code, consigner le bug dans
     `06-matrice-risques.csv` (colonne `decouvert_par`), re-exécuter;
   - rouge à cause du TEST → corriger le test, noter la cause;
   - **ne jamais affaiblir un oracle** pour passer au vert.
6. **Vérifier la non-régression** :
   ```bash
   pnpm tsc --noEmit
   pnpm vitest run src/lib/mail src/components/admin/emails src/app/api/admin/emails src/app/api/mail
   ```
7. **Committer** (atomique, ID de matrice dans le corps) :
   ```bash
   git add -A && git commit -m "test(emails/<module>): <portée> [<IDs matrice>]"
   ```
8. Marquer l'étape `done` dans 07-etat-avancement.yaml (inclure dans le commit).
9. Recommencer en 1.

## R3 — Checkpoints de phase (gates)

À la fin de chaque phase, valider les **critères de sortie** du plan :

```bash
# Gate type (exemple phase 3)
pnpm vitest run src/components/admin/emails --reporter=verbose 2>&1 | tail -20
# → 0 failed, 0 skipped non justifié
grep -c ",done" docs/emailing/qa-campaign-2026-06/07-etat-avancement.yaml
```

Si gate KO → la phase reste `in_progress`, on N'OUVRE PAS la suivante.
Si gate OK 3 exécutions consécutives → phase `done`, push :
```bash
git push -u origin feat/email-test-campaign
```

## R4 — Procédures spécifiques

### R4.a — DB de test (phase 0/4)
```bash
sudo -u postgres createdb femiglow_test 2>/dev/null || true
DATABASE_URL_TEST=postgresql://localhost/femiglow_test \
  pnpm drizzle-kit migrate   # vraies migrations — c'est le point qui attrape les drifts
```
Vérification drift (la leçon lead_tag) — comparer schéma drizzle vs DB :
```bash
DATABASE_URL=$DATABASE_URL_TEST pnpm drizzle-kit check
```

### R4.b — Capturer les fixtures webhook (phase 0.4)
Source : `email_event.raw_json` en prod (lecture seule) + logs Stalwart.
Anonymiser : emails → `user<N>@exemple.test`, ids → préservés structurellement.
Déposer dans `apps/web/src/test/fixtures/{stalwart,listmonk}/NNN-<type>.json`.

### R4.c — E2E avec faux SMTP (phase 6)
```bash
docker run -d --name mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit
SMTP_HOST=127.0.0.1 SMTP_PORT=1025 pnpm build && pnpm start -p 3100 &
pnpm playwright test e2e/emails-*.spec.ts --base-url http://127.0.0.1:3100
```

### R4.d — Simuler le temps (crons) dans les tests
Jamais d'attente réelle : POST direct sur la route cron avec le bearer de test,
après avoir antidaté les lignes en DB de test
(`UPDATE email_outbox SET next_retry = now() - interval '1 hour' ...`).

## R5 — Rapport de fin de session

À la fin de chaque session de travail, append dans
`docs/emailing/qa-campaign-2026-06/08-journal.md` :
```markdown
## Session <date>
- Étapes complétées : <liste avec IDs>
- Bugs code découverts par les tests : <réfs 06-matrice-risques.csv>
- Tests : <N> ajoutés, <N> verts, <N> quarantainés (raison)
- Prochaine étape : <id>
```

## R6 — Critère de FIN de campagne

- [ ] 07-etat-avancement.yaml : toutes phases `done`
- [ ] `pnpm vitest run` global : 0 failed
- [ ] `pnpm playwright test e2e/emails-*` : 0 failed, 3 runs consécutifs
- [ ] Couverture `src/lib/mail/**` ≥ 80 % lignes
- [ ] 06-matrice-risques.csv : tous les risques `ouvert` ont une décision
      (corrigé / accepté avec justification)
- [ ] CI : job `emails-qa` actif sur PR + nightly e2e
- [ ] PR finale ouverte vers master avec le résumé du journal
