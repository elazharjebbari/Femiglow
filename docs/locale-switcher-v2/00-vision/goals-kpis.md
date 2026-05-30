# 00 · Vision — Goals & KPIs

> **Aspect couvert** : (a) le fonctionnement optimal en termes d'objectifs, (b) les KPI mesurables, leurs seuils, leur instrumentation et leur méthode de mesure.
> **Events de référence (figés, CONTRACT §4)** : `locale_switch`, `locale_nudge_shown`, `locale_nudge_accepted`, `locale_nudge_dismissed`.
> **Surfaces (figées)** : `header` | `drawer` | `footer` | `nudge`. **Transitions** : `vt` | `veil` | `reduced` | `reload`.

---

## 1. UX goals (qualitatifs, vérifiables)

| # | Goal UX | Traduction concrète | Invariant lié | Vérifié par |
|---|---|---|---|---|
| **G1** | **Bascule sans rupture** | 0 reload, 0 flash blanc, 0 saut de scroll en conditions nominales | INV-1, INV-3 | Playwright (scroll preserved), perf trace |
| **G2** | **RTL comme un geste** | FR→AR : aucun frame LTR visible ; miroir dans le fondu | INV-2 | Playwright + capture frame-by-frame |
| **G3** | **Discrétion charte** | Switcher neutre : 0 pop chaud, 0 pulse, 0 drapeau/emoji | CONTRACT §5 | Revue design + test DOM (pas de classe pop/pulse) |
| **G4** | **Trouvable en < 3 s** | Switcher au-dessus du fold (header/drawer), nudge contextuel | — | Test utilisateur modéré (time-to-find) |
| **G5** | **Découvrabilité non intrusive** | Nudge 1×/visiteur, dismiss permanent, jamais modale/bannière | — | Vitest (cap impressions) + Playwright |
| **G6** | **Accessible** | Clavier complet, annonce SR, reduced-motion, sans-JS | INV-7,8,10 | axe + Playwright + revue SR |
| **G7** | **Non régressif** | Wizard intact, scanners i18n verts, hreflang conservés | INV-5,6,9 | Garde-fous (build, scanners, wizard E2E) |
| **G8** | **Robuste / fallback total** | Tout chemin a un repli, aucun écran cassé | INV-12 | Vitest fault-injection + MSW down |

---

## 2. Conversion KPIs (quantitatifs)

> **Échelle d'analyse** : toujours **par locale servie** (`served`), pas par locale du navigateur. La V2 réussit si **l'écart AR↔FR se réduit** sur la North Star.

### 2.1 North Star

| KPI | **NS — Add-to-cart rate per served locale** |
|---|---|
| **Définition** | `sessions avec ≥1 add_to_cart` ÷ `sessions` — segmenté par `served ∈ {fr, ar, en}` |
| **Pourquoi** | Capture l'effet « lire dans sa langue = confiance = intention d'achat » au point de friction réel |
| **Instrumentation** | `served` = locale du préfixe URL au moment de l'`add_to_cart` (dérivée serveur, pas du navigateur). Joindre l'`add_to_cart` existant à la dimension `served`. |
| **Mesure** | Cohorte glissante 14 j ; comparer **AR vs FR** (gap) et chaque locale vs sa baseline pré-V2 |
| **Cible** | **Réduire le gap AR↔FR de ≥ 30 % relatif** en 8 semaines post-rollout, **sans** dégradation FR (FR ne baisse pas de > 1 pt absolu) |
| **Garde-fou** | Si add-to-cart FR baisse > 1 pt absolu sur 14 j ⇒ rollback variant (voir rollback.md) |

### 2.2 KPIs secondaires

