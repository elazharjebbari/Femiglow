# 08 — Console admin

> *Instructions, sources, KPIs, gestion conversations, design, audits, exports*

---

## 1. Arborescence

```
/admin/chat
├── /                    Vue d'ensemble (KPIs principaux)
├── /conversations
│   ├── /                Liste paginée + filtres + recherche
│   └── /:sessionId      Lecture intégrale + actions
├── /kpis                KPIs étendus, segmentation
├── /instructions
│   ├── /                Liste versions
│   └── /:id             Édition + diff + activation
├── /sources             Knowledge base : sources + chunks
├── /providers           Configurations modèles
├── /themes              Presets de style + salutations
├── /lang/dictionaries   Dictionnaires darija
├── /experiments         A/B tests (Phase 2)
├── /audit               Audit log
└── /system              Visualisation graphique du système
```

Routes Next.js dans `app/(admin)/chat/...`. Auth `iron-session`
existant + rôle `chat-admin`.

## 2. Vue d'ensemble — `/admin/chat`

Synthèse exécutive en 6 cartes, en haut. Chaque carte exposable
sur fenêtre temporelle (`today`, `yesterday`, `7d`, `30d`, `90d`,
`custom`, `all`).

```
┌─────────────────────┬─────────────────────┬─────────────────────┐
│  Sessions ouvertes  │  Engagement         │  Conversion chat    │
│  342                │  58 %               │  6.2 %              │
│  +14 % vs hier      │  +3 pts vs hier     │  +0.8 pts vs hier   │
├─────────────────────┼─────────────────────┼─────────────────────┤
│  Médiane msg/conv   │  Latence first-token│  Coût provider      │
│  4.3                │  890 ms             │  3.42 €             │
└─────────────────────┴─────────────────────┴─────────────────────┘
```

Sous les cartes :

- Courbe **sessions / messages / conversions par jour** (sélecteur
  granularité hour / day / week).
- **Top 5 intentions** (par volume, par conversion).
- **Top 5 sources RAG** citées.
- **Heatmap heures × jours** des ouvertures du widget.
- **Alerts** récentes (provider tombé, quota proche…).

## 3. Conversations — `/admin/chat/conversations`

### 3.1 Liste

Colonnes :

| Colonne                   | Notes                                                          |
| ------------------------- | -------------------------------------------------------------- |
| Statut                    | open / idle / archived / purged                                |
| Date / heure              | locale Casablanca, RTL-aware                                   |
| Durée                     | format `12 m 34 s`                                             |
| Messages                  | chiffre + barre fine de répartition user / agent               |
| Langue                    | badge `FR` / `AR` / `Darija`                                   |
| Page d'origine            | path                                                           |
| Intention dominante       | calculée                                                       |
| Satisfaction              | mean feedback                                                  |
| Conversion                | badge `convertie` / `–`                                        |
| Catégorie auto            | court / moyen / long / abandon précoce                         |

### 3.2 Filtres

- Période (today / yesterday / 7d / 30d / 90d / custom / all)
- Langue
- Page d'origine
- Conversion : oui / non / toutes
- Satisfaction : positive / négative / sans
- Durée : `< 30 s`, `30-120 s`, `2-5 min`, `> 5 min`
- Nombre de messages : `1`, `2-3`, `4-10`, `> 10`
- Provider utilisé
- Variant A/B
- Présence d'erreur

### 3.3 Recherche

- **Plein texte** sur `content` (index GIN tsvector) — score
  pertinence + mise en évidence des occurrences.
- **Recherche sémantique** (Phase 2) sur les embeddings de
  conversation (champ `meta_summary`).

### 3.4 Détail conversation — `/admin/chat/conversations/:id`

```
┌────────────────────────────────────────────────────────────────────┐
│  cs_xxxx · 2026-05-06 14:02 → 14:18  · FR · /kit · convertie        │
│                                                                    │
│  Métadonnées :                                                     │
│  - visitor_id    : (anonyme)                                       │
│  - referrer      : google.fr                                       │
│  - utm           : utm_source=instagram                            │
│  - device        : iPhone Safari                                   │
│  - provider      : OpenAI gpt-4o-mini                              │
│  - variant       : control                                         │
│  - cost          : 0.034 €                                         │
│  - latency p50   : 780 ms                                          │
│                                                                    │
│  Conversation                                                      │
│  ─────────────────────────────────────────────                     │
│  [user 14:02]   bonjour, c'est quoi ce rituel ?                    │
│  [agent 14:02]  ... (sources : ck_001, ck_023)                     │
│  [user 14:03]   ça dure combien ?                                  │
│  [agent 14:03]  ... (sources : ck_005)                             │
│  ...                                                               │
│                                                                    │
│  Actions :                                                         │
│  [Marquer comme exemple] [Exporter JSON] [Droit à l'oubli]         │
│  [Renvoyer email reprise] [Bannir visiteur]                        │
└────────────────────────────────────────────────────────────────────┘
```

