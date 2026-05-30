# Human-in-the-Loop — Scénarios de test détaillés

## Description fonctionnelle

Le HITL permet à l'opérateur de valider le contenu généré avant publication.
Le pipeline LangGraph se met en pause au nœud `reviewGate`, l'opérateur
voit un aperçu dans l'UI et soumet sa décision (approuver, rejeter, modifier).

## Flow technique

```
Pipeline LangGraph exécute nœuds 1-14
        │
        ▼
  reviewGate (interruptBefore)
  ────────────────────────────
  │ MemorySaver sauvegarde le state
  │ engine.invoke() retourne
  │ orchestrator détecte l'interrupt
  │ retourne status='review' + reviewPayload
        │
        ▼
  UI affiche le ReviewPanel
  ────────────────────────
  │ Script preview
  │ Caption preview
  │ Images thumbnails
  │ Quality scores
  │ 3 boutons: Approuver / Modifier / Rejeter
        │
        ▼ (opérateur clique)
  POST /api/admin/ai-engine/jobs/:id/review
  ──────────────────────────────────────────
  │ { decision: 'approved', feedback?: '...' }
  │
  │ orchestrator.resumeGeneration(jobId, decision)
  │ engine.invoke(Command({resume: decision}), {thread_id: jobId})
  │
  │ Si approved → generateVariants → END → status='completed'
  │ Si rejected → generateScript (loop) → ... → nouveau review possible
  │ Si edit_requested → generateScript avec feedback → ... → nouveau review
```

## Scénarios à tester

### Scénario HITL-1: Approbation directe
1. Générer un contenu (brief complet)
2. Pipeline pause au reviewGate
3. UI affiche ReviewPanel avec preview
4. Cliquer "Approuver"
5. Pipeline reprend → generateVariants → END
6. Résultat final affiché avec variantes
7. **Vérifier** : status='completed', variants.length > 0

### Scénario HITL-2: Rejet avec feedback
1. Générer un contenu
2. Pipeline pause au reviewGate
3. Cliquer "Rejeter"
4. Textarea feedback apparaît
5. Saisir "Le hook n'est pas assez accrocheur"
6. Confirmer le rejet
7. Pipeline reprend depuis generateScript avec feedback
8. Nouveau contenu généré
9. Nouveau reviewGate (ou approved_direct si HITL désactivé pour le retry)
10. **Vérifier** : nouveau script ≠ ancien script

### Scénario HITL-3: Demande de modifications
1. Générer un contenu
2. Pipeline pause au reviewGate
3. Cliquer "Demander des modifications"
4. Saisir "Ajouter une mention du camélia Tsubaki"
5. Confirmer
6. Pipeline reprend avec feedback
7. **Vérifier** : le nouveau contenu intègre le feedback

### Scénario HITL-4: Auto-approve (HITL désactivé)
1. Configurer AI_ENGINE_HUMAN_REVIEW_REQUIRED=false
2. Générer un contenu
3. Pipeline passe directement reviewGate → generateVariants → END
4. **Vérifier** : pas de pause, status='completed' directement

### Scénario HITL-5: Review après quality retry
1. Premier pass : quality score < threshold → retry
2. Deuxième pass : quality score OK → moderate → reviewGate
3. L'opérateur voit le contenu amélioré
4. Approuver
5. **Vérifier** : retries.qualityCheck > 0 dans le state

## Éléments UI à vérifier dans le ReviewPanel

| Élément | Vérification |
|---|---|
| Script hook | Texte non vide, en français |
| Script scenes | Liste de scènes avec descriptions |
| Script CTA | Call-to-action présent |
| Caption | Texte > 50 caractères |
| Hashtags | Tags avec # prefix |
| Images | Miniatures cliquables |
| Quality scores | Barres par dimension (0-100%) |
| Bouton Approuver | Visible, cliquable, vert |
| Bouton Modifier | Visible, ouvre textarea |
| Bouton Rejeter | Visible, ouvre textarea |
| Textarea feedback | Apparaît sur Modifier/Rejeter, min 10 chars |
| Bouton Confirmer | Apparaît après saisie feedback |
