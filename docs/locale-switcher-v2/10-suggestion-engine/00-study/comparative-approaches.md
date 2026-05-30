# Analyses comparatives & proposition finale

> Comment **construire** le moteur ? On compare plusieurs architectures, on les note, et on recommande celle digne d'un vrai système (pilotable, fiable, évolutif) — pas un dépannage.

## 1. Axe A — Le « cerveau » de décision

| Approche | Description | Pilotable | Fiabilité | Explicabilité (audit) | Effort | Verdict |
|---|---|---|---|---|---|---|
| **A1. Règle unique codée** | « si Accept-Language ≠ served → bannière » | ✗ (hardcode) | faible (1 signal) | nulle | XS | **Rejeté** (le « truc de dépannage ») |
| **A2. Seuils statiques** | quelques `if` configurables (delay, 1×) | partiel | moyenne | faible | S | Insuffisant (pas de profils) |
| **A3. Moteur de règles déclaratif (profils + signaux + politique pure)** | profils trigger/never en **données**, fonction pure `evaluatePolicy` | **total** (config) | **haute** (faisceau + fail-safe) | **haute** (raison + profil) | M | **RETENU** |
| **A4. Scoring ML / bandit** | modèle appris du « bon moment » | difficile à piloter | dépend des données | faible (boîte noire) | XL | Rejeté V1 (pas de données, non explicable, sur-ingénierie). *Évolution possible* : brancher un score appris **en signal** du moteur A3. |

→ **A3 — moteur de règles déclaratif** : c'est le seul qui satisfait *pilotable + fiable + auditable + évolutif* sans sur-ingénierie. Il **accueille** plus tard un score ML comme simple signal (A4 en extension), sans réécriture.

## 2. Axe B — Où vit la décision (exécution)

| Approche | Pour | Contre | Verdict |
|---|---|---|---|
| **B1. 100 % client** | réactif aux signaux comportementaux | flash possible, logique exposée | partiel |
| **B2. 100 % serveur** | pas de flash, logique protégée | aveugle au comportement in-page (scroll/idle) | partiel |
| **B3. Hybride (serveur amorce + client affine)** | devinette serveur (no-flash) **+** signaux comportementaux client | un peu plus de plomberie | **RETENU** |

→ **B3** : la devinette de langue + la 1ère éligibilité sont **résolues serveur** (no-flash, ADR-006/detection §4) ; les **signaux comportementaux** (breakpoints, idle, exit-intent) et la **décision finale du moment** sont **client**.

## 3. Axe C — Stockage & pilotage de la config

| Approche | Pour | Contre | Verdict |
|---|---|---|---|
| **C1. Constantes code** | simple | pas pilotable (INV-18 KO) | Rejeté |
| **C2. Table dédiée** | isolation | duplique audit/cache | possible |
| **C3. `app_config` section `i18n_suggestion_engine`** | réutilise versioning/snapshots/audit/cache existants (ADR-009) | partage l'infra | **RETENU** |

→ **C3** : cohérent avec le reste du dossier (ADR-009), audit + snapshots + cache **gratuits**.

## 4. Axe D — Présentation du prompt

| Approche | Intrusion | Verdict |
|---|---|---|
| **D1. Modale plein écran** | forte | **Rejeté** (anti-pattern) |
| **D2. Bannière persistante haut** | moyenne | Rejeté |
| **D3. Perle ancrée au switcher** | faible | RETENU (cas léger) |
| **D4. Toast bas dismissible, deux choix symétriques (pattern Zara)** | faible | RETENU (cas « rescue ») |

→ **D3/D4 selon le profil** : la perle pour un mismatch léger, le toast « rester / passer » pour l'exit-rescue. **Jamais** de modale.

## 5. Axe E — Stratégie de déclenchement temporel

| Approche | Pour | Contre | Verdict |
|---|---|---|---|
| **E1. Immédiat au load** | simple | viole breakpoints (intrusif) | Rejeté |
| **E2. Délai fixe (n s)** | basique | ignore la tâche réelle | Insuffisant |
| **E3. Defer-to-breakpoint (file + TTL)** | aligné science (Adamczyk) | logique de breakpoints | **RETENU** |

→ **E3** : on **met en file** et on **attend** le breakpoint (pause scroll, idle court, exit-intent), avec TTL d'abandon. Conforme à la recherche (consumer-psychology §1).

---

## 6. Proposition finale — « Moteur de suggestion déclaratif, hybride, defer-to-breakpoint »

**A3 + B3 + C3 + D3/D4 + E3.** Un système où :

1. **Devinette serveur** (`guessPreferredLocale`, faisceau pondéré, no-flash) → `{ guessedLocale, confidence }` en prop.
2. **Politique pure** (`evaluateSuggestionPolicy`) : exclusions **d'abord** (zones calmes, INV-14/15), puis triggers activés par priorité/confiance/budget. **Off par défaut** (INV-13).
3. **Runtime client** (`useLocaleSuggestionEngine`) : collecte les **signaux comportementaux**, détecte les **breakpoints**, applique le **defer-to-breakpoint** (file + TTL), et **rend** le `LocaleSuggestionPrompt` (perle/toast) au moment opportun.
4. **Config `app_config`** : profils trigger/never **en données**, créables/éditables en admin (INV-18), poids des stratégies, seuils de confiance, cooldowns/caps, surfaces.
5. **Audit** : chaque évaluation émet `locale_suggestion_evaluated` (decision + reason + profile) ; une vue admin confirme « ça se déclenche bien, et seulement là où il faut » (INV-19).
6. **Acceptation** → `useLocaleTransition` (la bascule sans reload du plan de base). **Refus** → dismiss (session/persistant). **Jamais** d'auto-redirect (INV-20).

### Pourquoi c'est « un vrai système »
- **Pilotable** : tout est config (activer/désactiver global + par profil, créer/éditer/supprimer profils trigger **et** never).
- **Fiable** : fonction pure déterministe + fail-safe (signal manquant ⇒ conservateur) + plancher de zones calmes non désactivable.
- **Auditable** : décisions tracées avec raison + profil ; vue de vérification.
- **Évolutif** : un score ML (A4) se branche comme **un signal** de plus, sans refonte.
- **Non régressif** : réutilise `useLocaleTransition`, `app_config`, l'audit existant ; le `LocaleNudge` de base devient un profil (`TRIG-ENTRY-MISMATCH` + surface perle).

### Matrice de scoring (synthèse, pondérée comme le dossier parent)
| Critère ×poids | A1 | A2 | **A3 (reco)** | A4 |
|---|---|---|---|---|
| Pilotable ×3 | 1 | 3 | **5** | 2 |
| Fiabilité ×3 | 2 | 3 | **5** | 3 |
| Auditabilité ×3 | 1 | 2 | **5** | 1 |
| Évolutivité ×2 | 1 | 2 | **5** | 4 |
| Effort⁻¹ ×1 | 5 | 4 | **3** | 1 |
| **Total** | 17 | 31 | **57** | 24 |

## 7. Intégration au plan global
Cette proposition devient les lots **L9→L12** de `../08-plan-action/plan-action.md` (détection+politique pures → runtime+prompt → config+admin+audit → E2E+a11y+garde), avec backlog, dépendances, runbook et checklist mis à jour — au **même niveau de détail** (UI/UX/design/data/conception/dev/tests Vitest+Playwright+MSW).
