# 18 — Améliorations admin et contrôle du wall

Ce document audite la console d'administration du composant « Rituels partagés » dans son état post-livraison J1-J4 (branche `feat/rituals-wall`), identifie les zones de friction et de croissance, puis propose **douze améliorations** classées par impact opérationnel et coût d'implémentation. Chacune comporte une raison d'être étayée et un ordre de priorité argumenté.

## 1. État des lieux de l'admin

### 1.1 Surfaces existantes

| Surface | Capacités | Données utilisées |
| --- | --- | --- |
| `/admin/rituals/queue` | Liste paginée des `PENDING` avec checkboxes, bulk approve / reject (note obligatoire) | `ritual_testimonials.status = 'PENDING'` |
| `/admin/rituals/published` | Liste paginée des `APPROVED`, bulk feature / unfeature / hide | `ritual_testimonials.status = 'APPROVED'` |
| `/admin/rituals/archived` | `HIDDEN` ou `REJECTED` filtrable, bulk restore | `ritual_testimonials.status IN (...)` |
| `/admin/rituals/[id]` | Preview + photos avec rectangles ML + actions individuelles + audit log immutable | `ritual_testimonials`, `_photos`, `_audit_log` |
| `/admin/rituals/insights` | KPI globaux (4 tiles) + signal (oui / hésite / non) + top tags | `ritual_aggregate` rafraîchi à la volée |
| `/admin/rituals/import` | Wizard 5 étapes (Source → Contenu → Aperçu → Confirmation → Rapport) avec mapping interactif | API `/import/{preview,commit,template}` |
| `/admin/rituals/import/help` | Doc Markdown rendue | constantes inline |

### 1.2 Mécaniques transverses

