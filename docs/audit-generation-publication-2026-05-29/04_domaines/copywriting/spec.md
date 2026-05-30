## Spec — Copywriting / texte (fonctionnement optimal attendu)

### 1. Objectif
Quand un opérateur crée une idée et clique "Générer" sur `/admin/content-studio-v2/create`, il doit recevoir un **brief** (angle, proof, CTA, direction média, contraintes) et **3 drafts** (variantLabel, hook, caption, CTA, altText, hashtags) rédigés par un LLM, adaptés à l'idée (pilier, objectif, plateforme, format), respectant la charte FemiGlow (français, pas d'emoji, pas de point d'exclamation, pas de promesse médicale ni d'urgence commerciale).

### 2. Modes MOCK / LIVE (doivent être réellement distincts)
- **LIVE** : appel LLM (OpenAI/Anthropic/Google selon config), JSON validé par schema, coût enregistré (~2¢), provider=`openai`. Le modèle choisi dans le picker est effectivement utilisé.
- **MOCK** : génération déterministe locale (template), provider=`fallback`/`mock`, coût=0, AUCUN appel réseau, mais texte crédible et varié selon pilier/objectif/prompt.
- Le mode doit être piloté de façon cohérente (cookie `cs_generation_mode` OU clé présente), et l'opérateur doit voir clairement le mode actif et le modèle réellement employé ("Généré par {model} · {cost}¢").

### 3. Picker de modèles
- `GET /models?role=chat` ne propose que des modèles de **rédaction de texte** réellement appelables par le moteur de génération. Pas de modèle STT (whisper) ni de modèle inadapté.
- Un modèle marqué `source:"live"` DOIT être utilisable par le chemin de génération (même clé d'API que celle réellement consommée).
- `suggested` pointe sur un modèle texte par défaut sensé (gpt-4o-mini).

### 4. Variations
- `POST /drafts/:id/variation` régénère un texte **distinct** (autre hook/angle/CTA) — idéalement via les 3 stratégies (hook-alternatif, cta-different, emotion-different). `promptOverride` est honoré. Le résultat n'est jamais un doublon verbatim du parent.

### 5. Régénération d'idée
- Re-générer une idée déjà `generated` renvoie une erreur métier claire (409/`invalid_state` "Idée déjà générée"), OU régénère proprement, sans écritures partielles (transaction). Jamais de 500 opaque.

### 6. AI-Engine (script/caption/variants)
- Les nœuds LangGraph produisent un script structuré (hook, scènes, CTA, voiceoverRequired, musicRequired, visualDirection) et des captions multi-framework (PAS/AIDA/BAB) avec stratégie hashtags niche/mid/broad.
- Si l'opérateur passe par le create flow, soit ce moteur est branché (via bridge B->A avec mapping de taxonomie), soit la même qualité de prompt est portée dans generation.ts. Pas de double système silencieux.
- Taxonomies pillar/objective réconciliées entre les deux systèmes via un mapping bidirectionnel testé.

### 7. Tests
- Chaque nœud de génération est testé sur: (a) succès LLM avec JSON conforme, (b) JSON tronqué -> fallback, (c) JSON hors-schema -> fallback, (d) absence de clé -> fallback, avec vérification du coût et du provider. Aucune unhandled rejection; le process de test sort 0.

### 8. Robustesse
- Clé vide ('') traitée comme absente partout (pas de `??` qui laisse passer la chaîne vide).
- Une seule chaîne de résolution de clé OpenAI partagée par discovery + génération + AI-Engine.