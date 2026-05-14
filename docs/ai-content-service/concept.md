# Service de Contenu IA — Document Conceptuel

## Contexte Global

**Femiglow** est une application e-commerce de soins pour ongles (nail care), développée en Next.js 14 avec PostgreSQL, Drizzle ORM, et déployée en bare-metal sur un VPS via systemd + OpenLiteSpeed. L'app intègre déjà un chatbot IA (LangChain + OpenAI), un système de tracking avancé, un CMS de composants, et une gestion média complète.

**L'objectif** est d'ajouter à Femiglow un **service intégré de création et publication automatique de contenu sur les réseaux sociaux**, alimenté par l'IA.

---

## Infrastructure Existante

### Postiz — Plateforme de Publication Sociale

**URL** : `https://postiz.lumiereacademy.com`
**Déploiement** : Docker Compose (4 conteneurs : app, PostgreSQL, Redis, worker) dans `/opt/postiz/`
**Reverse proxy** : OpenLiteSpeed avec SSL

**Comptes connectés** :
- Instagram — AlFenna Beauty (`cmojqpv290003oo78n2xpn4a7`)
- Instagram — 2 autres comptes
- Facebook — Pages associées

**API publique** (clé API par organisation) :
- `GET /api/public/v1/integrations` — Liste les comptes sociaux connectés
- `POST /api/public/v1/upload` — Upload une image
- `POST /api/public/v1/posts` — Créer / programmer un post
- `GET /api/public/v1/posts` — Lister les posts existants

**Authentification** : clé API par organisation (ZONEX / Lumiere Academy)

**Modifications apportées à Postiz** :

1. **Patch Cloudinary** (`docker-entrypoint-wrapper.sh`)
   - Instagram/Meta bloque les URLs CDN non reconnues (erreur 2207052)
   - Le wrapper remplace les URLs `cdn.lumiereacademy.com` par les URLs natives `res.cloudinary.com`
   - Exécuté avant chaque démarrage du conteneur

2. **Proxy de signature R2** (`r2-proxy.py` + systemd `r2-signing-proxy`)
   - Signe les URLs d'upload vers Cloudinary R2 avec les bons secrets
   - Nécessaire pour que Postiz puisse uploader les médias

3. **Config Instagram** : `INSTAGRAM_USE_RESUMABLE_UPLOAD=false`
   - L'upload résomable Meta est buggé en mode app développement

### Femiglow — Stack Technique

- **Frontend** : Next.js 14 (App Router, React Server Components)
- **Backend** : API Routes + Server Actions
- **Base de données** : PostgreSQL 16 + Drizzle ORM (107 tables)
- **IA** : LangChain multi-provider (OpenAI, Anthropic, Gemini, Mistral, Ollama)
- **Média** : Système complet de gestion médias (table `media`, `media_jobs`, `media_variants`)
- **Déploiement** : systemd + Gunicorn, ports 8010 (prod) / 8012 (staging)
- **Domaines** : `femiglow-maroc.com` (prod), `staging.femiglow-maroc.com` (staging)

---

## Service de Contenu IA — Vision

### Objectif

Créer un **module intégré à Femiglow** capable de :
1. **Générer** du contenu texte + image via l'IA (GPT-4o pour le texte, DALL-E / Flux pour les images)
2. **Publier** automatiquement sur les réseaux sociaux via l'API Postiz
3. **Programmer** les publications (créneaux optimaux, fréquence configurables)
4. **Suivre** les performances et ajuster le contenu en boucle de feedback

### Format de Post via l'API Postiz

```json
{
  "type": "schedule",
  "shortLink": false,
  "date": "2025-05-15T10:00:00Z",
  "tags": [{"value": "nailcare", "label": "Nail Care"}],
  "posts": [
    {
      "integration": {"id": "cmojqpv290003oo78n2xpn4a7"},
      "value": [
        {
          "content": "Texte de la publication générée par IA...",
          "image": [
            {
              "id": "media-uuid",
              "path": "https://res.cloudinary.com/..."
            }
          ]
        }
      ],
      "settings": {
        "__type": "instagram",
        "post_type": "post"
      }
    }
  ]
}
```

### Types de posts supportés
- **Instagram** : post, story, reel
- **Facebook** : post, story

### Coût estimé par post
- Texte (GPT-4o) : ~$0.01-0.02
- Image (DALL-E 3) : ~$0.04-0.06
- **Total** : ~$0.05-0.08 par post

---

## Architecture Proposée (5 Phases)

### Phase 1 — Module Content IA
- Nouveau module dans `apps/web/src/lib/content/`
- Génération de texte via GPT-4o avec prompts spécialisés nail care / beauté
- Génération d'images via DALL-E 3
- Stockage en base (table `content_generations` à créer)

### Phase 2 — Bridge Postiz
- Service `PostizBridge` pour communiquer avec l'API publique
- Upload média → création de post → programmation
- Gestion des erreurs et retry

### Phase 3 — Dashboard Admin
- Interface dans le dashboard Femiglow existant
- Prévisualisation du contenu généré avant publication
- Édition manuelle + approbation
- Configuration des comptes et horaires

### Phase 4 — Cron de Publication
- Tâches planifiées (créneaux optimaux)
- Gestion de la file d'attente
- Publication automatique ou avec validation humaine

### Phase 5 — Boucle de Feedback
- Suivi des performances (likes, portée, engagement)
- Ajustement automatique des prompts selon les résultats
- A/B testing des visuels et textes

---

## Limitations Connues

- Les tokens Facebook/Instagram expirent tous les 60 jours — renouvellement manuel
- L'app Facebook est en mode développement — seuls les testeurs peuvent publier
- L'API Postiz ne supporte pas encore les commentaires/réponses automatiques
- Les analytics détaillés ne sont pas exposés par l'API Postiz publique
- `INSTAGRAM_USE_RESUMABLE_UPLOAD` doit rester `false`

---

## Décisions à Prendre

- Module intégré dans `apps/web` ou microservice séparé ?
- Quels providers IA prioriser pour les images (DALL-E vs Flux vs Runway) ?
- Publication 100% automatique ou avec validation humaine obligatoire ?
- Quelle phase commencer en premier ?