- **Bulk actions** : `applyBulkAction(action, ids, note?)` avec chunks de 50, audit double (par rituel + global), limite 1000.
- **RBAC** : un seul rôle effectif (admin via `requireAdmin()`). Pas de hiérarchie modérateur/admin distincte.
- **Audit** : `ritual_audit_log` immutable, accessible dans la vue détail.
- **Pagination** : `offset / limit` 25 par page sur toutes les listes.
- **Recherche** : aucune.
- **Filtres** : aucun (queue ne montre que `PENDING`, archivés bascule masqués/rejetés, c'est tout).
- **Tri** : fixe `createdAt desc` partout.
- **Persistance UI** : aucune (sélection bulk reset au changement de page).

### 1.3 Points forts à préserver

1. **Voix de la maison conservée jusque dans l'admin** : kicker / titres Cormorant, palette sobre, pas d'icônes Material agressives.
2. **Dual-driver Drizzle / memory store** : facilite les tests et le développement local sans BDD.
3. **Audit double** (par rituel + global) sur les actions bulk : excellente traçabilité.
4. **Tapage explicite** prévu (spécifié dans `16-bulk-management.md` § 4.6) mais non encore branché sur destructive — à implémenter dans une amélioration ultérieure.

## 2. Cartographie des zones d'amélioration

Sept axes émergent de l'audit, classés par criticité décroissante.

| # | Axe | Diagnostic |
| --- | --- | --- |
| A | **Vélocité de modération** | Souheila doit revenir à la liste après chaque action. Pas de raccourcis clavier. Coût : 4 à 5 clics par rituel. |
| B | **Filtrage et recherche** | Aucun filtre par auto-flag, source, date, auteur. Aucune recherche full-text. À volume modéré (50+ rituels), retrouver une chose précise devient laborieux. |
| C | **Performance perçue** | Pagination `offset / limit` dégénère au-delà de 1 000 rituels. Pas d'optimistic UI sur actions. Page Insights refresh agrégat à chaque hit (peut être lent). |
| D | **Risque qualité** | Pas de détection automatique de doublons ou de témoignages quasi-identiques. Risque de fakes par même auteur ou de recopiages. |
| E | **Insights opérationnels** | Aucune temporalité (graph 30/90 jours), aucune comparaison, aucun monitoring de la qualité du provider Vision ML. |
| F | **Notifications & SLA** | Pas d'alerte à Souheila quand un nouveau rituel arrive ou quand un SLA 48 h est dépassé. |
| G | **Workflow d'export et d'intégration** | Pas d'export CSV des listes. Pas de webhook sortant. Pas d'API publique versionnée pour syndication. |

## 3. Douze propositions d'amélioration

Chaque proposition est structurée ainsi :

- **Description** : ce que l'on fait
- **Pourquoi** : trois raisons concrètes (impact opérationnel, business, technique)
- **Indicateurs d'impact attendus**
- **Effort estimé** : jours de dev
- **Dépendances** : ce qui doit être en place

Les propositions 1 à 5 sont des **quick wins** (≤ 2 j). Les propositions 6 à 10 sont **moyennes** (3 à 5 j). Les propositions 11 et 12 sont **lourdes** (5 j et plus).

---

### Proposition 1 — Navigation prev / next dans la vue détail

**Description** — Sur `/admin/rituals/[id]`, ajouter une barre `← précédent · 3 sur 12 PENDING · suivant →` qui passe au rituel suivant dans la même file (queue / published / archived) avec préservation du contexte (filtres URL appliqués). Auto-skip si le rituel courant change de status après une action.

**Pourquoi**

1. **Productivité** : Souheila enchaîne en moyenne 8 à 12 modérations / jour (cible) ; supprimer le retour-aller `queue → détail → queue → détail` économise 30 à 60 secondes par cycle.
2. **Concentration** : éviter le retour à la liste évite la pollution visuelle (table + autres rituels) entre deux décisions et préserve la qualité de jugement.
3. **Pattern reconnaissable** : tous les outils de modération sérieux (Help Scout, Front, Intercom) ont ce shortcut — c'est attendu.

**Indicateurs d'impact**

- Délai médian par modération : -40 % (cible).
- Nombre de retours à la liste par session : 0 (cible) au lieu de N=nb_modérations.

**Effort** — 1 jour.

**Dépendances** — Requête côté serveur pour récupérer l'ID précédent et suivant dans la même file (Drizzle `LEAD(id) / LAG(id) OVER (ORDER BY created_at)` ou simple sub-query).

---

### Proposition 2 — Raccourcis clavier pour la modération

**Description** — Sur la vue détail et la queue, ajouter des raccourcis :

- `J` / `K` : naviguer vers le rituel suivant / précédent
- `A` : approuver (avec confirmation visuelle non bloquante)
- `R` : rejeter (ouvre la modale avec textarea note pré-focalisée)
- `H` : masquer (idem reject)
- `F` : toggle featured (sur published)
- `?` : afficher cheatsheet clavier
- `Esc` : fermer toute modale

Conditionnels selon le status du rituel. Annonce vocale via `aria-live` pour lecteur d'écran.

**Pourquoi**

1. **Productivité brute** : un opérateur clavier-only modère 2 à 3 fois plus vite. Pour Souheila qui traite tout, c'est un gain compound.
2. **Ergonomie** : la souris fatigue ; les raccourcis clavier permettent une session longue sans douleur.
3. **A11y** : ces raccourcis bénéficient aussi aux utilisateurs lecteurs d'écran et navigation clavier obligatoire.

**Indicateurs d'impact**

- Délai médian par modération : -50 % vs souris seule.
- Adoption mesurable : % d'actions déclenchées via clavier (à instrumenter).

**Effort** — 1,5 jour (composant `useKeyboardShortcuts` + cheatsheet modale + tests Vitest).

**Dépendances** — Aucune.

---

### Proposition 3 — Filtres avancés persistés en URL sur la queue

**Description** — Ajouter une barre de filtres au-dessus de chaque table admin :

- **Auto-flags** : `face_detected`, `emoji_detected`, `link_external`, `forbidden_word`, `all_caps`, etc. (multi-select).
- **Source** : `web`, `email_j45`, `manual`, `import_csv`, `import_json`, `import_zip` (multi-select).
- **Période** : aujourd'hui, 7 j, 30 j, 90 j, ou range custom.
- **Auteur** : recherche par prénom OU `customer_hash` (utile pour traquer un récidiviste).
- **Vérification** : `verified_purchase` true/false/all.

Tous les filtres sérialisés dans l'URL (`?flags=face_detected&source=email_j45&from=2026-04-01`). Partageable, bookmarkable, revisitable.

**Pourquoi**

1. **Triage qualifié** : au-delà de 50 rituels en queue, retrouver « les rituels suspects de la semaine dernière » est impossible sans filtres.
2. **Audit ciblé** : permet d'isoler rapidement les soumissions d'un même auteur ou d'un même batch d'import quand une anomalie est repérée.
3. **Persistance URL** : Souheila peut bookmarker une vue récurrente (« mes rituels en attente avec face détecté ») et y revenir directement.

**Indicateurs d'impact**

- Temps moyen pour retrouver un rituel spécifique : -80 %.
- Taux de modération par batch homogène : augmente (Souheila peut traiter tous les `import_csv` ensemble).

**Effort** — 2 jours (UI filtres + query Drizzle étendue + tests).

**Dépendances** — Index Postgres composite sur `(status, source, created_at)` pour ne pas dégrader les perfs.

---

### Proposition 4 — Recherche full-text sur le body et l'auteur

**Description** — Champ de recherche au-dessus des tables admin :

- Cherche dans `body`, `body_original`, `author_first_name`, `author_city`.
- Backend : `ILIKE '%query%'` pour < 100 résultats, puis migration vers `tsvector + tsquery` (index GIN) si volume justifie.
- Highlight des matches dans l'aperçu citation.

**Pourquoi**

1. **Réactivité aux signalements** : quand une utilisatrice écrit à `info@femiglow-maroc.com` en mentionnant un mot clé de son rituel, Souheila doit pouvoir le retrouver instantanément.
2. **Audit qualitatif** : permet de chercher « est-ce qu'on a publié des rituels mentionnant "miracle" / "guérit" / "promesse" » pour vérifier la conformité éditoriale.
3. **Préparation au volume** : à 500+ témoignages, parcourir manuellement n'est plus tenable.

**Indicateurs d'impact**

- Temps pour répondre à un signalement RGPD ou commercial : < 30 secondes.
- Couverture audit conformité : 100 % par scan trimestriel.

**Effort** — 1,5 jour (UI input + debounce + endpoint search + tests).

**Dépendances** — Index `tsvector` Postgres pour > 5 000 rituels (sinon `ILIKE` suffit).

---

### Proposition 5 — Optimistic UI sur toutes les actions admin

**Description** — Actuellement, après un click « Approuver », l'admin attend la réponse réseau (200-800 ms) avant de voir l'effet. Remplacer par un pattern optimistic :

1. Mise à jour locale immédiate (status `APPROVED`, ligne grisée).
2. Appel API en arrière-plan.
3. Si erreur, rollback + toast d'erreur.
4. Si succès, validation visuelle discrète.

S'applique à : approve, reject, hide, restore, feature/unfeature, photo recheck, correction coquille.

**Pourquoi**

1. **Perception** : 200 ms perçu comme instantané, 800 ms perçu comme « lent ». Quand Souheila enchaîne 10 actions, c'est l'expérience qui fait la différence entre « fluide » et « fatigant ».
2. **Encourage le clavier** : un système réactif récompense l'usage rapide ; un système lent oblige à attendre les retours d'API.
3. **Robustesse** : le rollback en cas d'erreur est explicite, traçable, avec retry possible.

**Indicateurs d'impact**

- Temps perçu par action : -70 %.
- Taux de double-click / impatience : ~0.

**Effort** — 1 jour (refactor `RitualActionsClient` + `BulkActionBar` + ajouter `useOptimisticMutation` helper).

**Dépendances** — Aucune.

---

### Proposition 6 — Détection de doublons et de témoignages similaires

**Description** — À la soumission ET à la modération, calculer une **similarité textuelle** (cosinus sur n-grams, ou hash MinHash si on veut scalable) contre les rituels existants. Surfacer dans la vue détail :

```
⚠ Similarité 87 % avec « publié 12 avril 2026 » par cette même initiée.
[Voir l'original] [Marquer comme doublon] [Ignorer]
```

Doublons stricts (texte identique post-sanitization) → auto-flag `duplicate_strict`. Similaires forts (> 80 %) → auto-flag `duplicate_loose`. Détection inter-batches (un import duplique un rituel manuel précédent).

**Pourquoi**

1. **Qualité éditoriale** : éviter le « 12 témoignages copiés-collés depuis le formulaire de l'institut partenaire » qui dilueraient la voix maison.
2. **Sécurité anti-spam** : un acteur malveillant qui submit le même texte sous 10 identités est détecté.
3. **Curation intelligente** : permet de regrouper les rituels d'un même cluster pour décider quelle version garder.

**Indicateurs d'impact**

- Taux de rituels publiés en doublon : 0 (cible dure).
- Faux positifs : < 5 % (à mesurer sur 100 modérations test).

**Effort** — 4 jours (algorithme de similarité + index Postgres trigram + UI surfaçage + tests).

**Dépendances** — `pg_trgm` extension Postgres (à activer en migration).

---

### Proposition 7 — Mode « batch view » plein écran pour modération rapide

**Description** — Une vue dédiée `/admin/rituals/queue/sweep` qui affiche **un seul rituel à la fois en plein écran** :

```
┌─────────────────────────────────────────────────┐
│ 3 sur 12 PENDING            [Skip] [Quitter]    │
│                                                  │
│ « Trois mois et l'ongle a retrouvé sa nervure. │
│   J'ai cessé de le forcer. Je remarque que     │
│   les cuticules ont apaisé doucement. »         │
│                                                  │
│ — Amal, Rabat · Initiée février 2026             │
│ Tags : ongles plus lisses · plus de casse        │
│                                                  │
│ [Photo agrandie + rectangle face si présente]    │
│                                                  │
│ Auto-flags : aucun                               │
│                                                  │
│ ────────────────────────────────────────────     │
│ A — Approuver  · R — Rejeter (note)              │
│ H — Masquer    · S — Skip                        │
│ ←/→ — Navigation libre                            │
└─────────────────────────────────────────────────┘
```

Après chaque action, auto-advance vers le suivant. Inspiré des outils de tri photo (Lightroom) ou des inbox e-mail (Superhuman).

**Pourquoi**

1. **Focus monomaniaque** : un seul rituel à la fois élimine la friction visuelle et augmente la qualité de jugement.
2. **Vélocité maximale** : combiné avec les raccourcis clavier, traitement de 20 rituels en 3 minutes.
3. **Adapté aux pics** : après un import de 50 rituels, c'est l'outil idéal pour traiter le batch sans devenir épuisée.

**Indicateurs d'impact**

- Vélocité modération en mode sweep : 6 à 10 rituels / minute (vs 1 à 2 en mode classique).
- Taux d'approbation cohérent (pas de fatigue → décisions de meilleure qualité).

**Effort** — 3 jours (nouvelle page + composant `BatchSweepView` + transitions Framer Motion + tests).

**Dépendances** — Proposition 2 (raccourcis clavier) idéalement.

---

### Proposition 8 — Webhook sortant configurable sur événements admin

**Description** — Permettre à Souheila de configurer dans `/admin/settings/webhooks` un endpoint qui reçoit les événements clés :

- `ritual.approved` : payload `{ publicSlug, productKey, authorFirstName, signature, publishedAt }`
- `ritual.rejected` : `{ publicSlug, reason, customerHash }`
- `ritual.featured_on` / `featured_off`
- `ritual.import.committed` : `{ batchId, totalCommitted, source }`

Signature HMAC SHA-256 dans le header `X-FemiGlow-Signature`. Retry exponentiel via la table `webhook_deliveries` (déjà présente dans le projet).

**Pourquoi**

1. **Intégration CRM** : push automatique des leads validés vers HubSpot / Brevo / Mailchimp pour relance commerciale.
2. **Notifications team** : webhook vers Slack quand un rituel d'une cliente VIP est publié.
3. **Extensibilité** : la maison peut greffer n'importe quel système tiers sans modifier le code.

**Indicateurs d'impact**

- Délai de propagation vers CRM : < 5 secondes (vs imports manuels hebdo).
- Réactivité commerciale : envoyer un mot de remerciement personnalisé J+1 plutôt qu'au prochain envoi groupé.

**Effort** — 3 jours (interface webhook + signing + delivery retry + UI admin de configuration).

**Dépendances** — Tables `webhook_endpoints` et `webhook_deliveries` (déjà existantes).

---

### Proposition 9 — Insights étendus : temporel, funnel, monitoring ML

**Description** — Refonte de `/admin/rituals/insights` pour ajouter :

1. **Graph linéaire 90 jours** : soumissions / publications / rejets par jour.
2. **Comparaison période sur période** : « cette semaine vs la précédente » avec delta en %.
3. **Conversion funnel** :
   - Sessions sur `/kit` → ouvertures module → ouvertures drawer → ouvertures wizard → soumissions → publications.
   - Taux de chute par étape.
4. **Heatmap horaire** : à quel moment les initiées soumettent (probable corrélation avec l'e-mail J+45 envoyé à 10h).
5. **Top auteurs** : initiées avec plus d'un rituel partagé (rare mais à monitorer).
6. **Monitoring Vision ML** :
   - Taux de `REJECTED_FACE` / total photos.
   - Taux d'override admin (`REJECTED_FACE` → `OK` ou inverse).
   - Latence p50 / p95 du provider.
7. **Sources & batchs d'import** : volume d'imports par mois, taux d'approbation par batch.

**Pourquoi**

1. **Pilotage produit** : voir l'évolution du signal `oui` au fil du temps permet de détecter une régression qualité produit (problème de batch, défaut packaging).
2. **Optimisation conversion** : le funnel révèle si la chute principale est entre « voir le module » et « ouvrir le drawer » (problème de copy/visuel) ou entre « ouvrir wizard » et « submit » (friction de formulaire).
3. **Calibration vision ML** : un taux d'override admin > 30 % signale que le provider est trop sévère. Avec ce KPI, on calibre intelligemment.

**Indicateurs d'impact**

- Décisions produit fondées sur données : 100 % des itérations Phase 2 informées par insights.
- Calibration vision ML mesurable et itérable.

**Effort** — 4 jours (queries d'agrégation + composants charts SVG ou recharts + endpoint analytics).

**Dépendances** — Données déjà présentes dans `tracking_events_log` + `ritual_audit_log`.

---

### Proposition 10 — Modèles d'e-mails personnalisables avec preview

**Description** — Une page `/admin/rituals/email-templates` qui permet à Souheila d'éditer en Markdown les trois templates (J+45, approved, rejected-face, rejected-other, photo-rejected) avec :

- Éditeur Markdown avec preview en temps réel (split-pane).
- Variables disponibles affichées (`{{firstName}}`, `{{ctaUrl}}`, `{{wallUrl}}`).
- Test send : envoie l'e-mail à une adresse de test avec variables d'exemple.
- Versioning : `app_config_snapshots` capture chaque modification, restauration possible.

**Pourquoi**

1. **Souveraineté éditoriale** : Souheila peut ajuster le ton sans dépendre du développement.
2. **A/B test naturel** : possibilité de tester deux variantes du subject de l'e-mail J+45 et mesurer le taux d'ouverture.
3. **Saisonnalité** : adapter le wording pour Ramadan, fêtes, occasions spécifiques.

**Indicateurs d'impact**

- Taux d'ouverture e-mail J+45 : optimisable de façon empirique.
- Cycle d'itération éditoriale : minutes vs jours.

**Effort** — 3 jours (page éditeur + endpoint persistance + preview server-side + UI versions).

**Dépendances** — `app_config` et `app_config_snapshots` (déjà existants).

---

### Proposition 11 — Notifications push + digest e-mail pour Souheila

**Description** — Système de notifications sortantes vers Souheila :

1. **Push browser** (Web Push API) : nouveau rituel `PENDING` arrive → notification optionnelle.
2. **Digest e-mail quotidien** à 9 h : « 5 rituels en attente, dont 1 PRIORITÉ (face_detected). [Voir la queue] ».
3. **Alerte SLA** : si un rituel est en queue depuis > 36 h, e-mail à 9 h ; > 48 h, e-mail immédiat.
4. **Alerte anomalie** : si > 10 soumissions en 1 h, alerte (risque d'attaque ou de batch d'import non maîtrisé).
5. **Webhook Slack** : push vers Slack channel `#femiglow-rituels` (optionnel, configurable).

**Pourquoi**

1. **SLA respecté** : Souheila peut être prévenue sans devoir checker l'admin manuellement.
2. **Réactivité face aux anomalies** : une attaque spam peut être contrecarrée en quelques minutes au lieu de jours.
3. **Marketing-friendly** : les rituels les plus émotionnels peuvent déclencher une notification Slack pour partage interne.

**Indicateurs d'impact**

- Délai médian première lecture après soumission : < 2 h (heures ouvrées).
- Aucun rituel en queue > 48 h sans alerte préalable.

**Effort** — 5 jours (Web Push setup + cron digest + lib alertes + UI préférences + tests).

**Dépendances** — Provider e-mail (déjà en place), `webhook_endpoints`, paramétrage Web Push (clés VAPID).

---

### Proposition 12 — Audit log signé cryptographiquement (immutabilité prouvable)

**Description** — Étendre `ritual_audit_log` avec un champ `signature` :

```sql
ALTER TABLE ritual_audit_log
  ADD COLUMN previous_hash text,
  ADD COLUMN signature text;
```

Chaque entrée contient le SHA-256 chaîné de l'entrée précédente + son propre contenu. À l'écriture, le serveur signe avec une clé HMAC stockée hors-app (Vercel Secrets). À tout moment, on peut vérifier l'intégrité de la chaîne complète.

**Pourquoi**

1. **Conformité RGPD** : preuve cryptographique que tel rituel a bien été supprimé sur demande, telle photo rejetée pour visage.
2. **Audit légal** : en cas de litige avec un partenaire commercial ou un client (« vous m'avez rejetée injustement »), preuve qu'aucune entrée n'a été modifiée a posteriori.
3. **Détection de tampering** : si quelqu'un avec accès BDD trafique le log directement, la chaîne se casse — détectable.

**Indicateurs d'impact**

- 100 % des actions tracées et vérifiables.
- Temps de réponse aux audits externes : minutes (export du log + signature à vérifier).

**Effort** — 5 jours (migration + signing module + vérification + UI admin de visualisation + tests).

**Dépendances** — Stockage sécurisé de la clé HMAC (Vercel Secrets ou KMS).

---

## 4. Matrice impact × effort

```
Impact opérationnel
       ▲
HAUTE  │     [3]  [7]               [9]
       │ [2]      [11]
       │     [1]              [6]
MOY    │ [5]      [8]   [10]
       │     [4]
       │                          [12]
BASSE  │
       └────────────────────────────────► Effort
         < 2j         2-4j        5j+

Légende :
[1] Navigation prev/next vue détail  [7] Batch view plein écran
[2] Raccourcis clavier               [8] Webhook sortant
[3] Filtres avancés URL              [9] Insights étendus
[4] Recherche full-text              [10] Templates e-mails
[5] Optimistic UI                    [11] Notifications + digest
[6] Détection doublons               [12] Audit log signé
```

## 5. Priorisation recommandée

### Vague 1 — Quick wins (1 semaine)

À livrer en priorité, faible coût, impact immédiat sur la vélocité quotidienne :

1. **[2] Raccourcis clavier** — 1,5 j
2. **[1] Navigation prev/next** — 1 j
3. **[5] Optimistic UI** — 1 j
4. **[3] Filtres avancés URL** — 2 j

**Charge totale** : ~ 5,5 j. **Effet attendu** : Souheila modère deux fois plus vite, avec moins de frictions UX.

### Vague 2 — Investissements moyens (1,5 à 2 semaines)

À déclencher dès que la Vague 1 est en prod et que les KPI temps-de-modération sont mesurés :

5. **[7] Batch view plein écran** — 3 j (consolide la vélocité de la Vague 1)
6. **[4] Recherche full-text** — 1,5 j
7. **[9] Insights étendus** — 4 j
8. **[6] Détection doublons** — 4 j

**Charge totale** : ~ 12,5 j. **Effet attendu** : passage à l'échelle (200+ rituels gérables sans douleur), décisions produit data-driven, qualité éditoriale renforcée.

### Vague 3 — Capacités structurelles (2 à 3 semaines)

À envisager quand le volume dépasse 1 000 rituels publiés ou que des partenariats B2B émergent :

9. **[10] Templates e-mails personnalisables** — 3 j
10. **[8] Webhook sortant** — 3 j
11. **[11] Notifications + digest** — 5 j
12. **[12] Audit log signé** — 5 j

**Charge totale** : ~ 16 j. **Effet attendu** : industrialisation (intégration CRM, conformité RGPD prouvable), autonomie éditoriale Souheila.

## 6. Optimisations performance complémentaires

Indépendamment des propositions UX ci-dessus, six optimisations techniques améliorent les performances de la console admin :

### 6.1 Pagination cursor au lieu d'offset

`offset 1000 limit 25` force Postgres à parcourir les 1000 premiers rangs. Migration vers cursor `(createdAt, id)` rend la pagination O(log n) constante. À faire dès que le volume dépasse 500 rituels.

**Effort** : 0,5 j. Touche `listAdminRituals()` et les liens « page suivante ».

### 6.2 Index Postgres composites

Ajouter ces index quand les filtres avancés (P3) entrent en service :

```sql
CREATE INDEX idx_rt_status_source_created
  ON ritual_testimonials (status, source, created_at DESC);

CREATE INDEX idx_rt_autoflags_gin
  ON ritual_testimonials USING gin (auto_flags);

CREATE INDEX idx_ral_actor_created
  ON ritual_audit_log (actor_id, created_at DESC);
```

**Effort** : 0,2 j (migration). Gain : queries filtrées passent de O(n) à O(log n).

### 6.3 Cache navigateur des données admin (SWR pattern)

Actuellement, chaque navigation `queue → détail → queue` re-fetch la liste. Utiliser `@tanstack/react-query` ou `swr` côté admin (déjà disponible chez les visiteurs) avec :

- `staleTime: 30s` sur listes admin.
- Invalidation explicite après chaque mutation.

**Effort** : 1 j. Gain : navigation immédiate, charge serveur divisée.

### 6.4 Prefetch on hover

Quand Souheila survole le bouton « Voir détail » d'un rituel dans la queue, prefetch le détail en arrière-plan via `<Link prefetch>`. Affichage perçu instantané au clic.

**Effort** : 0,2 j.

### 6.5 Stream / SSE pour la queue admin (optionnel)

Pour les pics de soumissions (ex. post-newsletter J+45), Souheila peut voir les nouveaux rituels apparaître en temps réel sans refresh. Implémentation : Server-Sent Events sur `/api/admin/rituals/queue/stream`.

**Effort** : 2 j. Gain : modération en temps réel pendant les pics.

### 6.6 Refresh agrégat asynchrone

Actuellement `refreshRitualAggregate()` est appelé à chaque hit de `/admin/rituals/insights`. Passer en :

- Refresh CRON 5 min (déjà en place pour `ritual_aggregate`).
- Page insights lit en cache, marque « dernière mise à jour il y a X min ».
- Bouton « Rafraîchir maintenant » manuel disponible.

**Effort** : 0,3 j. Gain : page insights instantanée même à 10 000 rituels.

## 7. Synthèse et recommandation

L'admin actuel est **fonctionnellement complet** mais **dimensionné pour ~50 rituels par mois**. Au-delà de 200, Souheila va rencontrer :

- Une **fatigue de modération** (vélocité insuffisante sans raccourcis clavier ni batch view).
- Une **dépendance technique** pour toute itération éditoriale (e-mails, copy).
- Une **opacité opérationnelle** (pas de monitoring vision ML, pas de funnel).

La **Vague 1** (5,5 j) répond à 80 % des frictions quotidiennes pour un coût modeste. À mettre en chantier en priorité.

La **Vague 2** (12,5 j) transforme l'admin en outil de production capable d'absorber 500+ rituels et de piloter le produit par données.

La **Vague 3** (16 j) prépare le terrain pour la Phase 2 (B2B, CRM, conformité audit).

Le total des trois vagues — **~ 34 jours** — est cohérent avec un chantier de stabilisation post-MVP de 7 à 8 semaines temps-plein, ou 14 semaines mi-temps.

Aucune des propositions ne demande de nouvelle dépendance tierce lourde. Tout s'appuie sur l'infrastructure existante (`tracking_events_log`, `app_config_snapshots`, `webhook_endpoints`, `ritual_aggregate`, schémas Drizzle + memory store).
