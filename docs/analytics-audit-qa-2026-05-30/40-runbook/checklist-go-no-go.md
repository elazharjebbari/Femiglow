# 40 — Checklist Go / No-Go

> À dérouler avant de déclarer la batterie « livrée » et les systèmes analytics « validés ». Tout
> item **No** bloque le Go.

## 1. Correction des findings

- [ ] **AF-01** (filtres réactifs) — `closed`, e2e + composant verts sur Funnel/CTA/Checkout.
- [ ] **AF-02** (revenu CTA en MAD) — `closed`, test 199 MAD vert ; devise MAD partout.
- [ ] **AF-03** (modèle funnel) — décision actée, progression clampée/expliquée, test vert.
- [ ] **AF-04** (fuseau Maroc) — `closed`, tests bi-fuseau verts.
- [ ] **AF-05** (device défaut + double barre) — `closed`, une seule barre effective sur Insights,
      indicateur « Mobile uniquement » présent.
- [ ] Tous les **P2** traités ou explicitement reportés (avec ticket) dans `findings-register.csv`.

## 2. Couverture des fonctionnalités

- [ ] 100 % des `FN-*` ont ≥ 1 test à leur niveau primaire (`matrice-couverture.csv`).
- [ ] Les 8 scénarios métier **SM-01 → SM-08** ont un e2e correspondant et vert.
- [ ] Primitives testées **en interaction** (tri, export, tooltip, retry).

## 3. Qualité & stabilité

- [ ] `pnpm typecheck` vert.
- [ ] Suite unitaire analytics verte.
- [ ] Suite composant+MSW verte.
- [ ] Suite e2e analytics verte **3× consécutives** (anti-flaky).
- [ ] Cas temporels verts en `TZ=UTC` **et** `TZ=Africa/Casablanca`.
- [ ] `axe` : 0 violation critique/serious sur les 4 onglets.
- [ ] Couverture `lib/analytics/**` ≥ seuils (`config/coverage-targets.yaml`).

## 4. Process

- [ ] Gate CI bloquante active sur les chemins analytics.
- [ ] `findings-register.csv` à jour (statut + lien test pour chaque ID).
- [ ] PR(s) référencent `task_id` + `finding_id`.
- [ ] Note à la fondatrice : les chiffres historiques (revenu CTA, today/yesterday) **se recalent**
      après correctifs — date de bascule communiquée.

## 5. Décision

| Résultat | Action |
|---|---|
| Tous les items **Oui** | **GO** — merge + activation gate + clôture du chantier |
| Un item P0/P1 **Non** | **NO-GO** — retour boucle correction/vérification |
| Seuls des P2 **Non** (ticketés) | **GO conditionnel** — merge avec dette tracée |

---

### Empreinte de validation (à remplir)

```
Date           : __________
Responsable QA : __________
Findings closed: ___ / 27
FN couverts    : ___ / 73
e2e stable 3x  : oui / non
Couverture     : ___ %
Décision       : GO / NO-GO / GO conditionnel
```
