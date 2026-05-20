# 01 — Contexte et analyse Kolenda

## 1. État actuel — inventaire technique

### 1.1 Architecture

```
app/(marketing)/kit/page.tsx
  └─ VideoPlayer4GestesBound (RSC wrapper)
       └─ VideoPlayer4Gestes (dispatcher YouTube / self-hosted)
            ├─ YouTubeVariant (iframe nocookie)
            │     └─ YouTubeEmbed
            └─ SelfHostedVariant (player HTML5, autoplay au scroll)
```

| Fichier | Rôle | Lignes |
|---|---|---|
| `apps/web/src/components/sections/VideoPlayer4Gestes.tsx` | Dispatcher + 2 variantes | 285 |
| `apps/web/src/components/sections/VideoPlayer4GestesBound.tsx` | RSC wrapper léger | — |
| `apps/web/src/components/sections/YouTubeEmbed.tsx` | Iframe `youtube-nocookie.com` | 131 |
| `apps/web/src/lib/video/youtube-url.ts` | `parseYouTubeUrl`, `buildYouTubeEmbedUrl` | — |
| `apps/web/src/lib/schemas/page-content.ts` | `RituelVideo` schema | autour de 200 |

### 1.2 Schema actuel `RituelVideo`

Champs principaux :
- `poster: Image`
- `sources: { mp4, webm }` (self-hosted)
- `captions: { fr, ar }` (WebVTT)
- `youtubeUrl?: string` (dispatcher branche dessus si présent)
- `transcript: string`

Aucun champ pour :
- `chapters[]` (mini-timeline),
- `posterCustom?` (poster overlay distinct du poster YouTube),
- `provenance?` (mention maison),
- `durationDisplay?` (badge `90″`),
- `accentColor?` (cohérence palette).

### 1.3 Tracking actuel

| Event | Source | État |
|---|---|---|
| `video_user_play` | YouTube : proxy click sur wrapper. Self-hosted : onPlay + flag `userInitiated` | ✓ |
| `video_autoplay_view` | Self-hosted : 25 % de la durée via `onTimeUpdate` | ✓ |
| `video_complete` | Self-hosted : `onEnded` | ✓ |
| `video_transcript_open` | Bouton accordéon | ✓ |
| `video_complete` côté YouTube | **manquant** (pas d'IFrame API) | ✗ |
| `video_25%`/`video_50%`/`video_75%` côté YouTube | manquant | ✗ |
| `video_chapter_click` | inexistant | ✗ |

### 1.4 Tests existants

| Fichier | Couverture |
|---|---|
| `VideoPlayer4Gestes.test.tsx` | Variantes YouTube/self-hosted, tracking baseline |
| `YouTubeEmbed.test.tsx` | Parsing URL, ratio, attributs iframe |
| `lib/video/youtube-url.test.ts` | `parseYouTubeUrl` (watch?v=, /shorts/, /embed/) |

Couverture : ≈ correcte sur les chemins existants, **aucun test** sur les nouveaux composants à venir.

## 2. Recommandations Kolenda — section 4.4

Citation playbook (`docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` §4.4) :

> **Objectif** : faire vivre l'application en 90 secondes, instancier le rituel.
>
> **Recommandations** :
> - **Poster** : frame d'action (pinceau sur l'ongle ou polissage), pas une main figée.
> - **Démarrage** : léger zoom in 2-3 s (looming).
> - **Loop ralenti** sur la version sans son.
> - **Bouton play 60 × 60 px** centré.
> - **Sous-titres FR** par défaut (mobile sans son).
> - **Skeleton loader** au chargement. Pas de spinner.
> - Transcription en accordéon replié par défaut, intitulé « Lire la transcription ».
>
> **Anti-patterns** : autoplay avec son ; vidéo trop longue (> 120 s) ; transitions snappy entre plans.

Principes activés :

- **Attention §4** Dynamic imagery — poster d'action plutôt qu'un visage figé.
- **Attention §5** Looming motion — zoom doux d'ouverture pour capter l'œil.
- **Luxury §7** Slow motion — cadence lente, pas snappy.
- **UX §8** Minimize waiting — skeleton screens, jamais de spinner.
- **UX §13** Induce sensation — texte décrit le geste physique.
- **Color §1** Pas de pop chaud hors CTA final → bannir le rouge YouTube agressif.
- **Copywriting §46-47** — durées d'expérience en lettres (« quatre-vingt-dix secondes »).

## 3. Forces actuelles à préserver

| # | Force | Référence |
|---|---|---|
| F1 | Transcription accordéon replié | §4.4 reco directe |
| F2 | H2 takeaway clair (« Cinq gestes, en un seul plan. » — à arbitrer 4 vs 5) | UX §3 |
| F3 | Sous-titre concret avec durée en lettres | Copywriting §46-47 |
| F4 | Privacy-friendly iframe (`youtube-nocookie.com`, `rel=0`, `modestbranding=1`) | Hors Kolenda — bonus RGPD |
| F5 | Lazy loading iframe | UX §8 |
| F6 | A11y robuste (`aria-labelledby`, `aria-expanded`, focus-visible) | §2.4 + WCAG |
| F7 | Pas d'autoplay avec son | §4.4 anti-pattern |
| F8 | Variante `SelfHostedVariant` déjà implémentée (tracking précis, IntersectionObserver) | Réutilisable pour phase 7 |

