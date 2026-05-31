# 06 — Opportunités de features

Pistes de fonctionnalités **alignées sur le socle** (réutilisation maximale) et sur la voix
« maison / rituel / initiée ». Ce ne sont pas des décisions : c'est un backlog raisonné à
arbitrer. Chaque piste indique les briques existantes mobilisées et les pré-requis de dette.

> Cadre de priorisation : impact conversion/rétention × réutilisation du socle ÷ coût ÷ dette à
> lever. S'appuyer sur `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` pour les leviers conversion.

---

## 1. Pistes à fort réemploi du socle (coût faible/moyen)

| # | Feature | Brique réutilisée | Pré-requis dette | Note |
|---|---|---|---|---|
| F1 | **Quiz / diagnostic ongles** (recommande le rituel adapté, capture lead qualifié) | `chat` (RAG/intent), `checkout` (state machine), `tracking` (`generate_lead`) | R1 (PII), R3 (rate-limit) | Levier Kolenda : engagement + qualification. Trilingue dès le départ |
| F2 | **Avis clients enrichis (reviews wall + photos)** | `media`, `cms`, seed `review-photos` (déjà présents) | i18n | Preuve sociale ; dossier `docs/reviews-wall` existe déjà |
| F3 | **Recommandation de pack / cross-sell au panier** | `products`, `kit`, `checkout`, `tracking` | R5 (CheckoutFlow) | Augmente le panier moyen ; à mesurer via tracking |
| F4 | **Notifications transactionnelles enrichies** (confirmation, suivi COD, relance panier) | `mail` (Stalwart), `webhooks`, crons | R1 | Rétention ; réutilise l'infra mail existante |
| F5 | **Bandeau promo contextuel par ville/segment** | `promo-slide-header` (déjà là), `tracking` | — | Géo-promo ; dossier `geo-promo-slide-header` existe |

## 2. Pistes contenu & acquisition (coût moyen)

| # | Feature | Brique réutilisée | Pré-requis dette | Note |
|---|---|---|---|---|
| F6 | **Calendrier éditorial + publication multi-réseaux planifiée** | `content-studio-v2`, `social-publishing` (scheduler désormais actif) | — | Le cron scheduler est en prod (live-systems) — exploitable maintenant |
| F7 | **Génération assistée d'articles journal (IA, trilingue)** | `content-studio`, `cms` articles locale-aware | i18n, brand-safety | S'appuyer sur `ai-content-studio` ; garde-fous charte |
| F8 | **Pages SEO programmatiques** (par ville / par bénéfice) avec hreflang | `seo`, `cms`, i18n (hreflang en place) | i18n | Acquisition organique ; dossier `seo-action-plan` existe |
| F9 | **Newsletter / séquences de bienvenue** | `emails` (Listmonk), `mail` | R1, R3 | Rétention ; infra campagnes déjà câblée |

## 3. Pistes plateforme / rétention (coût moyen/élevé)

| # | Feature | Brique réutilisée | Pré-requis dette | Note |
|---|---|---|---|---|
| F10 | **Espace cliente / suivi de commande** (sans compte lourd : magic link) | `auth`, `checkout`, `mail` | R1, R2, droit à l'oubli | Rétention COD ; attention conformité PII |
| F11 | **Abonnement / réassort rituel** | `checkout`, `products`, crons | R1, queue durable | Récurrence revenu ; nécessite jobs fiables |
| F12 | **Programme de parrainage / initiées** | `leads`, `tracking`, `mail` | R1 | Acquisition virale ; cohérent avec la voix « initiées » |

## 4. Pistes « santé du produit » (habilitantes, à faire tôt)

Ces chantiers ne sont pas des features visibles mais **débloquent** tout le reste (cf. doc `04 §4`).

| # | Chantier | Pourquoi avant le reste |
|---|---|---|
| H1 | **Sentry / APM** (R2) | Voir casser une feature en prod en temps réel |
| H2 | **Chiffrement PII leads** (R1) | Pré-requis de toute feature qui collecte des données (F1, F4, F9-F12) |
| H3 | **Rate-limit middleware public** (R3) | Sécurise toute nouvelle route publique |
| H4 | **Finaliser + merger i18n** (Phase 8) | UI publique trilingue par défaut (F1, F2, F7, F8) |
| H5 | **Refactor composants tunnel** (R5) | Rend F3/F10/F11 testables |

---

## 5. Lecture recommandée

- **Quick win le plus aligné** : F5/F6 (réutilisent du socle 100 % en place, faible dette).
- **Plus fort impact conversion** : F1 (quiz/diagnostic) + F3 (cross-sell) — mais lever R1/R3.
- **Séquence saine** : H1 → H3 → (H4 i18n) → F5/F6 → F1 → H2 → F4/F9 → reste.

> Aucune de ces pistes ne demande un nouveau fournisseur externe : IA, mesure, mail, diffusion
> sociale et CMS sont déjà intégrés (doc `01 §4`). La valeur est dans **l'assemblage**, pas dans
> de nouvelles dépendances.

---

## 6. Prochaine étape

Ce dossier est le socle. L'étape suivante : **choisir 1-2 pistes**, ouvrir un dossier de feature
dédié au gabarit maison (cahier → architecture → data → backend → frontend → tests → runbook), et
appliquer la checklist DoD du doc `05 §8`. Les chantiers habilitants H1-H3 peuvent démarrer en
parallèle car ils ne dépendent d'aucun arbitrage produit.