| KPI | Définition | Source | Cible (seuil) | Méthode de mesure |
|---|---|---|---|---|
| **K1 — Wizard completion per locale** | `wizards complétés` ÷ `wizards démarrés`, par `served` | funnel checkout existant × dimension `served` | Gap AR↔FR **−25 % relatif** en 8 sem ; AR completion **≥ 0.9 ×** FR completion à terme | Funnel 14 j glissants par locale, comparé baseline |
| **K2 — Discoverability** | `locale_switch` (toutes surfaces) ÷ **sessions AR-capable** | `locale_switch` (CONTRACT §4) ; AR-capable = `Accept-Language` primaire `ar*` **ou** cookie AR | **≥ 18 %** des sessions AR-capable produisent ≥ 1 `locale_switch` vers `ar` | Numérateur = sessions distinctes avec `locale_switch.to='ar'` ; dénominateur = sessions AR-capable (dérivée serveur) |
| **K3 — Nudge accept rate** | `locale_nudge_accepted` ÷ `locale_nudge_shown` | events nudge | **≥ 22 %** accept ; **dismiss ≤ 55 %** ; reste = ignoré | Par cohorte de `locale_nudge_shown` ; accept et dismiss mutuellement exclusifs |
| **K4 — Nudge non-nuisance (bounce guard)** | bounce des sessions **avec** `locale_nudge_shown` vs **sans** (AR-capable, comparables) | bounce existant × event nudge | Bounce nudge **≤** bounce no-nudge **+ 0 pt** (pas d'aggravation) | A/B H2 ; test de non-infériorité sur le bounce |
| **K5 — Switch success rate (transition health)** | `locale_switch` avec `transition ∈ {vt,veil,reduced}` ÷ tous `locale_switch` | `locale_switch.transition` | **≥ 99 %** ; `transition='reload'` **≤ 1 %** (fallback hors-ligne/erreur uniquement) | Part de `reload` = proxy d'échec no-reload ; alerte si > 1 % |
| **K6 — Switch latency (perceived)** | temps clic → nouvelle frame committée | perf mark `locale_switch_start/end` (client) | p75 **≤ 320 ms**, p95 **≤ 600 ms** (borne charte) | Web perf marks autour du callback `apply()` |
| **K7 — RTL glitch rate** | bascules FR→AR avec ≥1 frame LTR visible | flag client (dir posé avant frame) + Playwright | **0 %** (INV-2) | Test automatisé frame-by-frame + compteur client de garde |
| **K8 — A11y announce coverage** | bascules ayant émis l'annonce `aria-live` | compteur client (INV-10) | **100 %** des bascules (hors no-op) | Test unit + Playwright (live region mise à jour) |

---

## 3. A/B experiments (rattachés aux hypothèses du dossier)

| Exp | Hypothèse | Variant control | Variant test | Métrique primaire | Guardrail | Décision |
|---|---|---|---|---|---|---|
| **H1 — Forme** | Toggle segmenté > dropdown en découvrabilité | `header.variant=dropdown` | `header.variant=segmented` (A/B) | **K2** (discoverability) | **NS** FR ne baisse pas | Adopter test si K2 **+20 % relatif** & NS FR neutre |
| **H2 — Nudge** | Nudge > rien pour récupérer l'AR | `nudge.enabled=false` | `nudge.enabled=true` | **NS** AR + **K2** | **K4** (bounce non-infériorité) | Garder nudge si NS AR **+** & K4 OK |
| **H3 — Transition** | No-reload > reload | (référence pré-V2 reload) | voile V2 (vt/veil) | pages/session post-switch, **K5**, **K6** | NS global neutre+ | Confirmé si ↑ pages/session & K5 ≥ 99 % |

> Toute expérience exige les events **présents et validés** (cf. §5) avant lancement. Randomisation par visiteur (cookie stable), pas par session.

---

## 4. Tableau récapitulatif des seuils (à instrumenter dans le dashboard langue)

| Métrique | Vert | Ambre | Rouge (alerte) |
|---|---|---|---|
| NS gap AR↔FR (réduction relative) | ≥ 30 % | 10–30 % | < 10 % ou gap qui s'aggrave |
| NS FR (delta absolu vs baseline) | ≥ 0 | −1 à 0 pt | < −1 pt → **rollback** |
| K2 discoverability | ≥ 18 % | 10–18 % | < 10 % |
| K3 nudge accept | ≥ 22 % | 12–22 % | < 12 % |
| K3 nudge dismiss | ≤ 55 % | 55–70 % | > 70 % → revoir copy/timing |
| K5 switch success | ≥ 99 % | 97–99 % | < 97 % → bug no-reload |
| K6 latency p75 | ≤ 320 ms | 320–450 ms | > 450 ms |
| K7 RTL glitch | 0 % | — | > 0 % → INV-2 cassé |
| K8 announce coverage | 100 % | 95–100 % | < 95 % → INV-10 cassé |

---

## 5. Instrumentation — règles communes

1. **Noms d'events figés** : n'émettre que les 4 events de CONTRACT §4, avec **exactement** le payload spécifié. Aucun nom ad hoc.
   - `locale_switch` `{ from, to, surface, page, transition }`
   - `locale_nudge_shown` `{ suggested, served, page }`
   - `locale_nudge_accepted` `{ suggested, page }`
   - `locale_nudge_dismissed` `{ suggested, page }`
2. **`surface`** ∈ {`header`,`drawer`,`footer`,`nudge`} ; **`transition`** ∈ {`vt`,`veil`,`reduced`,`reload`}. Toute autre valeur = bug.
3. **No-op non tracké** : cliquer la langue **active** (INV-11) n'émet **aucun** `locale_switch`.
4. **`served`** dérivée **serveur** (préfixe URL), jamais du navigateur, pour éviter le biais d'auto-détection.
5. **AR-capable** dérivée serveur (`Accept-Language` primaire `ar*` OU cookie `NEXT_LOCALE=ar`), calculée **une fois** par session.
6. **Perf marks** (K6) : `performance.mark('locale_switch_start')` au clic, `'locale_switch_end'` au commit de la nouvelle frame ; latence = mesure entre les deux.
7. **Pas de PII** dans les payloads ; `page` = pathname **sans** querystring sensible (UTM dépouillé pour l'analytics, conservé pour la nav INV-4).
8. **Idempotence nudge** : `locale_nudge_shown` au plus 1×/visiteur (cap `maxImpressionsPerVisitor`, défaut 1) ; `accepted` XOR `dismissed`.

## 6. Éléments à vérifier (KPI)

- [ ] Les 4 events partent avec le **bon payload** sur chaque surface (Vitest + interception MSW/analytics).
- [ ] `served` et `AR-capable` sont dérivés serveur (pas de fuite navigateur) — test d'intégration.
- [ ] No-op (INV-11) **n'émet pas** `locale_switch` — test dédié.
- [ ] `transition` reflète le vrai chemin (vt/veil/reduced/reload) — test par injection (VT absente, reduced-motion on, offline).
- [ ] Cap nudge respecté (K3/G5) — test d'impressions répétées.
- [ ] Dashboard langue affiche NS, K1–K8 par locale avec seuils vert/ambre/rouge.
- [ ] Garde-fou rollback NS FR < −1 pt branché à une alerte.