## 4. Faiblesses observées — findings priorisés

### P0 — Quick wins iframe (sans changer la source)

| ID | Item | Référence | Effort |
|---|---|---|---|
| F-01 | Cohérence titre H2 (« 4 gestes » au lieu de « 5 ») | Édito cohérence | 5 min |
| F-02 | `mute=1` + `cc_load_policy=1` + `cc_lang_pref=fr` forcés dans embed URL | §4.4 captions par défaut | 15 min |
| F-03 | Fond `bg-creme-warm` → sable `#EFE9DD` ou sauge pâle `#E8EDE3` (rythme) | §2.4 | 5 min |
| F-04 | Provenance maison italique sous le sous-titre (sans nommer personne) | Luxury §6 | 30 min |
| F-05 | CTA post-vidéo `Voir le pack ci-dessous ↓` vers `#commander-femiglow` | Ecommerce §14 | 30 min |

### P1 — Poster custom + chapitres + tracking

| ID | Item | Référence | Effort |
|---|---|---|---|
| F-06 | Schema `RituelVideo` étendu : `chapters[]`, `posterCustom?`, `provenance?`, `durationDisplay?` | §03 | 0,5 j |
| F-07 | `VideoPosterCover` : poster maison + bouton play 64×64 sauge — masque le visage tiers et le bouton rouge YouTube | §4.4 « bouton play 60×60 centré » + Color §1 | 1 j |
| F-08 | `VideoChapters` : mini-timeline 4 segments cliquables qui scrubent (`?t=...s`) | Attention §53 (goal-directed) | 1 j |
| F-09 | IFrame API YouTube → `video_complete` + 25/50/75 % | Funnel analytics | 0,5 j |
| F-10 | Skeleton blur-up sur le poster | UX §8 | 0,5 j |

### P2 — Admin éditeur

| ID | Item | Effort |
|---|---|---|
| F-11 | Éditeur `/admin/kit/video` : URL YouTube, chapitres, provenance, poster custom upload | 2 j |

### P3 — Migration structurelle

| ID | Item | Effort |
|---|---|---|
| F-12 | Migration vers self-hosted (variante déjà codée) | 3 j dont 1 j DA master |
| F-13 | Toast `video_complete` → scroll auto vers `#commander-femiglow` | 1 j |

### P4 — Confort et scale

| ID | Item | Effort |
|---|---|---|
| F-14 | A/B test placement vidéo (avant vs après composition) | 1 j |
| F-15 | Visual regression Playwright (poster, bouton play) | 0,5 j |
| F-16 | Storybook stories pour les 3 sous-composants | 0,5 j |

## 5. Hypothèses retenues

- **Master vidéo self-hosted** : production externe, livré sous 2-3 semaines. La migration phase 7 attend cette livraison ; phases 0-6 sont indépendantes et tournent sur l'iframe YouTube actuelle.
- **Mock TS reste source de vérité** court terme. Sanity est planifié, hors scope ici.
- **Schema additif et rétrocompatible** : tous les nouveaux champs (`chapters`, `posterCustom`, `provenance`, `durationDisplay`) sont optionnels. Le composant fonctionne sans qu'ils soient remplis.
- **Pas d'introduction de dépendance lourde** : on n'ajoute pas YouTube IFrame API en module npm ; on charge le script à la demande (~3 kB) seulement quand le user clique sur play.
- **`SelfHostedVariant` n'est pas supprimée** : elle reste l'objectif structurel (phase 7). On factorise les nouveaux sous-composants (`VideoPosterCover`, `VideoChapters`) pour qu'ils s'appliquent aux deux variantes.

## 6. Risques identifiés

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Click-to-play overlay casse l'autoplay attendu sur la variante self-hosted | Moyen | Moyen | Le composant `VideoPosterCover` est piloté par prop `mode='click-to-play' \| 'native'` ; self-hosted reste en mode `native` avec IntersectionObserver |
| IFrame API tiers ajoute des cookies Google | Faible | Élevé | Charger uniquement `youtube.com/iframe_api` (pas `widget_api`), conditionner au consentement `analytics_storage` |
| Migration self-hosted bloquée par DA | Élevé | Moyen | Plan d'action phases 0-6 indépendantes. Phase 7 reste isolée et activable plus tard |
| Régression sur les tests existants | Moyen | Faible | Snapshot DOM avant chaque phase ; tests existants conservés |
| Chapitres ne s'alignent pas si vidéo source mise à jour | Moyen | Faible | Validation Zod sur `startSeconds` ≤ durée totale (pas critique, juste alerte admin) |
| Performance : iframe + IFrame API + chapters + poster custom = bundle JS lourd | Faible | Moyen | Mesure WebVitals : LCP cible ≤ 2,5 s ; le poster custom remplace l'iframe initial (LCP allégé) |

## 7. Sources

- Playbook Kolenda : `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` §4.4, §2.3, §2.4, Annexe A.
- Inventaire code : `apps/web/src/components/sections/VideoPlayer4Gestes.tsx`, `YouTubeEmbed.tsx`, `lib/video/youtube-url.ts`.
- Tracking funnel : `docs/analytics/03-events-funnel-audit.md` §6.1.
- Dossier précédent composition : `docs/composition-reveal-optim-2026-05/` — mêmes conventions de plan.
