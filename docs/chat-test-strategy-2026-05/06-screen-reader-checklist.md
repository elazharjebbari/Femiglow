# Screen reader checklist — tests manuels

Suite à exécuter **1× par sprint** (cf. [05-runbook/04-coverage-monitoring.md](05-runbook/04-coverage-monitoring.md))
pour valider l'expérience screen reader réelle. Les tests axe automatisés
catchent ~30 % des problèmes a11y ; le reste demande une oreille humaine.

## Équipement

| Plateforme | Reader | Comment lancer |
|------------|--------|----------------|
| macOS | **VoiceOver** | `Cmd+F5` ou Réglages > Accessibilité > VoiceOver |
| Windows | **NVDA** | Téléchargement gratuit nvaccess.org |
| Windows | **JAWS** | Licence — optionnel |
| iOS | **VoiceOver** | Réglages > Accessibilité > VoiceOver |
| Android | **TalkBack** | Réglages > Accessibilité > TalkBack |

## Checklist par parcours

### Parcours 1 — Visiteur ouvre le chat depuis /kit

**Outil** : VoiceOver Mac (Safari) + Mobile VoiceOver iOS

- [ ] **Page /kit annonce hiérarchie correcte** : h1 "Pack FemiGlow" → h2 sections
- [ ] Tab atteint le launcher : annonce "Ouvrir le chat, bouton"
- [ ] Enter ou Space ouvre le panel
- [ ] Le focus se déplace **automatiquement** sur le composer après ouverture
- [ ] Annonce panel : "Assistant FemiGlow, région" OU "Assistant FemiGlow, dialogue" si modal
- [ ] Composer annonce : "Votre message, zone de texte modifiable, multiligne"
- [ ] Suggestions pills annoncées comme `list > listitem > button`
- [ ] Liste messages annoncée comme `log` avec `aria-live="polite"`
- [ ] Nouveau message assistant : annoncé sans interrompre le focus utilisateur
- [ ] Tab cycle limité au panel (focus trap) sur mobile uniquement
- [ ] Escape ferme le panel + focus revient sur launcher

### Parcours 2 — Visiteur reçoit LeadFormBubble

- [ ] Apparition de la bubble : annonce automatique via `aria-live` ?
- [ ] Tab atteint les champs dans l'ordre : prénom → téléphone → consent → submit
- [ ] Chaque champ a un label associé (annoncé : "Prénom, zone de texte obligatoire")
- [ ] Erreur de validation : annoncée immédiatement via `role="alert"` ou `aria-live="assertive"`
- [ ] Submit success : annoncé "Merci [prénom], on vous rappelle"

### Parcours 3 — Admin /admin/chat/leads

**Outil** : NVDA Windows (Firefox)

- [ ] Table leads annoncée comme `table` avec headers
- [ ] Tab navigue : ligne → ligne (pas cellule par cellule)
- [ ] Outcome select annoncé : "Statut, liste déroulante, [valeur actuelle]"
- [ ] Modification outcome : feedback annoncé via `aria-live`
- [ ] Bouton export CSV annoncé clairement

### Parcours 4 — Multilang RTL (ar-MA)

**Outil** : VoiceOver iOS

- [ ] Le panel annonce `lang="ar-MA"` automatiquement (la voix passe en arabe si configurée)
- [ ] Direction RTL respectée : focus left-to-right ne marche pas, c'est right-to-left
- [ ] Date / nombres restent LTR dans contexte RTL (convention MA)

## Bugs courants à surveiller

| Bug | Symptôme |
|-----|----------|
| Bouton sans label | "Bouton" tout seul, sans contexte |
| Image décorative comme contenu | Annonce d'un nom de fichier ou alt vide oublié |
| Focus piégé hors panel | Tab continue sur la page d'arrière-plan |
| Modal sans `aria-modal` | Screen reader continue à lire le main |
| Toast sans `aria-live` | Annonces critiques manquées |
| Loading spinner annoncé infiniment | Pas de `aria-busy` qui bascule à false |
| `aria-label` redondant avec text | Annonce doublée |
| Lien comme button (et vice-versa) | "Bouton" mais Enter ne fait rien |

## Reporting

Après chaque session, créer une issue GitHub avec :
- **Titre** : `[a11y][screen-reader] {parcours} - {bug court}`
- **Body** :
  - Outil utilisé (VO/NVDA/TalkBack)
  - URL + étapes
  - Annonce attendue vs annoncée
  - Sévérité (bloquant / important / mineur)
  - Recording vocal si possible (Quicktime Mac)

## Cadence

| Quand | Quoi |
|-------|------|
| Chaque PR major UI | Test parcours impacté |
| Chaque sprint (1× / 2 sem) | Tous les parcours P0 + 1 P1 |
| Audit trimestriel | Tous les parcours + audit externe (RGAA) |
