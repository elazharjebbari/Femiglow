# Étude — psychologie du timing & de la non-intrusion

> Question : *à quel moment, et à qui, proposer une bascule de langue sans déranger ?* Cette étude fonde la politique du moteur sur la **science de l'interruption** et les **bonnes pratiques e-commerce multilingue**. Chaque principe se traduit en règle pour le moteur (signal, profil, garde-fou).

## 1. Ce que dit la recherche sur l'interruption

| Principe (source) | En clair | → Règle moteur |
|---|---|---|
| **Breakpoints de tâche** (Adamczyk & Bailey, CHI 2004 ; Frontiers in Psychology 2024) | Interrompre **entre** deux chunks de tâche (breakpoint *grossier*) coûte bien moins que **dans** un chunk. | Ne déclencher qu'aux **frontières** : fin de section lue, pause de scroll, retour au repos. **Jamais** en plein geste (INV-17). |
| **Charge mentale (workload)** | Une interruption à **forte charge** est nettement plus nuisible qu'à **faible charge**. | Estimer la charge via les signaux (scroll rapide, frappe, formulaire) → **supprimer** si charge haute. |
| **Attention residue** | Après une interruption mal placée, l'attention « reste collée » à la tâche précédente → coût de reprise + agacement. | Une proposition mal placée **pollue** la session entière → mieux vaut **ne pas proposer** que mal proposer. Biais **conservateur** par défaut. |
| **Defer-to-breakpoint** (systèmes attention-aware) | Différer la notification jusqu'au prochain moment opportun > la montrer tout de suite. | Le moteur **met en file** la suggestion et **attend** le breakpoint (avec TTL : si aucun breakpoint, on **abandonne**). |
| **Zeigarnik / tâches inachevées** | Une tâche en cours crée une tension cognitive : l'interrompre est vécu négativement. | **Zone calme** absolue sur checkout/formulaire (INV-14). |
| **Peak-End rule** | On juge une expérience par son **pic** et sa **fin**. | Ne pas placer la proposition à un pic d'effort ; éviter d'en faire la dernière chose vue (sortie). Préférer un **creux calme**. |

## 2. Ce que dit l'e-commerce multilingue

| Principe (source) | → Règle moteur |
|---|---|
| **Jamais d'auto-redirect** (NN/g, Smashing, Weglot, Smartling) — la géo/navigateur ne *déterminent pas* la langue préférée. | Le moteur **propose**, ne **redirige jamais** (INV-20). Pas de géoloc IP comme signal dur. |
| **Détecter + override + mémoriser** | Deviner (multi-stratégies) **mais** toujours laisser le choix + retenir le refus (dismiss persistant, INV-16). |
| **Endonymes natifs** | Le prompt affiche `العربية` / `English` (lisible par la cible). |
| **72,4 % achètent plus volontiers dans leur langue** (CSA Research) | L'enjeu **conversion** justifie l'effort — mais le gain s'évapore si l'on agace. D'où le biais conservateur. |
| **Suggestion « stay / switch » (pattern Zara)** | Le prompt offre **deux issues claires et symétriques** : continuer (langue actuelle) / passer — jamais une seule action forcée. |

## 3. Le « bon moment » — définition opérationnelle

Un **moment opportun** = conjonction de :
1. **Breakpoint atteint** : fin de lecture d'une section *courte*, pause de scroll (≥ N ms sans scroll après activité), retour au top, **intent de sortie** (souris vers la barre d'adresse / onglet — desktop), ou **idle court** (inactivité brève après engagement).
2. **Charge faible** : pas de frappe en cours, pas de scroll rapide, pas de formulaire actif, pas de vidéo en lecture plein écran.
3. **Hors zone calme** : pas en checkout/wizard, pas en lecture longue engagée, pas pendant une action irréversible.
4. **Pertinence** : la langue devinée **diffère** de la langue servie, avec une **confiance** suffisante (cf. `detection-strategies.md`).
5. **Budget disponible** : cooldown non actif, cap non atteint, pas de dismiss persistant.

> **Anti-moment** (suppression immédiate) : scroll rapide, frappe, hover/drag, < 3 s sur la page, lecture longue en cours, checkout, modale déjà ouverte (chat), reduced-motion *strict* (on respecte mais on peut tout de même proposer de façon statique — voir a11y).

## 4. Tonalité du prompt (non-intrusion)

- **Discret** : « perle » ancrée au switcher ou *toast* bas, **jamais** modale plein écran.
- **Symétrique** : deux choix égaux (rester / passer), pas de bouton « refuser » culpabilisant.
- **Silencieux après refus** : dismiss = on n'en reparle plus (persistant).
- **Une phrase**, endonyme, voix « maison » (sobre, sans urgence). Ex. AR : « المتابعة بالعربية ؟ » + « البقاء بالفرنسية ».
- **Auto-effacement** : si non traité après un court délai au breakpoint, il s'efface (pas de harcèlement).

## 5. Pourquoi « off par défaut » (INV-13)

Le risque d'une suggestion mal calibrée (attention residue, agacement) dépasse, à froid, le gain attendu. On **n'active** que des profils **validés** (A/B + audit), progressivement. Le défaut sûr est : **personne n'est sollicité**.

## 6. Traduction en exigences mesurables

| Exigence | Mesure | Cible |
|---|---|---|
| Non-intrusion | taux de dismiss immédiat (< 2 s) | bas (proxy d'agacement) |
| Pertinence | taux d'acceptation des suggestions montrées | élevé |
| Respect zones calmes | suggestions montrées en checkout/lecture longue | **0** (INV-14/15) |
| Opportunité | % de suggestions montrées à un breakpoint identifié | ~100 % (INV-17) |
| Sobriété fréquence | suggestions / visiteur | ≤ 1 / cooldown (INV-16) |

---

### Sources
- [Opportune moments for task interruptions (Frontiers in Psychology, 2024)](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1465323/full) · [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11775001/)
- [Adamczyk & Bailey — Effects of Interruption at Different Moments Within Task Execution (CHI 2004)](https://interruptions.net/literature/Adamczyk-CHI04-p271-adamczyk.pdf)
- [Trafton & Monk — Task Interruptions (review)](https://www.interruptions.net/literature/Trafton-Reviews_HFE-3.pdf)
- [NN/g — Language Switching on Ecommerce Sites](https://www.nngroup.com/articles/language-switching-ecommerce/)
- [Smashing Magazine — Designing A Better Language Selector](https://www.smashingmagazine.com/2022/05/designing-better-language-selector/)
- [Smartling — Language selector best practices](https://www.smartling.com/blog/language-selector-best-practices)
- [Weglot — Designing a multi-language website](https://www.weglot.com/guides/multi-language-website)
