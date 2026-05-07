# P3 — Registre des risques

> 18 risques identifiés. Légende :
>
> - **Probabilité (L/M/H)** : Faible / Moyenne / Élevée.
> - **Impact (L/M/H)** : Faible / Moyen / Élevé.
> - **Sévérité** = P × I (LL=1 … HH=9).
> - **Trigger** : signal observable qui matérialise le risque.
> - **Owner** : qui suit / déclenche la mitigation.

| ID | Risque | Probabilité | Impact | Sévérité | Mitigation | Trigger / Owner |
|----|--------|:-----------:|:------:|:--------:|------------|------------------|
| R1 | **Migration DB en prod corrompt les données existantes** (mauvais ALTER, orphelins) | L | H | 3 | • Tester la migration sur un dump prod en staging<br>• Backup PIT activé<br>• Migration revue 2-yeux<br>• `0006_components_cms.sql` ne touche pas aux tables existantes (additif uniquement) | Erreur Drizzle au déploiement / **BE lead** |
| R2 | **MSW handlers divergent du contrat API réel** (faux positifs en test) | M | M | 4 | • Schémas Zod **partagés** entre MSW et API (T5.12)<br>• Test cross-validation hebdo dans CI<br>• PR template : tout nouveau endpoint = handler MSW joint | Test Playwright vert mais bug en staging / **FE lead** |
| R3 | **Cache stampede** : pic de revalidations simultanées après publish massif (P12.4 Journal) | L | M | 2 | • Tag composé par composant (`components:fields:<key>`) plutôt que tag global seul<br>• Throttle côté admin : pas plus de 10 publish / minute par utilisateur<br>• Monitor temps de TTFB pendant rollout | Lighthouse alerte / **BE** |
| R4 | **Bypass de sanitization rich-text via markdown crafté** (XSS) | L | H | 3 | • Sanitization en 2 temps : à l'écriture + au rendu<br>• Allowlist stricte (cf. A6)<br>• 15+ vecteurs de test dans le corpus (T4.7)<br>• Pen-test avant P12.4 | Audit sécurité / **BE lead** |
| R5 | **Seed écrase une édition admin** (régression critique) | L | H | 3 | • Logique upsert seed = `INSERT ... ON CONFLICT DO NOTHING`<br>• Test : ajouter un binding admin, relancer seed, vérifier inchangé<br>• Le `force-default` est un endpoint séparé, jamais auto | Bug report fondatrice / **BE lead** |
| R6 | **Régression perf RSC** (TTFB +50 ms après P12) | M | M | 4 | • Benchmark avant / après chaque page-group<br>• Cache RSC par défaut activé partout<br>• Monitoring Web Vitals continu<br>• Budget perf ≤ +5 ms par page | Web Vitals dashboard / **FS** |
| R7 | **Édition admin casse la mise en page** (overflow, longueur, RTL) | M | M | 4 | • `config.maxLength` strictement enforcé en Zod<br>• Compteur visuel avec seuil orange/rouge<br>• Tests de propriété : tirer aléatoirement des valeurs<br>• Cf. R5 / I7 pour la procédure d'incident | Bug report public / **DSG + FE** |
| R8 | **Scope creep vers multilingue** (« tant qu'on y est, mettons l'anglais ») | H | M | 6 | • A5 isole clairement le périmètre v1 (locale présente, mais aucune UI)<br>• Toute demande v2 → ticket distinct<br>• Décision écrite avant kickoff partagée à la fondatrice | Demande en standup / **PO** |
| R9 | **Cron de promotion en échec en cascade** (registry change) | L | M | 2 | • Validation Zod **à la programmation** (pas seulement à la promotion)<br>• Signal `field.schedule.failed` + alerte Slack si > 3/24h<br>• Endpoint manuel `promote` (R5 / I3) | Alerte Slack / **BE** |
| R10 | **Adoption fondatrice faible** (elle continue de demander des PR) | M | H | 6 | • Sessions de formation au moment du rollout (R4 / P12.5)<br>• Doc PDF 1 page<br>• Suivi hebdo : combien d'éditions ont été faites en autonomie<br>• Itérer sur l'UX en cas d'incompréhension | < 1 publish / sem après go-live / **PO + DSG** |
| R11 | **Conflit version 409 fréquent** (deux personnes éditent en même temps) | L | L | 1 | • Modal merge / reload (T7.4)<br>• Audit `field.session.start` / `field.session.end` permet de voir « X édite »<br>• Doc R5 / I8 explique l'absence de lock | Toast 409 récurrent / **FE** |
| R12 | **Drift registre/DB après plusieurs PR** (cf. R5 / I5) | M | M | 4 | • Job CI hebdo qui run le diagnostic drift<br>• Alerte si > 5 orphelins<br>• Reconcile semi-automatique en cas de drift modéré | Alerte CI / **BE** |
| R13 | **Coût inattendu sur rich-text storage** (snapshots × historique) | L | L | 1 | • `value jsonb` plus économique que TOAST text<br>• Purge à 90 j (rich-text à 365 j)<br>• Compression Postgres native<br>• Monitor table size mensuel | Storage > 1 GB / **BE** |
| R14 | **Open redirect via `cta.href`** | L | H | 3 | • Allowlist d'hôtes (`COMPONENTS_FIELDS_ALLOWED_HOSTS`)<br>• Tests Zod sur scheme et hostname (T4.8)<br>• Pas de wildcards | Audit sécu / **BE** |
| R15 | **Path traversal sur `iconKey`** | L | M | 2 | • Whitelist registre d'icônes<br>• `z.enum([...REGISTERED_ICONS])`<br>• Tests T4.5 + T4.8 | Audit sécu / **BE** |
| R16 | **Auto-save spam serveur** (utilisateur frappe vite) | M | L | 2 | • Debounce 800 ms<br>• Rate-limit 60 req/min/user (T5.10)<br>• Coalesce des updates<br>• Pas d'auto-save tant que la valeur n'a pas changé | Observabilité QPS / **BE + FE** |
| R17 | **Données perdues lors d'un rollback de PR retirant un field** | L | M | 2 | • Le retrait archive (status=archived), ne supprime pas<br>• `restore` toujours possible depuis l'historique<br>• Doc R2 et R3 explicite le rollback | Bug post-rollback / **FS** |
| R18 | **Sortie de la fondatrice (vacances, maladie) bloque les éditions urgentes** | M | M | 4 | • Au moins 1 second admin actif (dev backup)<br>• Doc R5 utilisable sans contexte<br>• Endpoint API manuel pour cas extrêmes | Demande externe urgente / **PO** |

