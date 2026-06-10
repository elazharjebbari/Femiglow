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
| 2026-06-10 | P1.6 E2E — gate de phase P1 | session (worktree, feat/emails-ux-p0) | E2E 10/10 × 3 RUNS consécutifs (emails-socle + emails-navigation, serveur :3100 prod build sur femiglow_test_e2e — :8013 historique désormais occupé par corolle-tracking) ; composant 557 v ; tsc OK ; build OK | 2 BUGS PROD trouvés par la batterie : contraste AA `text-stone-400` sur texte (SuppressionList détail+note, dashboard astuce ⌘K, SavedViewsSidebar titres, KpiHeader tirets — INVISIBLE en axe jsdom, color-contrast exige un vrai rendu) + ancre `#nouvelle-campagne` inexistante (le redirect /campaigns/new pointait dans le vide) ; 1 outillage (setup login : evaluate vs redirection → waitForLoadState+retry) ; 1 LEÇON exploitation : `fuser -k 3100/tcp` pas `kill $(lsof)` — un restart raté a servi un build périmé (faux rouge) | ✅ F01-E-073/074 + F01-A-078 et F02-E-001..006 implémentés (helpers seedSuppression + axe-e2e) ; F01-E-075/076/077 REPORTÉS avec leurs adoptants (CSV : reporte_p2_dashboard / reporte_p3_wizard / reporte_p2_cockpit) ; F01 = 73/78, F02 = 63/63 COMPLET ; démo de revue d'écran manuelle : à dérouler par l'opérateur (étape humaine §5.4) |
| 2026-06-06 | P1.5 pilote Suppression | session (worktree, feat/emails-ux-p0) | pilote+socle 80/80 ; suite complète 592 v ; CLIQUETS : SuppressionList retirée des 3 listes blanches (1re décroissance) et les verrous passent | 1 BUG_TEST invariant (précision 4s déléguée à C-017, l'invariant adoptant teste l'auto-dismiss réel) ; suite UX4 historique réécrite pour le dialog (intentions préservées + 1 test re-tentative ajouté) | ✅ SuppressionList = 1er adoptant du socle (ConfirmDialog/toast/EmptyState/format-datetime/Intl.NumberFormat) + invariants describe.each armés (F01-C-069/070) |
| 2026-06-06 | P1.4 navigation F02 | session (worktree, feat/emails-ux-p0) | F02 : 52 composant/U/A + 6 intégration vraie-DB (femiglow_test_f02nav) = 57/63 (restent 6 E2E) ; tsc OK ; build en validation | 2 corrections à la spec : champs contrat alignés (automationErrors/listmonkSyncFailed supersèdent l'ébauche P0.2) ; formatBadge(0)→null (oracle U-010) ; 1 outillage : unstable_cache hors runtime Next → fallback incrementalCache documenté | ✅ route nav-counters (401 JSON, TTL 30s+tag, 500 franc) + EmailsTabs (9 onglets, badges dégradation silencieuse, lastKnown, suspension hidden) + breadcrumbs helper + palette (+Suppression,+Runs) + /campaigns/new (lien palette mort réparé) |
| 2026-06-06 | P1.3 socle (lot 3/3) | session (worktree, feat/emails-ux-p0) | Wizard 14/14 (1er passage) ; composant 535 v ; tsc OK ; build OK | aucun | ✅ ui/Wizard partagé (étapes cliquables <= atteintes, Ctrl+flèches, focus titre, alert près de Suivant, persistance sessionStorage) — SOCLE F01 COMPLET côté composants (68/78 lignes ; restent invariants+E2E -> P1.5) |
| 2026-06-06 | P1.2 socle (lot 2/3) | session (worktree, feat/emails-ux-p0) | F01 lots 1+2 : 57/57 ; composant 521 v ; unit 806 v ; tsc OK ; build OK | 3 amendements d'oracle consignés (U-055 supersédé par DASH-07 ; U-067/068 → sémantique CLIQUET avec listes blanches décroissantes : 6 fichiers confirm, 25 toLocale, 25 tokens) | ✅ EmptyState + Freshness + format-datetime + Pill/tones + STATUS_META dédupliqué (KpiCards re-export, F01-U-059 par égalité de référence) + UnsavedChangesGuard |
| 2026-06-06 | P1.1 socle (lot 1/3) | session (worktree, feat/emails-ux-p0) | F01-C-001..028 : 28/28 (TDD rouge→vert) ; composant 492 v ; unit 806 v ; tsc OK ; build OK | 3 BUG_TEST (focus initial Annuler vs Enter — dérogation consignée ; fake timers auto-advance ; oracle d'ordre) ; 1 outillage (delay non ré-exporté par @/test/msw/server → ajouté) ; reste du lot débuggé via le harnais canonique | ✅ ui/ConfirmDialog + ui/toast + ToastProvider monté dans layout |
| 2026-06-06 | P0.1+P0.2 CI & contrats | session (worktree, feat/emails-ux-p0) | conformité 8/8 ; composant 464 v (57 fichiers, shard 2× vérifié 29+28) ; unit 806 v ; tsc OK | 3 CONTRAT (nominaux manquants détectés par la conformité : reap-stuck, suppression GET/DELETE → ajoutés à emailsHandlers) ; 1 outillage (pnpm `--` n'forwarde pas --shard → retiré) | ✅ CI : jobs build-rsc + coverage(rapport) + shard 2× ; wire-schemas.ts (9 contrats dont nav-counters amont) |
| 2026-06-06 | P0.3 quick-wins | session (worktree femiglow-email-tests, feat/emails-ux-p0) | p0-quickwins 9/9 ; emails composants 458 v / 0 r ; lib/mail 663 v ; tsc OK ; next build OK | 1 BUG_TEST (AutomationWizard utilisait has_tag → consent_marketing) ; EVT-05 INVALIDÉ (déjà conforme) ; lint = échec pré-existant master (preload.test.ts, hors périmètre) | ✅ commit 843d521 — 7 fixes + 9 tests régression |

Consigner UNE ligne par session de travail, même intermédiaire. Les
quarantaines flaky ouvertes sont listées en pied de tableau jusqu'à résolution.

## 8. Critères de clôture du programme (P5.4)

- [ ] 10 batteries Fxx : 100 % implémentées (comptage §3) et vertes
- [ ] Suite globale emails (~1700 + nouveaux) verte 3 runs consécutifs (anti-flaky)
- [ ] Tous les scénarios SM-* verts
- [ ] G1..G9 verts simultanément sur le même commit
- [ ] 111 problèmes de la matrice : statut traité/différé justifié ligne à ligne
- [ ] Rapport de clôture + tag `emails-ux-1.0` + mémoire projet mise à jour
