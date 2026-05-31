# ADR — Moteur de suggestion (suite des ADR du dossier parent)

## ADR-010 — Le `LocaleNudge` du plan de base devient un **profil** du moteur
**Contexte.** Le plan de base définissait un nudge one-shot autonome. Le moteur généralise « quand/à qui proposer ».
**Décision.** Le nudge one-shot = profil `TRIG-ENTRY-MISMATCH` (surface = perle) du moteur. On **ne maintient pas** deux logiques. `LocaleNudge` devient une **présentation** (`surface: 'pearl'`) de `LocaleSuggestionPrompt`.
**Conséquences.** Une seule source de vérité de déclenchement ; pas de double comptage d'events. Le moteur **off par défaut** ⇒ le nudge ne s'affiche plus tant qu'on n'active pas le profil (cohérent INV-13).
**Alternatives rejetées.** Garder deux systèmes (incohérence, double déclenchement).

## ADR-011 — Moteur de **règles déclaratif** (pas de ML en V1)
**Décision.** Politique = fonction **pure** `evaluateSuggestionPolicy(signals, config)` ; profils en **données**. (Axe A3 de `comparative-approaches.md`.)
**Conséquences.** Pilotable, déterministe, auditable, testable par table. Un score ML pourra être **ajouté comme signal** plus tard sans refonte (extension A4).
**Alternatives rejetées.** ML/bandit V1 (boîte noire, pas de données, non explicable) ; règle codée (non pilotable).

## ADR-012 — Exécution **hybride** serveur+client
**Décision.** Devinette de langue + 1ère éligibilité **serveur** (no-flash) ; signaux comportementaux + moment opportun **client**. (Axe B3.)
**Conséquences.** Pas de flash, mais réactif au comportement. Plomberie SSR→prop + runtime client.

## ADR-013 — **Defer-to-breakpoint** (file + TTL)
**Décision.** Une suggestion éligible est **mise en file** et n'apparaît qu'au prochain **breakpoint** (pause scroll, idle court, exit-intent) ; abandon au TTL. (Axe E3, fondé sur Adamczyk & Bailey.)
**Conséquences.** Non-intrusion (INV-17) ; pas de harcèlement (abandon silencieux).

## ADR-014 — Zones calmes = **plancher non désactivable**
**Décision.** Les profils `never` critiques (checkout, formulaire actif) sont **hard-codés** comme plancher ; la config admin ne peut pas les désactiver (CONTRACT §7.5).
**Conséquences.** Garantit INV-14 même en cas de mauvaise config ou d'erreur admin. Les autres `never` (deep-read, fast-scroll) sont éditables mais activés par défaut.

## ADR-015 — Config dans `app_config` (section `i18n_suggestion_engine`)
**Décision.** Réutiliser `app_config` + snapshots + audit + cache (comme ADR-009). **Off par défaut** ; config invalide ⇒ moteur off (INV-13).
**Conséquences.** Audit/versioning/cache gratuits ; cohérence avec le switcher.

## ADR-016 — **Off par défaut pour tous**, activation par A/B + audit
**Décision.** Aucun profil trigger activé à la livraison. On active **progressivement**, profil par profil, sous A/B + lecture d'audit (taux d'acceptation, dismiss<2s, suppressions en zones calmes = 0).
**Conséquences.** Risque maîtrisé ; pas d'agacement de masse ; INV-13 garanti à la sortie.

## ADR-017 — Confidentialité : pas de géoloc IP comme signal dur, jamais d'auto-redirect
**Décision.** IP-géo au mieux *tie-breaker faible désactivable* ; la suggestion reste un **choix** (INV-20).
**Conséquences.** Conforme NN/g + RGPD ; pas de redirection subie.