## Synthèse par sévérité

```
Sev 9 (HH)  : —
Sev 6 (HM,MH): R8, R10
Sev 4 (MM,HL,LH): R2, R6, R7, R12, R18
Sev 3 (LH,HL): R1, R4, R5, R14
Sev 2 (LM,ML): R3, R9, R15, R16, R17
Sev 1 (LL)   : R11, R13
```

## Top 5 à surveiller en continu

1. **R8 — Scope creep multilingue** : surveillance continue PO. Le
   refus poli est la mitigation principale.
2. **R10 — Adoption fondatrice** : KPI dédié dans le dashboard
   (cf. NF6 dans P4).
3. **R2 — Divergence MSW / API** : test cross-validation **dans
   chaque PR** qui touche une route API.
4. **R6 — Régression perf** : Web Vitals **avant et après chaque
   page-group**.
5. **R7 — Layout cassé par édition** : alerte design + revue manuelle
   pour les premières éditions de la fondatrice.

## Risques **acceptés** (résiduels)

- L'absence de lock pessimiste (R11 résiduel) : on accepte le coût
  d'un éventuel 409 occasionnel plutôt que la complexité d'un lock.
- L'absence d'approbation 4-yeux : on accepte qu'un admin puisse
  publier seul. La traçabilité (audit + history) compense.
- La rétention 90 j (R17 résiduel) : on accepte qu'une restauration
  > 90 j ne soit pas possible. Backup PIT comme filet ultime.

## Plan de revue des risques

- **À chaque fin de phase** (P1-P11) : revue rapide (15 min) — y
  a-t-il un risque qui s'est concrétisé ? Un nouveau risque émergé ?
- **Avant chaque sous-phase de P12** : check des triggers
  spécifiques (R6, R7, R10).
- **Post-mortem v1** : actualisation pour v2.

## Cross-references

- Phases → P1 (`01-phases.md`)
- Tasks (mitigations en tâches) → P2 (`02-tasks.md`)
- Acceptance (les NF couvrent les risques techniques) → P4
- Incidents → R5
