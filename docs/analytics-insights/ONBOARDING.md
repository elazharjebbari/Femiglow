# Analytics Insights — guide d'onboarding

> *Pour acquisition, marketing, édito : comment lire la console
> Insights et en tirer des décisions.*

---

## 1. Accéder

`/admin/analytics/insights` (auth admin).

## 2. Lire la page en 30 secondes

```
┌─────────────────────────────────────────────────────────────┐
│ Header                                                      │
│   Titre + indicateur "Mis à jour il y a X min"              │
├─────────────────────────────────────────────────────────────┤
│ Filtres                                                     │
│   Période · Env · Device · Locale · Source                  │
├─────────────────────────────────────────────────────────────┤
│ 5 onglets                                                   │
│   Vue d'ensemble · Pages · Composants · Sections · Funnel   │
├─────────────────────────────────────────────────────────────┤
│ Contenu de l'onglet                                          │
│   KPIs + graphes + tables                                    │
└─────────────────────────────────────────────────────────────┘
```

## 3. Vue d'ensemble — comment l'interpréter

**6 KPIs** au sommet :
- **Total events** — volume brut d'interactions sur la fenêtre
- **Sessions uniques** — nombre de visiteurs uniques (ouverts × naviguant)
- **Visites de page** — uniquement les `page_view`
- **Conversions** — events flagués `is_conversion=true` (achats, leads, etc.)
- **Events / session** — engagement moyen par session
- **Taux de rebond** — sessions à 1 page vue / total. *Plus c'est bas, mieux c'est.*

**Variation** : ↗ vert = bonne nouvelle, ↘ rouge = à investiguer.
Le bounce rate inverse cette logique (↗ rouge).

**Time-series** : 3 lignes superposées (events / sessions / conversions) sur la fenêtre.
Cherche les **pics** (= bonne acquisition) et les **creux** (= problème ?).

**Heatmap** : créneaux les plus chauds. Si aucune activité avant 10h, on peut programmer les pushes plus tard.

## 4. Pages — quelle page travailler ?

Tableau trié par **visites desc**. Les colonnes utiles :

- **Engmt** = % de scroll deep (scroll_depth ≥ 75). Page lue en entier ?
- **Conv.** = nombre d'événements de conversion sur la page
- **Bounce** = % de sessions à 1 page seul
- **Durée** = durée moyenne d'attention (max 30 min)

**Question type** : "Cette page a 8 000 visites mais 38 % de bounce et 0 conv ?
→ Page d'atterrissage qui ne convertit pas. Action : retravailler le hero / CTA."

**Click sur une ligne** → drawer drill-down avec les events de la page.

## 5. Composants — quoi cliquer / quoi supprimer ?

Tableau **top composants** par déclenchements totaux.

**Composants silencieux** : si un composant est dans la base mais
n'a déclenché aucun event sur la fenêtre, il apparaît ici. Soit le
brancher (oubli de tracking), soit l'archiver.

**Click sur une ligne** → drawer avec les events que le composant déclenche
+ les pages où il est actif.

## 6. Sections — où s'attardent les visiteurs ?

Bar chart horizontal : durée moyenne d'attention par section
(`fg_section_view`).

> Une section avec **4 minutes** de durée moyenne ≠ une section
> "qui marche". Ça peut être : (a) section très intéressante,
> (b) section bloquante (visiteur cherche quelque chose).
> Croiser avec le bounce rate de la page parente.

## 7. Funnel — comment va la conversion ?

5 étapes : `view_item → add_to_cart → begin_checkout → add_payment_info → purchase`.

**Drop-off le plus suspect** : le passage avec le plus gros écart.
Standard ecommerce :
- view → ATC : 30-40 % normal, < 15 % = problème offre/prix/CTA
- ATC → checkout : 50-70 % normal, < 30 % = problème de panier
- checkout → payment : 70-90 % normal, < 50 % = friction de form
- payment → purchase : 80-95 % normal, < 70 % = échec paiement

## 8. Filtres — combinaisons utiles

| Combinaison                      | Question                                              |
| -------------------------------- | ----------------------------------------------------- |
| `30d` + `device=mobile`          | Comment va le mobile ce mois ?                         |
| `7d` + `env=production`          | KPIs de la semaine sans pollution du staging          |
| `90d` + `locale=fr-MA`           | Comportement marocain sur 3 mois                       |
| `custom` 2 semaines avant launch | Baseline avant un lancement                            |

URL = source de vérité → tu peux **partager un lien** avec tes filtres.

## 9. Refresh — quand prend en compte les nouveaux events

Cron auto **toutes les 15 min**. Pour forcer une mise à jour :
- Bouton **Refresh maintenant** dans l'indicator (en haut à droite).
- Patiente 10-30 s. L'indicator passe à "Calcul en cours…".

Si auto désactivé → un admin l'a coupé. Le bouton manuel reste actif.

## 10. Exports

- **CSV** : sur chaque table (Pages, Composants, Sections), bouton
  "Exporter CSV" en haut à droite. UTF-8 BOM, Excel/Numbers compatible.
- **PNG** : sur les graphes Overview et Funnel, bouton "Exporter PNG".

## 11. Quand demander de l'aide

- Le bouton refresh ne répond plus → cf. [11-runbook.md](11-runbook.md) §10
- Les chiffres semblent farfelus → vérifier que le refresh a bien eu lieu (timestamp en bas de page)
- Une page ou un composant manque → c'est probablement qu'il n'a pas
  encore déclenché d'event. Vérifier le tracking dans `/admin/tracking/`

## 12. Ce qui n'est pas dans la console

- Pas de drill jusqu'à la session individuelle (RGPD)
- Pas de pages personnalisées V1
- Pas de cohort analysis V1
- Pas de prédictif

Tout ça est planifié pour V2, cf. [00-cahier-des-charges.md](00-cahier-des-charges.md) §6.

---

Date : 2026-05-08
Auteur : équipe data + édito