Chaque bulle propose : **voir les sources RAG**, **voir le prompt
final reconstruit**, **voir la trace OTel**, **réécrire la réponse**
(audit qualité hors-temps-réel).

## 4. KPIs étendus — `/admin/chat/kpis`

### 4.1 Sections

| Section                | Contenu                                                                |
| ---------------------- | ---------------------------------------------------------------------- |
| Engagement             | ouvertures, démarrages, médiane msg, durée, abandon précoce             |
| Conversion             | rate, lift, panier moyen, délai, top intentions converties             |
| Qualité                | satisfaction, hors-charte rate, hallucination audit, % bonne langue    |
| Performance            | latence first-token p50/p95, latence full p50/p95, taux erreur, fallbacks |
| Coût                   | par session, par message, par provider, projection mensuelle           |
| Langues                | répartition par langue, taux switch, RTL completion                     |
| RAG                    | hits / message, top sources citées, sources jamais citées               |

### 4.2 Sélecteur de fenêtre

```
┌──────────────────────────────────────────────────────┐
│  [Aujourd'hui] [Hier] [7j] [30j] [90j] [Tout] [Custom: __ → __] │
└──────────────────────────────────────────────────────┘
```

Toutes les vues KPI rebrancent sur la même fenêtre. Persisté en
URL search params (`?window=30d`).

### 4.3 Export

Bouton « Exporter CSV » sur chaque section. Exports horodatés,
nom de fichier `chat_kpis_<section>_<window>_<isoTS>.csv`.

## 5. Instructions — `/admin/chat/instructions`

### 5.1 Liste

```
v12  active   par défaut  scope: default     créée 2026-05-04 14:21 par elazhar
v11  archive               scope: default     créée 2026-04-28 09:10 par elazhar
v10  archive               scope: default     ...
```

### 5.2 Édition

Trois zones onglets : **FR**, **AR**, **Darija**.

```
┌─ Instruction (FR) ──────────────────────────────────────────────┐
│ Tu es l'hôtesse de FemiGlow, une maison marocaine de soin       │
│ pour les ongles. ...                                            │
│                                                                 │
│  ─── 8 chunks · 1 230 tokens · cost estimé /msg : 0.0021 €      │
└─────────────────────────────────────────────────────────────────┘

[Diff vs v12 active]   [Notes de changelog]   [Tester en sandbox]
[Activer cette version]
```

L'onglet **Tester en sandbox** ouvre un mini-chat qui consomme
cette version sans l'activer, sans toucher aux KPIs publics.

### 5.3 Activation

Bouton « Activer ». Audit log :
`chat.instruction.activate v=13 prev=12 by=admin@x`.

Hot reload : `revalidateTag('chat-config')` ⇒ les nouvelles
sessions reçoivent v13. Les sessions ouvertes terminent leur
turn courant en v12 puis basculent.

## 6. Sources & RAG — `/admin/chat/sources`

### 6.1 Liste

| Label                     | Type      | Langue | Tags         | Fraîcheur | Chunks | Maj           | Actif |
| ------------------------- | --------- | ------ | ------------ | --------- | ------ | ------------- | ----- |
| Page kit                  | url       | FR     | kit, prix    | volatile  | 6      | 2 jours       | ✓     |
| Page rituel               | url       | FR     | rituel       | evergreen | 14     | 5 jours       | ✓     |
| FAQ COD                   | faq       | FR     | livraison    | volatile  | 3      | 1 jour        | ✓     |
| Composition (PDF)         | pdf       | FR     | ingrédients  | evergreen | 9      | 30 jours      | ✓     |
| Page kit AR               | url       | AR     | kit          | volatile  | 6      | 2 jours       | ✓     |

### 6.2 Édition d'une source

Formulaire :

- Label
- Type (url, markdown, pdf, docx, faq, snippet)
- Locator (URL ou upload blob)
- Langue
- Tags
- Audience (public, b2b, all)
- Fraîcheur (evergreen, seasonal, volatile)
- Activation

Boutons :
- **Inspecter chunks** (modal listant les chunks générés, leur
  taille, leur metadata).
