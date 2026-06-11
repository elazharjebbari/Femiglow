# Dossier de conception — Visibilité du coupon d'accueil au paiement

> Rendre le **coupon d'accueil auto-appliqué** (« geste d'accueil », −90 MAD → 199) plus visible **dans le tunnel de paiement** (`KitCommander` / wizard), sans trahir la charte FemiGlow ni les bonnes pratiques.
> Sources : `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` · `docs/coupon-auto-appliqué.md` · UI `/kit` existante.
> Date : 2026-06-03

## Sommaire du dossier
1. `00-need-analysis.md` — Analyse du besoin, tension, contraintes croisées (Kolenda × coupon-doc), état actuel.
2. `01-ux-ui-design.md` — Résolution UX/UI, wireframes (mobile/desktop), états, micro-copy, tokens de style/design/graphique.
3. `02-architecture.md` — Architecture (flux données serveur→wizard), backend, frontend, contrats.
4. `03-action-plan.md` — Plan de conception + plan de dev, étapes ordonnées avec tests.
5. `04-tests.md` — Stratégie de test (Vitest, MSW, Playwright), cas, oracles.
6. `05-runbook.md` — Pilotage de l'exécution + vérification preview + rollback.
7. `wireframes.puml` — Schémas (états du récap, flux de résolution).

## Principe directeur (la tension à tenir)

Le playbook Kolenda impose **une seule zone saillante par viewport** (le CTA) et **un seul point chaud (terracotta) sur la page** (réservé au CTA pivot). Le doc coupon impose un **module inline calme, adossé à la réassurance, voix maison, sans countdown/rouge/gamification**. 

→ La visibilité du coupon au paiement se fait donc par une **ligne éditoriale calme** intégrée au **récap panier** du wizard (zone de décision focalisée, distincte de la page), affirmant le **geste d'accueil** + **l'économie absolue (90 MAD)** — **sans** créer un second objet saillant qui concurrencerait le CTA, et **sans** rien qui ressemble à un sticker promo. C'est une **mise en récit** de la remise déjà présente, pas un nouveau marteau commercial.

## Résultat attendu
Dans le wizard, sous/à côté du prix `199 MAD` (et du `289 MAD` barré), apparaît une mention sobre :

> **Votre geste d'accueil est appliqué** · Économie 90 MAD

adossée à la trust row (`Livraison offerte · Paiement à la livraison · Retour 30 j`), en tokens crème/encre/sauge, `tabular-nums`, l'« Économie » seule autorisée à un accent terracotta discret (cf. Kolenda §4.6). Aucune dépendance à un champ de saisie. Piloté par le coupon (admin), cohérent avec l'affichage `/kit`.
