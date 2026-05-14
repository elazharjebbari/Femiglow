# UX Flows — micro-décisions ergonomiques

## Principes UX directeurs

1. **Pas d'anxiété par défaut** : tant que tout est OK, l'admin ne voit rien d'intrusif. Le système est invisible quand sain.
2. **Alerte = action** : chaque alerte propose **quoi faire**, pas juste **ce qui ne va pas**.
3. **Confiance progressive** : un admin novice doit pouvoir naviguer sans casser ; un expert doit pouvoir aller vite.
4. **Pas de modal** : tout est inline (cards, banner), pas de popup qui bloque le flow.
5. **Recovery rapide** : un drift devrait pouvoir être corrigé en < 5 min de l'alerte à la résolution.

## Flow détaillé — Cas critique (parcours B du document personas)

```
T+0   Sara importe mapping v17 dans le mauvais ordre, Submit&Publish
T+2min  Premier pageview en prod → sentinel ping → backend détecte mapping_version_drift
T+2min  driftDetector classifie 'critical'
T+2min01s  Email envoyé à Sara : "Drift critique tracking GTM — agir maintenant"
T+5min  Sara reçoit l'email, clique le lien → /admin/tracking/gtm/sync-status
T+5min  Banner rouge en haut de page (déjà visible avant même de cliquer)
T+5min  Page sync-status affiche :
        - Cause : mapping_version_drift v17 attendu / v16 reçu
        - Actions : 1. Ouvrir GTM 2. Réimporter v17 3. Submit&Publish 4. Revenir ici
T+7min  Sara ouvre GTM dans nouvel onglet, réimporte v17, Submit&Publish
T+8min  Pageview suivant en prod → nouveau ping avec mapping=v17 → drift résolu
T+8min  Statut sync-status passe à OK (hystérésis 5 min — visible à T+13min en réalité)
T+13min  Banner rouge disparaît automatiquement
```

**Temps total : ~13 min de l'erreur à la résolution. MTTD ~2 min. MTTR ~10 min.**

## Anti-patterns évités

### ❌ Modal "Erreur critique" qui bloque toute action
- Pourquoi non : punition disproportionnée, pousse à fermer sans lire.
- Notre choix : Banner persistant en haut. L'admin peut continuer ses autres tâches.

### ❌ Notification système OS (web push)
- Pourquoi non : trop intrusif, fatigue rapide.
- Notre choix : Email (digest pour warning, immédiat pour critical).

### ❌ Lien générique "Erreur tracking, contactez le support"
- Pourquoi non : non actionnable.
- Notre choix : Chaque message d'erreur identifie la cause + propose le fix.

### ❌ Bouton "Auto-fix" qui modifie GTM
- Pourquoi non : un fix automatique dans un système tiers (GTM) = risque énorme.
- Notre choix : Le système alerte, l'admin décide et agit.

## Affordances visuelles

### Page sync-status — état OK
- Couleur dominante : vert clair.
- Texte grand : "🟢 Tout est cohérent".
- Sous-texte rassurant : "Dernier ping il y a 12s".
- Le reste de la page (timeline, transitions) est en gris/blanc → fait baisser la vigilance.

### Page sync-status — état warning
- Couleur dominante : orange clair (pas rouge).
- Texte : "🟠 Attention : drift mineur détecté".
- L'utilisateur n'est pas paniqué mais alerté.

### Page sync-status — état critical
- Couleur dominante : rouge clair (background) + texte rouge foncé.
- Texte gros : "🔴 DRIFT CRITIQUE".
- Affichage en premier de la **cause** + des **actions à prendre**.
- Le reste de la page est minimisé visuellement.

## Pattern Wizard validate-pair

Le wizard utilise un stepper visuel toujours visible en haut :
```
✓ Étape 1     ● Étape 2     ○ Étape 3
Config GTM    Mapping       Validation
```
- `✓` = étape complétée
- `●` = étape courante
- `○` = étape future

Permet à l'admin de visualiser sa progression et de revenir en arrière.

### Pourquoi un wizard et pas un seul écran ?
- L'utilisateur drop UN fichier à la fois → focus mental, moins d'erreurs.
- Confirmation visuelle après chaque drop ("✅ Config chargée : config-v4.json").
- Pas de surcharge cognitive en cas d'erreur (on traite étape par étape).

## Patterns d'écriture des messages d'erreur

Template canonique :
```
[Émoji statut] [Code court humain]
  • Attendu : [valeur]
  • Reçu    : [valeur]
  • FIX : [verbe d'action] [objet] [contexte].
```

Exemple :
```
🔴 Mapping version mismatch
  • Attendu : v17
  • Reçu    : v16
  • FIX : Réimporter mapping-v17.json dans GTM et cliquer "Submit & Publish".
```

## Accessibilité

- Tous les statuts sont signalés par **émoji + couleur + texte** (pas couleur seule).
- `role="alert"` sur les banners pour annonce automatique screen reader.
- `aria-live="polite"` pour les changements de statut.
- Navigation clavier complète : Tab dans le wizard, Enter pour valider, Escape pour fermer.
- Focus visible avec contour 2px (token `--ring-default`).
- Contraste WCAG AA minimum sur tous les textes (vérifié).

## Internationalisation

Pour l'instant FR uniquement. Les messages d'erreur sont externalisés dans un dict :
```ts
// apps/web/src/lib/tracking/gtm/i18n.ts
export const driftMessages = {
  fr: {
    bundleMismatchTitle: 'Bundle ID incohérent',
    bundleMismatchFix: 'Re-générer les 2 fichiers ensemble depuis l\'admin.',
    // ...
  },
} as const;
```