- **Re-ingérer** (déclenche pipeline d'ingestion).
- **Désactiver** (chunks restent en DB jusqu'à purge mensuelle).
- **Supprimer** (purge immédiate).

### 6.3 Ingestion

UI live :

```
[Re-ingérer] cliqué ─► poll job
   ┌──────────────────────────────────────────┐
   │ Étape 1/4 : fetch source                 │
   │ Étape 2/4 : split en chunks (12 chunks)  │
   │ Étape 3/4 : embedding (provider OpenAI)  │
   │ Étape 4/4 : upsert pgvector              │
   │                                          │
   │ Terminé en 4.2 s · 12 chunks · 0.001 €   │
   └──────────────────────────────────────────┘
```

## 7. Providers — `/admin/chat/providers`

### 7.1 Liste

Tableau avec rôle (chat / embedding / moderation / rerank), priorité,
modèle, état (✓ / ⚠ / ✕), quota mensuel consommé, dernier ping.

### 7.2 Ajouter / éditer

```
Type            : [OpenAI ▾]
Label           : « OpenAI primaire »
Rôle            : [chat ▾]
Priorité        : [10]
Activé          : ✓
Modèle chat     : [gpt-4o-mini ▾]
API base URL    : (vide pour défaut)
Clé API         : ●●●●●●●● [Coller] [Tester]
Headers         : (JSON, vide)
Paramètres      : { temperature: 0.4, top_p: 0.95, max_tokens: 600, timeout: 8000 }
Quota mensuel   : 200 €
Egress autorisé : ✓ (envoi de PII en clair vers ce provider après redaction)
```

### 7.3 Tester

Bouton **Tester** lance un appel `chat.completions` court (« réponds 'pong' en 5 mots »)
sur l'API du provider. Résultat affiché : statut HTTP, latence,
tokens, message renvoyé.

### 7.4 Politique de fallback

```
chat       :  P1 OpenAI gpt-4o-mini   →  P2 Gemini 1.5-flash  →  P3 Qwen 2.5-7b  →  offline
embedding  :  P1 OpenAI 3-small        →  P2 Gemini text-embedding-004
moderation :  P1 OpenAI moderation     →  P2 heuristique locale
```

Affichée graphiquement dans `/admin/chat/system` (cf. doc 11).

## 8. Thèmes & style — `/admin/chat/themes`

### 8.1 Édition de preset

Trois onglets :

1. **Tokens** — couleurs, typographies, rayons, ombres (cf. doc 05).
2. **Layout** — position desktop, mobile, breakpoints.
3. **Motion** — durées, easings, humanize on/off, valeurs.
4. **Salutations & suggestions** — tableau par `pathPattern`, `timeWindow`, langue.

Aperçu en direct (iframe `/components/chat/preview` qui consomme
le preset draft sans le persister).

Boutons :
- Appliquer comme preset par défaut
- Dupliquer
- Marquer comme A/B variant
- Exporter JSON

## 9. Lang dictionaries — `/admin/chat/lang/dictionaries`

Édition CRUD du dictionnaire darija (caractères arabes + latin),
avec versionning. Chaque édition crée une nouvelle version,
seule la dernière est utilisée par la détection.

## 10. Audit log — `/admin/chat/audit`

Liste filtrable par acteur, action, entité, période. Exemples
d'actions journalisées :

| Action                           | Entité                  |
| -------------------------------- | ----------------------- |
| `chat.instruction.create`        | instruction version     |
| `chat.instruction.activate`      | instruction version     |
| `chat.source.create`             | source                  |
| `chat.source.update`             | source                  |
| `chat.source.delete`             | source                  |
| `chat.source.reindex`            | source                  |
| `chat.provider.create`           | provider config         |
| `chat.provider.update`           | provider config         |
| `chat.provider.test`             | provider config         |
| `chat.theme.update`              | theme preset            |
| `chat.session.forget`            | session (RGPD)          |
| `chat.visitor.ban`               | visitor                 |
| `chat.lang.dictionary.update`    | dictionary              |
| `chat.experiment.create`         | experiment              |

Chaque ligne d'audit montre `actor`, `at`, `requestId`, `diff`,
`ip`, `userAgent`.

## 11. Permissions

| Rôle               | Pages accessibles                                                               |
| ------------------ | ------------------------------------------------------------------------------- |
| `chat-admin`       | Toutes                                                                          |
| `chat-editor`      | Instructions, Sources, Themes, Lang, KPIs (lecture)                              |
| `chat-viewer`      | KPIs, Conversations (lecture sans détail PII brute), Audit (lecture)             |
| `support-agent`    | Conversations (lecture / réponse manuelle Phase 2)                               |

L'ACL est portée par le système admin existant.

## 12. UX patterns réutilisés

- Dense table (densité haute par défaut, switch « confortable »).
- Panneau latéral pour détails (jamais de modale plein écran sauf
  ingestion).
- Toasts discrets (succès, erreur, info).
- Empty states éditoriaux (« la maison n'a encore rien à dire ici.
  ajoute une source pour commencer. »).
- Loaders non-intrusifs (souffle 1.4 s).

## 13. Performance attendue

| Page                                  | Cible TTI |
| ------------------------------------- | --------- |
| `/admin/chat`                         | < 700 ms  |
| `/admin/chat/conversations` (50 pag.) | < 900 ms  |
| `/admin/chat/conversations/:id`       | < 600 ms  |
| `/admin/chat/kpis`                    | < 800 ms  |
| `/admin/chat/sources`                 | < 700 ms  |

Les KPIs sont servis par la vue matérialisée `chat_kpi_window`
(refresh 5 min) — pas de recompute à la requête.

## 14. Lecture suivante

- [11 — Visualisation système](11-visualisation-systeme.md) pour
  l'écran `/admin/chat/system`.
- [09 — RAG](09-knowledge-base-rag.md) pour le détail de l'ingestion.
- [13 — Sécurité](13-securite-rgpd-moderation.md) pour le droit
  à l'oubli.
