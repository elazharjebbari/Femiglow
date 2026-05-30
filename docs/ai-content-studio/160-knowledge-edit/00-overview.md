# Knowledge Edit -- Vue d'ensemble

**Module** : AI Engine / Knowledge Base  
**Feature** : CRUD complet -- ajout de UPDATE (collections + documents)  
**Version** : 1.1.0  
**Date** : 2026-05-25  
**Branche** : `feat/knowledge-edit`  
**Priorite** : P1 (bloquant pour l'exploitation quotidienne du Content Studio)

---

## 1. Contexte et motivation

Le systeme Knowledge Base de l'AI Engine permet actuellement de :

| Operation | Collection | Document |
|-----------|-----------|----------|
| **CREATE** | Nom, slug, description, categorie | Texte (titre + contenu) / URL (fetch + extraction) |
| **READ** | Liste des collections, detail par slug | Liste des documents d'une collection (titre, sourceType, chunkCount) |
| **DELETE** | Soft-delete (isActive = false) | Hard-delete (document + chunks) |
| **UPDATE** | **MANQUANT** | **MANQUANT** |

L'absence de la fonctionnalite UPDATE constitue un frein operationnel majeur :

1. **Correction d'erreurs** -- Un document ingere avec une faute de frappe dans le titre ou un contenu incomplet ne peut etre corrige qu'en le supprimant et en le re-creant manuellement.
2. **Mise a jour du contenu** -- Les fiches produits, guidelines de marque et donnees algorithmiques evoluent regulierement. Sans UPDATE, l'admin doit supprimer puis re-ingerer, perdant l'historique et generant des operations inutiles.
3. **Gestion des collections** -- Renommer une collection ou changer sa categorie est impossible sans manipuler la base de donnees directement.
4. **Visibilite** -- Le contenu complet d'un document n'est pas visible dans l'UI, rendant la verification impossible.

---

## 2. Perimetre de la feature

### 2.1 Ce qui est ajoute

| Composant | Description |
|-----------|-------------|
| **PATCH /api/admin/ai-engine/knowledge/[slug]** | Mise a jour partielle d'une collection (name, description, category) |
| **PATCH /api/admin/ai-engine/knowledge/[slug]/documents/[docId]** | Mise a jour d'un document (title, content) avec re-chunking + re-embedding |
| **GET /api/admin/ai-engine/knowledge/[slug]/documents/[docId]** | Recuperation du contenu complet d'un document |
| **updateCollection()** | Fonction service layer pour la mise a jour de collection |
| **updateDocument()** | Fonction service layer pour la mise a jour de document avec re-chunking |
| **CollectionEditForm** | Composant UI formulaire d'edition de collection (modale) |
| **DocumentEditForm** | Composant UI formulaire d'edition de document (modale) |
| **DocumentViewer** | Composant UI de visualisation du contenu complet d'un document |
| **Colonne updatedAt** | Nouvelle colonne sur les tables collection et document |
| **Tests unitaires** | 30+ cas de test Vitest |
| **Tests E2E** | 15+ scenarios Playwright |
| **Handlers MSW** | Mocks pour les nouveaux endpoints |

### 2.2 Ce qui est hors perimetre

- Edition du slug d'une collection (le slug est un identifiant permanent utilise dans les URLs et les references internes)
- Edition du sourceType d'un document (text <-> url)
- Edition des chunks individuels
- Versioning des documents (historique des modifications)
- Edition en masse (bulk update)
- Drag-and-drop pour reordonner les documents
- Re-embedding partiel (seuls les chunks modifies)

---

## 3. User Stories

### US-1 : Modifier les metadonnees d'une collection

> **En tant qu'** administratrice du Content Studio,  
> **je veux** pouvoir modifier le nom, la description et la categorie d'une collection existante,  
> **afin de** maintenir une organisation coherente de la base de connaissances sans avoir a supprimer et re-creer la collection.

**Criteres d'acceptation :**

- [ ] Un bouton "Modifier" (icone crayon) est visible sur chaque ligne de collection dans la vue expanded
- [ ] Au clic, une modale s'ouvre avec les champs pre-remplis : nom, description, categorie
- [ ] Le slug n'est PAS editable (affiche en lecture seule)
- [ ] La validation empeche un nom vide ou depassant 200 caracteres
- [ ] La description est optionnelle, max 500 caracteres
- [ ] La categorie est selectionnee via un menu deroulant avec les valeurs existantes
- [ ] Au clic "Enregistrer", un appel PATCH est envoye a l'API
- [ ] En cas de succes, la modale se ferme et la liste se rafraichit avec les nouvelles valeurs
- [ ] En cas d'erreur, un message d'erreur s'affiche dans la modale sans la fermer
- [ ] Un indicateur de chargement est affiche pendant la requete
- [ ] L'annulation ferme la modale sans envoyer de requete

### US-2 : Visualiser le contenu complet d'un document

> **En tant qu'** administratrice du Content Studio,  
> **je veux** pouvoir visualiser le contenu textuel complet d'un document ingere,  
> **afin de** verifier le contenu indexe et identifier les eventuelles erreurs avant de les corriger.

**Criteres d'acceptation :**

- [ ] Un bouton "Voir" (icone oeil) est visible sur chaque ligne de document
- [ ] Au clic, une modale s'ouvre affichant le titre et le contenu complet du document
- [ ] Le contenu est affiche dans un bloc de texte scrollable avec une hauteur maximale
- [ ] Les metadonnees du document sont affichees : sourceType, chunkCount, createdAt, updatedAt
- [ ] Si le document est de type "url", l'URL source est affichee avec un lien cliquable
- [ ] Un bouton "Modifier" dans la modale permet de basculer vers le formulaire d'edition
- [ ] Un bouton "Fermer" ferme la modale

### US-3 : Modifier le contenu d'un document

> **En tant qu'** administratrice du Content Studio,  
> **je veux** pouvoir modifier le titre et le contenu d'un document existant,  
> **afin de** corriger les erreurs et mettre a jour les informations sans perdre la reference au document.

**Criteres d'acceptation :**

- [ ] Un bouton "Modifier" (icone crayon) est visible sur chaque ligne de document
- [ ] Au clic, une modale s'ouvre avec les champs pre-remplis : titre, contenu
- [ ] Le contenu est editable dans un textarea redimensionnable
- [ ] La validation empeche un titre vide (max 500 caracteres) et un contenu vide
- [ ] Un compteur de caracteres indique la taille du contenu
- [ ] Un avertissement previent que la modification du contenu entraine un re-chunking et re-embedding
- [ ] Au clic "Enregistrer", l'API est appelee
- [ ] Pendant le traitement (potentiellement long pour le re-embedding), un indicateur de progression est affiche
- [ ] En cas de succes : la modale se ferme, le nombre de chunks est mis a jour, un toast de confirmation s'affiche
- [ ] En cas d'erreur : le message d'erreur s'affiche dans la modale, le contenu original est preserve
- [ ] L'annulation ferme la modale sans modification, meme si des champs ont ete modifies (confirmation si dirty)

### US-4 : Confirmation avant modification du contenu (re-embedding)

> **En tant qu'** administratrice du Content Studio,  
> **je veux** recevoir un avertissement explicite lorsque la modification du contenu d'un document va declencher un re-embedding,  
> **afin de** comprendre l'impact (cout API, temps de traitement) avant de confirmer.

**Criteres d'acceptation :**

- [ ] Si seul le titre est modifie, pas de re-embedding (modification directe)
- [ ] Si le contenu est modifie, une boite de dialogue de confirmation s'affiche
- [ ] Le message indique : "La modification du contenu va supprimer les X chunks existants et generer de nouveaux embeddings. Cette operation peut prendre quelques secondes."
- [ ] Deux boutons : "Annuler" (retour au formulaire), "Confirmer et re-indexer" (envoi de la requete)

---

## 4. Specifications techniques resumees

### 4.1 Backend

| Endpoint | Methode | Description |
|----------|---------|-------------|
| `/api/admin/ai-engine/knowledge/[slug]` | `PATCH` | Mise a jour partielle de la collection |
| `/api/admin/ai-engine/knowledge/[slug]/documents/[docId]` | `GET` | Recuperation du document complet |
| `/api/admin/ai-engine/knowledge/[slug]/documents/[docId]` | `PATCH` | Mise a jour du document + re-chunking conditionnel |

### 4.2 Service Layer

| Fonction | Module | Description |
|----------|--------|-------------|
| `updateCollection(id, data)` | `collections.ts` | UPDATE partiel name/description/category |
| `updateDocument(id, data)` | `ingestion.ts` | UPDATE titre et/ou contenu + re-chunk si contenu modifie |
| `getDocumentById(id)` | `collections.ts` | SELECT complet du document incluant contentText |

### 4.3 Frontend

| Composant | Type | Description |
|-----------|------|-------------|
| `CollectionEditDialog` | Dialog (modale) | Formulaire d'edition de collection |
| `DocumentEditDialog` | Dialog (modale) | Formulaire d'edition de document |
| `DocumentViewDialog` | Dialog (modale) | Visualisation du contenu d'un document |

### 4.4 Migration de donnees

| Table | Colonne | Type | Description |
|-------|---------|------|-------------|
| `ai_engine_knowledge_collection` | `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW(), mise a jour a chaque PATCH |
| `ai_engine_knowledge_document` | `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW(), mise a jour a chaque PATCH |

---

## 5. Risques et mitigations

| Risque | Probabilite | Impact | Mitigation |
|--------|------------|--------|------------|
| Re-embedding long (>30s) pour gros documents | Moyenne | UX degradee | Indicateur de progression + timeout 120s cote route |
| Cout API OpenAI pour re-embedding frequent | Faible | Financier | Avertissement utilisateur + pas de re-embed si seul le titre change |
| Perte de donnees si le re-chunking echoue a mi-parcours | Faible | Eleve | Transaction DB : suppression des anciens chunks + insertion des nouveaux dans une meme transaction |
| Conflit de lecture si un document est utilise par la pipeline pendant l'update | Faible | Moyen | Le re-chunking est atomique dans une transaction ; les requetes de retrieval en vol verront l'ancienne ou la nouvelle version, jamais un etat intermediaire |
| Regression sur les tests existants | Faible | Moyen | Les tests existants ne sont pas modifies ; les nouveaux tests couvrent uniquement les nouveaux endpoints |

---

## 6. Metriques de succes

| Metrique | Cible | Mesure |
|----------|-------|--------|
| Temps de reponse PATCH collection | < 500ms | Logs serveur |
| Temps de reponse PATCH document (titre seul) | < 500ms | Logs serveur |
| Temps de reponse PATCH document (contenu, 5000 chars) | < 15s | Logs serveur |
| Taux d'erreur API | < 1% | Monitoring |
| Tests unitaires passes | 100% | CI |
| Tests E2E passes | 100% | CI |
| Couverture des nouvelles fonctions | > 90% | Vitest coverage |

---

## 7. Dependances

| Dependance | Type | Statut |
|------------|------|--------|
| Next.js 14.x (App Router) | Framework | En place |
| Drizzle ORM 0.34+ | ORM | En place |
| PostgreSQL + pgvector | Base de donnees | En place |
| @langchain/textsplitters | Chunking | En place |
| @langchain/openai (OpenAIEmbeddings) | Embeddings | En place |
| Zod 3.x | Validation | En place |
| MSW 2.x | Test mocking | En place |
| Vitest 2.1.x | Tests unitaires | En place |
| Playwright 1.48 | Tests E2E | En place |
| Composants primitives CS v2 (Button, Input, Badge, Dialog) | UI | En place |

---

## 8. Glossaire

| Terme | Definition |
|-------|-----------|
| **Collection** | Regroupement thematique de documents dans la base de connaissances (ex: "Brand guidelines FemiGlow") |
| **Document** | Unite de contenu textuel ingere dans une collection (ex: "Guide des ingredients japonais") |
| **Chunk** | Fragment de texte issu du decoupage d'un document, associe a un vecteur d'embedding |
| **Embedding** | Representation vectorielle (1536 dimensions) d'un chunk de texte, generee par OpenAI text-embedding-3-small |
| **Re-chunking** | Processus de suppression des anciens chunks d'un document suivi du re-decoupage du nouveau contenu |
| **Re-embedding** | Generation de nouveaux vecteurs d'embedding pour les chunks issus du re-chunking |
| **Soft-delete** | Suppression logique (isActive = false) sans suppression physique des donnees |
| **pgvector** | Extension PostgreSQL pour le stockage et la recherche de vecteurs |
| **RAG** | Retrieval-Augmented Generation -- enrichissement du contexte IA par recherche semantique |
