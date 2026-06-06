# Runbook — pilotage de l'exécution du plan d'action « emails-ux »

> Ce runbook PILOTE `07-plan-action-global.yaml` : il dit comment démarrer une
> étape, lancer les batteries, dérouler la boucle de correction, franchir les
> gates et consigner. Opérateur : dev/agent sur le serveur (repo
> `/var/www/femiglow`, app `apps/web`). Tous les chemins sont absolus.
> **Règles d'or** : jamais d'E2E contre la prod ; suite existante verte à
> chaque étape ; un gate rouge = boucle §4, jamais de contournement.

## 0. Pré-requis (une fois)

```bash
cd /var/www/femiglow && git status --short        # arbre propre exigé
cd apps/web && pnpm install --frozen-lockfile
# DB d'intégration
createdb femiglow_test 2>/dev/null || true
# Instance E2E (worktree port 8013, SMTP→Mailpit 1025, Listmonk→port mort) :
# cf. docs/emailing/qa-campaign-2026-06 (phase 0) ; restaurer la baseline :
#   dropdb femiglow_emailqa && createdb -O femiglow femiglow_emailqa \
#     && pg_restore -d femiglow_emailqa -j4 /root/femiglow-emailqa-baseline-*.dump
```

## 1. Démarrer une étape (Px.y)

```bash
# 1. Marquer l'étape en_cours dans 07-plan-action-global.yaml (statut local)
# 2. Lire la spec du chantier :
#    technique/fonctionnalites/Fxx/{01-description.md,02-spec-technique.yaml}
# 3. Vérifier que les lignes de batterie du lot sont identifiées :
grep -c '^Fxx-' technique/fonctionnalites/Fxx-*/03-batterie-tests.csv
```

## 2. Lancer les batteries (commandes canoniques)

```bash
cd /var/www/femiglow/apps/web

# Batterie d'un chantier (les noms de tests sont préfixés par l'ID) :
pnpm vitest run -t "F04-"                          # tout F04
pnpm vitest run -t "F04-C-03"                      # un lot précis

# Suite emails GLOBALE (gate G2) :
pnpm vitest run src/components/admin/emails src/app/api/admin/emails \
               src/lib/mail src/lib/admin/emails

# Intégration (DB femiglow_test) :
pnpm vitest run -c vitest.config.ts src/test/integration

# Statique (gate G5) — next build OBLIGATOIRE (violations RSC invisibles sinon) :
pnpm tsc --noEmit && pnpm lint && pnpm next build

# E2E (instance worktree démarrée sur :8013) :
pnpm playwright test e2e/emails-*.spec.ts e2e/admin-emails*.spec.ts \
  --reporter=line,junit

# a11y (gate G6) :
pnpm vitest run -t "A11Y"                          # axe jsdom (socle)
pnpm playwright test e2e/a11y --grep emails        # axe pages
```

## 3. Mesurer l'avancement (mécanique, sans déclaratif)

```bash
# Lignes de batterie déclarées vs implémentées (croisement CSV ↔ code) :
for f in technique/fonctionnalites/F0*/03-batterie-tests.csv; do
  ID=$(basename $(dirname "$f") | cut -d- -f1)
  DECL=$(tail -n +2 "$f" | wc -l)
  IMPL=$(grep -rEoh "'$ID-[UCIEA]-[0-9]+" ../../../../apps/web/src ../../../../apps/web/e2e 2>/dev/null | sort -u | wc -l)
  echo "$ID : $IMPL / $DECL implémentés"
done
```
(adapter les chemins relatifs selon le cwd — la convention « le nom du test
commence par son ID » rend ce comptage fiable.)

## 4. Boucle de correction (à CHAQUE gate rouge)

```
┌─> 4.1 RUN     pnpm vitest run … --reporter=junit --outputFile=/tmp/junit.xml
│   4.2 TRIAGE  pour chaque échec, classer :
│        BUG_CODE  → écrire/ajuster d'abord le test qui le prouve, puis fixer
│        BUG_TEST  → corriger l'oracle (revue obligatoire : un oracle ne
│                    s'affaiblit jamais sans justification écrite en PR)
│        FLAKY     → quarantaine fixme + entrée journal + correction < 48 h
│        CONTRAT   → mock ≠ prod : corriger le schéma partagé PUIS le test
│                    de conformité PUIS les consommateurs
│   4.3 FIX     un commit par cause racine, ID matrice/batterie dans le message
│   4.4 RE-RUN  ciblé (-t "ID") puis COMPLET (le fix n'a rien cassé ailleurs)
└── 4.5 si même cause racine échoue 2× : STOP, escalade tech lead, étape → bloque
```
Sortie de boucle : 0 rouge + 0 quarantaine non ticketée.

## 5. Franchir un gate de phase (fin de Px)

```bash
# 1. Batterie globale + intégration + statique + E2E + a11y (cf. §2, TOUT)
# 2. Coverage (gates G3/G4) :
pnpm vitest run --coverage src/components/admin/emails
# 3. Scénarios métier de la phase (G8) — liste dans Fxx/04-scenarios-metier.md :
pnpm playwright test --grep "SM-F0[34]"            # ex. phase P2
# 4. Démo de revue d'écran (03-plan-conception §5) : dérouler À LA MAIN un
#    scénario métier sur staging, consigner le verdict.
# 5. Journal (§7) + commit + tag :
cd /var/www/femiglow
git add -A && git commit -m "feat(emails-ux): phase Px terminée — gates G1..G9 verts" 
git tag emails-ux-phase-Px
```

## 6. Déploiement prod (par phase, après gate)

```bash
# 1. Migrations additives d'abord (02-modele-donnees.md §3), hors CONCURRENTLY :
sudo -u postgres psql -d femiglow -f <migration.sql>     # via le process migrations du repo
# 2. Build + restart (OBLIGATOIRE — chunks périmés sinon) :
cd /var/www/femiglow/apps/web && pnpm build
systemctl restart femiglow.service
# 3. Smoke prod LECTURE SEULE :
curl -sf -o /dev/null -w '%{http_code}\n' -H "Host: femiglow-maroc.com" \
  http://127.0.0.1:8011/admin/emails          # attendu 307 (login)
journalctl -u femiglow.service --since '2 minutes ago' | grep -ci error  # 0 attendu
# 4. Rollback éventuel : revert du commit code + build + restart
#    (les colonnes additives restent, inertes).
```

## 7. Journal d'exécution

| Date | Étape | Opérateur | Batterie (vert/rouge) | Triage (causes) | Verdict |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

Consigner UNE ligne par session de travail, même intermédiaire. Les
quarantaines flaky ouvertes sont listées en pied de tableau jusqu'à résolution.

## 8. Critères de clôture du programme (P5.4)

- [ ] 10 batteries Fxx : 100 % implémentées (comptage §3) et vertes
- [ ] Suite globale emails (~1700 + nouveaux) verte 3 runs consécutifs (anti-flaky)
- [ ] Tous les scénarios SM-* verts
- [ ] G1..G9 verts simultanément sur le même commit
- [ ] 111 problèmes de la matrice : statut traité/différé justifié ligne à ligne
- [ ] Rapport de clôture + tag `emails-ux-1.0` + mémoire projet mise à jour
