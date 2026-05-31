# 07 — Proposition finale : « Rituels partagés »

> Mur de témoignages d'initiées, intégré à la fiche `/kit` sous forme de **drawer narratif** + **module compact 3 cartes** au-dessus de pli. Soumission via wizard 3 étapes, accessible depuis le wall ou depuis l'e-mail J+45 envoyé à chaque initiée. Modération humaine 24 à 48 h, signal de retour Oui / Hésite / Pas pour moi (jamais d'étoiles), tags qualitatifs.

Cette proposition est la synthèse du choix arbitré dans `prototypes/matrice-comparative.md`. Elle décrit le composant **dans sa version cible** — l'implémentation détaillée figure dans les documents 08 à 18.

## 1. Promesse en une phrase

**Donner à chaque initiée qui hésite sur `/kit` la sensation que la maison existe — non par étoiles, mais par voix.**

## 2. Schéma général

```
┌───────────────── Page /kit ──────────────────┐
│                                              │
│  Hero produit · Composition · Vidéo · etc.   │
│                                              │
│  ┌──── Module compact 3 cartes ────┐         │
│  │   LES VOIX DE LA MAISON         │         │
│  │   26 initiées · 24 reviendraient │         │
│  │  [card][card][card]              │         │
│  │  Lire les 26 rituels partagés → │         │
│  └─────────────────────────────────┘         │
│                                              │
│  Comparatif · FAQ · Témoignages · CTA       │
└──────────────────────────────────────────────┘
                       │
                       ▼ (clic « Lire les 26 »)
┌────────────── Drawer Rituels partagés ───────┐
│  RITUELS PARTAGÉS                            │
│  Les voix de la maison                       │
│  26 initiées ont partagé · 24 reviendraient  │
│  Ongles plus lisses · Plaque souple · Halal  │
│  ──────────                                  │
│  Tous · Avec photos · Halal · Récents        │
│  ──────────                                  │
│  [card][card]...                             │
│  [Afficher plus 12 / 26]                     │
│  ──────────                                  │
│  Partager mon rituel →                       │
│  [Recevoir le pack — 199 dh]                 │
└──────────────────────────────────────────────┘
                       │
                       ▼ (clic « Partager mon rituel » OU lien e-mail J+45)
┌────────── Wizard de soumission (3 étapes) ───┐
│  Étape 1 · Votre rituel                      │
│  Étape 2 · Détails                           │
│  Étape 3 · Vous                              │
│  Confirmation                                │
└──────────────────────────────────────────────┘
                       │
                       ▼ (status: PENDING)
┌────────── Admin /admin/rituals (queue) ──────┐
│  Queue de modération · Détail · Actions      │
│  Approve / Reject / Hide / Featured          │
└──────────────────────────────────────────────┘
                       │
                       ▼ (status: APPROVED)
                  Visible sur le wall
```

## 3. Quatre surfaces

| Surface | Localisation | Rôle |
| --- | --- | --- |
| **Module compact** | `/kit`, entre composition et comparatif | Proof immédiate + ouverture du drawer |
| **Drawer wall** | Ouvert depuis le module ou le lien d'entrée | Consultation complète des témoignages |
| **Wizard** | Bascule dans le drawer ou route e-mail | Soumission d'un nouveau témoignage |
| **Admin** | `/admin/rituals` | Modération, curation, audit |

## 4. Le module compact (`/kit`)

### 4.1 Position

Entre la section composition (1 paste / 2 powder / polissoir) et le comparatif vernis vs rituel. **Au-dessus du pli sur desktop** pour la majorité des viewports. Voir `09-interface-publique.md` pour les mesures précises.

### 4.2 Contenu

```
              LES VOIX DE LA MAISON

       26 initiées ont partagé. 24 reprendraient le rituel.

╌╌╌╌◆╌╌╌╌

┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ photo 240   │  │ photo 240   │  │ pas de      │
│             │  │             │  │ photo       │
│ « Trois...» │  │ « Cinq...»  │  │             │
│ — Amal,     │  │ — Yasmine,  │  │ « Je ne...» │
│   Rabat     │  │   Rabat     │  │ — Sara,     │
│ Initiée     │  │ Initiée     │  │   Marrakech │
│ fév. 2026   │  │ mars 2024   │  │ Initiée     │
│             │  │             │  │ janv. 2026  │
│ ongles plus │  │ rituel      │  │ plus de     │
│ lisses      │  │ devenu      │  │ casse       │
│             │  │ habitude    │  │             │
└─────────────┘  └─────────────┘  └─────────────┘

       Lire les 26 rituels partagés →
```

### 4.3 Curation

3 cartes en `featured: boolean = true`, configurées par la maison dans l'admin. Rotation manuelle. À défaut de 3 cartes featured, fallback automatique : les 3 témoignages les plus récents avec photo et signal `oui`.

### 4.4 Interactions

- Clic sur une carte : ouvre le drawer et scroll jusqu'à la carte correspondante.
- Clic sur le lien `Lire les 26 rituels partagés` : ouvre le drawer en mode liste complète.
- Photo cliquable : ouvre la lightbox directement.

## 5. Le drawer « Rituels partagés »

### 5.1 Ouverture

- Bouton ou lien sur `/kit` (module compact + lien standalone en pied de section).
- Animation : translateX(100% → 0) ou translateY(100% → 0) mobile, 220 ms `out-soft`.
- URL : `?wall=open` push history state — permet le partage de l'état ouvert.
- Focus : se pose sur le titre `Rituels partagés` au mount.
- Trap focus : ESC ferme, click overlay ferme.

### 5.2 Sections

| Zone | Détail |
| --- | --- |
| **En-tête** | Bouton fermer (48 px), kicker `RITUELS PARTAGÉS`, titre `Les voix de la maison`, fleuron |
| **Synthèse** | « 26 initiées ont partagé. 24 reprendraient le rituel. » + 3 tags insights agrégés |
| **Filtres** | 4 chips : Tous / Avec photos / Halal / Récents |
| **Liste** | Cartes verticales paginées (12 initiales, +12 par clic) |
| **Footer sticky** | Lien `Partager mon rituel →` + CTA primaire `Recevoir le pack — 199 dh` + lien `Comment ces rituels partagés sont vérifiés →` |

### 5.3 Carte

| Élément | Contenu | Style |
| --- | --- | --- |
| Photo | 80×80 thumbnail, optionnelle, click ouvre lightbox plein écran | Bordure 1 px ligne, radius 0 |
| Citation | 30 à 80 mots | Cormorant Italic 17 pt encre |
| Signature | `Prénom, Ville` + `Initiée depuis [mois année]` | Inter 12 pt brume |
| Tags choisis | 1 à 3 tags séparés par ` · ` | Inter 12 pt sauge-dark |
| Badge « Reviendrait » | Si `would_recommend = oui` | Inter SemiBold 9 pt sauge-dark, kicker |

## 6. Le wizard de soumission

Trois étapes claires + confirmation. Détail dans `11-wizard-soumission.md`.

### 6.1 Étape 1 — Votre rituel (obligatoire)

- **Texte libre** (50 à 300 mots, validation inline non agressive).
- **Signal de retour** : trois boutons radio illustrés : `Oui, sans hésiter` / `J'hésite` / `Pas pour moi`.

### 6.2 Étape 2 — Détails (recommandée)

- **Tags rituel** : 1 à 3 cases cochées parmi une liste fermée (8 à 10 tags maison).
- **Photos** : drag & drop ou click, max 3, JPEG/PNG/HEIC, ≤ 5 Mo, compression côté client, vision ML check faces côté serveur.

### 6.3 Étape 3 — Vous (recommandée)

- **Prénom** (obligatoire).
- **Ville** (autocomplete Maroc — liste pré-définie : Rabat, Casablanca, Salé, Tanger, Marrakech, Fès, Agadir, Oujda, autres).
- **Initiée depuis** (datepicker mois + année).

### 6.4 Confirmation

```
╌╌╌╌◆╌╌╌╌

La maison reçoit votre rituel.

Nous l'ouvrirons sous 24 à 48 heures.
Vous recevrez un mot quand il sera publié.

Avec soin,
Souheila · FemiGlow
```

Le drawer se ferme automatiquement au bout de 6 secondes, ou sur clic.

## 7. L'e-mail J+45

### 7.1 Déclencheur

CRON quotidien qui sélectionne les commandes `paid` âgées de 45 jours pleins et envoie un e-mail à `customer.email`.

### 7.2 Contenu

```
Objet : Comment se porte votre rituel ?

Bonjour [Prénom],

Quarante-cinq jours sont passés depuis votre première manucure
japonaise. Cinq minutes par soir, deux gestes, un polissoir.

Auriez-vous quelques mots à partager — sur ce que vous avez
remarqué, sur ce qui a changé, sur ce qui vous a peut-être
manqué ? D'autres initiées vous lisent.

[ Partager mon rituel ]

Avec soin,
Souheila · FemiGlow
```

### 7.3 Lien du bouton

`https://femiglow-maroc.com/?wall=share&order={orderId}&hash={hmac}` — le hash est validé serveur, permet de pré-remplir `productKey`, `customerName`, `customerCity` si la maison les a stockés au checkout. L'initiée n'a plus qu'à écrire le texte.

### 7.4 Performance attendue

- Taux d'ouverture e-mail : ~30 % (référence post-purchase emails Maroc).
- CTR : ~15 %.
- Taux de soumission complète après clic : ~40 %.
- Cible : 1 témoignage soumis pour 100 commandes au démarrage. À 1 000 commandes / mois en croisière, ~10 témoignages / mois. Volume cible 100 témoignages à 12 mois.

## 8. L'admin `/admin/rituals`

### 8.1 Sections

- **Queue** — témoignages `PENDING`, triés par auto-flags (visages, emoji, mots interdits, longueur anormale).
- **Liste publiée** — tous les `APPROVED`, filtres et tri.
- **Insights** — agrégation : tags les plus mentionnés, signal global, % avec photos, fréquence des soumissions.
- **Politique** — éditeur du texte « Comment ces rituels partagés sont vérifiés ».
- **Audit** — log immuable de toutes les actions.

### 8.2 Actions sur un témoignage

| Action | Status final | Note obligatoire |
| --- | --- | --- |
| Approuver | `APPROVED` | Non |
| Rejeter | `REJECTED` | Oui (raison interne) |
| Masquer | `HIDDEN` | Oui |
| Mettre en avant (featured) | flag `featured = true` | Non |
| Retirer la mise en avant | `featured = false` | Non |
| Corriger une coquille | (correction de `body`) | Oui (texte original conservé) |

### 8.3 Vision ML faces

À l'upload de photo, un job async passe MediaPipe Face Detection :

- Aucune face détectée → photo `OK`.
- Visage de profil ou partiel (menton, sourire, hijab) → photo `MANUAL_REVIEW`, badge orange dans la queue.
- Visage frontal → photo `REJECTED_FACE`, message éditorial doux à l'initiée par e-mail.

Détail dans `17-moderation-workflow.md`.

## 9. Modèle de données (résumé)

Trois tables Drizzle + une matérialisée. Détail complet dans `08-architecture-data.md`.

```
ritual_testimonials
  ─ id, product_key, ritual_tags[], body, author_first_name?,
    author_city?, initiated_since (month/year), would_recommend
    (oui|hesite|non), is_anonymous, language, status, source,
    moderation_note, featured, customer_hash?, order_id?,
    created_at, published_at

ritual_testimonial_photos
  ─ id, testimonial_id, url, thumb_url, focal_x, focal_y,
    faces_status (ok|manual_review|rejected_face), order

ritual_testimonial_aggregate (materialized)
  ─ product_key, total_count, would_recommend_oui_count,
    with_photos_count, top_tags (jsonb), updated_at

ritual_audit_log
  ─ id, testimonial_id, actor, action, note, created_at
```

## 10. API (résumé)

| Route | Méthode | Rôle |
| --- | --- | --- |
| `/api/rituals/summary` | GET | Synthèse (volume, signal, top tags) |
| `/api/rituals/list` | GET | Liste paginée filtrée |
| `/api/rituals/submit` | POST | Soumission d'un témoignage |
| `/api/rituals/policy` | GET | Texte « Comment vérifiés » |
| `/api/admin/rituals/queue` | GET | Queue (admin) |
| `/api/admin/rituals/[id]` | GET, PATCH | Détail + actions |
| `/api/admin/rituals/[id]/photos/[photoId]/recheck` | POST | Re-run vision ML |
| `/api/cron/rituals-email-j45` | POST | CRON quotidien |

## 11. Tracking — événements clés

| Événement | Surface | Payload principal |
| --- | --- | --- |
| `ritual_module_view` | `/kit` module | `featured_ids[]` |
| `ritual_module_card_click` | `/kit` module | `testimonial_id` |
| `ritual_wall_open` | drawer | `entry_point` |
| `ritual_wall_close` | drawer | `duration_ms`, `cards_seen` |
| `ritual_wall_filter_change` | drawer | `filter_key`, `filter_value` |
| `ritual_wall_card_impression` | drawer | `testimonial_id` |
| `ritual_wall_photo_open` | drawer | `testimonial_id` |
| `ritual_wall_load_more` | drawer | `current_count` |
| `ritual_wall_cta_buy_click` | drawer | (aucun) |
| `ritual_submit_start` | wizard | `from_email` (boolean) |
| `ritual_submit_step_complete` | wizard | `step` (1/2/3) |
| `ritual_submit_success` | wizard | `has_photos`, `tag_count`, `signal` |
| `ritual_submit_error` | wizard | `error_code` |

Catalogue complet dans `16-tracking-analytics.md`.

## 12. Voix et microcopy (échantillon)

| Surface | Texte |
| --- | --- |
| Titre drawer | `RITUELS PARTAGÉS` (kicker) + `Les voix de la maison` (titre) |
| Synthèse | « 26 initiées ont partagé. 24 reprendraient le rituel. » |
| Empty state | « La maison écoute. Soyez la première à partager votre rituel. » |
| Modération info | « Publication après lecture de la maison sous 24 à 48 heures. » |
| Wizard étape 1 — placeholder body | « Décrivez ce que le rituel a changé pour vous. Cinquante mots suffisent. » |
| Wizard étape 2 — incitation photo | « Une photo aide d'autres initiées à se projeter. Mains, gestes, table de soin. » |
| Wizard étape 2 — alerte faces | « Pour préserver l'intimité de notre maison, nous publions des mains, jamais de visage de face. » |
| Confirmation soumission | « La maison reçoit votre rituel. Nous l'ouvrirons sous 24 à 48 heures. » |
| CTA pack dans drawer | `Recevoir le pack — 199 dh` / `Livraison offerte au Maroc` |
| Lien politique | `Comment ces rituels partagés sont vérifiés →` |

Catalogue complet de 40+ chaînes dans `12-microcopy-voix.md`.

## 13. Accessibilité

- WCAG 2.2 AA, focus management complet, ESC, focus trap, `aria-modal`.
- Contrastes validés sur sauge / crème (cf. `14-accessibilite-ergonomie.md`).
- `prefers-reduced-motion` respecté.
- Lecteurs d'écran : chaque carte lisible en continu.

## 14. Performance

- LCP impact négligeable (drawer chargé en lazy).
- Bundle additionnel : ≤ 30 ko CSS, ≤ 50 ko JS gzip.
- Pagination cursor-based, 12 cartes par page.
- Images : AVIF/WebP thumbnails, lazy load.
- Cache 5 min sur `/api/rituals/summary`.

Détail dans `15-performance-loading.md`.

## 15. Roadmap

Trois jalons en ~5 semaines. Détail dans `18-roadmap-execution.md`.

| Jalon | Sujets | Charge |
| --- | --- | --- |
| **J1 — Lecture publique** | Drawer + module compact + cartes + filtres + admin (queue + détail) | 12 j |
| **J2 — Soumission** | Wizard 3 étapes + e-mail J+45 + vision ML faces | 7 j |
| **J3 — Mesure** | Tracking complet + agrégation insights + A/B test | 4 j |

## 16. Définition de fini (cible) — l'engagement maison

Le wall est prêt à passer en production quand :

- 3 témoignages au minimum sont rédigés en interne (par l'équipe) avant ouverture publique — pour ne pas afficher une page vide. Ils sont marqués `source = manual` et `verified = false`.
- L'e-mail J+45 a été envoyé à 10 initiées tests (issues des commandes anciennes), au moins 2 témoignages spontanés sont rentrés.
- Les 25 heuristiques de `01-recherche-bonnes-pratiques.md` ont été vérifiées une par une.
- L'audit a11y (axe-core en CI) est vert.
- Le smoke test e2e Playwright passe : ouvrir wall → filtrer → cliquer carte → ouvrir lightbox → soumettre un rituel test → admin approuve → visible sur wall.
- La page `/kit` continue de respecter LCP < 2,5 s et CLS < 0,1 avec le module compact ajouté.

## 17. Module d'import et bulk management

Au-delà du wall et du wizard public de soumission, le composant intègre un **système d'import administratif** et un **système bulk générique** :

- **Import** : Souheila peut importer en masse des témoignages historiques (WhatsApp, ancien outil, export partenaire) via CSV, JSON, JSONL, TSV ou ZIP avec photos. Wizard 6 étapes (Source → Upload → Mapping → Preview → Commit → Rapport), preview obligatoire, rollback 24 h, vision ML systématique sur les photos. Templates téléchargeables depuis l'UI. Détail : `↗ execution/13-import-system-architecture.md` et `↗ execution/14-import-wizard-ui-specification.md`.
- **Bulk** : barre d'actions sticky sur toutes les listes admin (queue, published, archived, import preview). Approuver, rejeter, masquer, restaurer, mettre en avant, supprimer (RGPD avec tapage). Modales de confirmation. Audit double. Détail : `↗ execution/16-bulk-management.md`.

Ces deux modules ajoutent **~9 j de charge** au plan initial. Ils sont **parallélisables** avec les Jalons 1-3 (J4 dans le runbook).

## 18. Ce que cette proposition ne fait pas

- **Pas de notation étoile**, pas de note moyenne numérique. Substitué par signal ternaire + tags.
- **Pas d'emoji** dans les témoignages publiés (sanitization systématique).
- **Pas de visage frontal** dans les photos publiées (vision ML).
- **Pas de page dédiée `/rituels-partages`** au lancement (Phase 2, quand volume ≥ 50).
- **Pas d'A/B test contrôlé** au lancement (expérimentation observationnelle d'abord ; A/B contrôlé en Phase 2 si trafic suffisant).
- **Pas d'intégration tiers** (pas de Trustpilot, pas de Stamped.io). Tout est natif FemiGlow.
- **Pas de réponse publique de la maison aux témoignages** au lancement. À envisager Phase 2 si demande clients.
- **Import : pas de mise en `APPROVED` automatique**, tout passe par la modération humaine.
- **Bulk : pas de bulk sur > 1 000 rituels** simultanés (limite stricte pour préserver l'attention).

Les documents suivants (`08` à `18`) déploient chacun des aspects en détail.
