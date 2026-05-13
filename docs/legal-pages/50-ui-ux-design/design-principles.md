# 50.1 — Principes design

## 1. Cohérence avec la marque

Les pages légales sont **toujours perçues comme l'entreprise** elle-même. Une page mal rendue ou hors charte décrédibilise la marque entière.

→ Charte FemiGlow appliquée : Cormorant Garamond pour les titres, Inter pour le corps, palette stone/rose.

## 2. Lisibilité prime sur l'esthétique

Une page légale doit être **lue, comprise, retrouvée** — pas admirée.

- Max-width prose 65ch
- Line-height 1.75
- Font-size 16-17px minimum
- Hiérarchie typographique claire (H1, H2, H3)
- Contraste WCAG AA minimum, AAA pour le body

## 3. Transparence radicale

L'utilisateur doit **comprendre immédiatement** :
- Qui édite la page
- Quand elle a été mise à jour
- Comment exercer ses droits

→ « Mis à jour le … · Version … » en haut de chaque page.
→ Bloc « Contact » à la fin de chaque page.

## 4. Découvrabilité

Les pages légales sont parmi les plus consultées en cas de litige. Elles doivent être :
- Présentes dans **plusieurs zones** (footer, banner cookies, checkout, account)
- Facilement **scannables** (table des matières mentale, headings clairs)
- Disponibles depuis **n'importe quelle page** du site

## 5. Aucune sur-promesse

Le design ne doit **pas amplifier** les engagements au-delà du contenu :
- Pas d'icônes « ✓ Garanti à vie ! » si on garantit 2 ans
- Pas de « 100% remboursé sans condition » si conditions s'appliquent
- Pas de visuel rassurant qui contredit le texte

## 6. Mobile-first

70% du trafic FemiGlow est mobile. Toutes les pages légales doivent :
- Être 100% lisibles en 320px
- Avoir des targets touch ≥44×44px
- Avoir un footer sticky avec lien d'urgence (contact)

## 7. Pas de friction inutile

Un utilisateur en train de chercher un retour produit ne doit pas :
- Devoir cliquer 5 fois pour trouver la procédure
- Faire face à un mur de texte indigeste
- Devoir scroller pendant 30 secondes

→ Liens « Voir aussi » en bas de chaque page.
→ Tableaux récapitulatifs au début (TL;DR).
→ FAQ pour les questions opérationnelles.

## 8. Accessibilité par défaut

WCAG 2.1 AA minimum :
- Tab order logique
- Focus visible
- Headings hierarchical
- Alt text sur images informatives
- Contrastes vérifiés
- Compatible lecteurs d'écran (NVDA, VoiceOver, TalkBack)

## 9. Sobriété graphique

Pas de :
- Illustrations décoratives
- Animations
- Auto-play
- Carrousels
- Modales pop-up

Une page légale **n'est pas un funnel marketing**. Elle est **un référentiel**.

## 10. Évolutivité

Le design doit supporter :
- L'ajout de nouvelles pages
- L'arabe (V2) sans refonte
- L'export PDF lisible (impression juriste)
- L'embarquement dans un email transactionnel (sans CSS externe)

## Anti-patterns à éviter

| ❌ Anti-pattern | ✅ Alternative |
|---|---|
| Texte en gris pâle "esthétique" | Contraste AAA pour le body |
| Police < 14px | Min 16px |
| Liens sans soulignement | Soulignement systématique |
| "Cliquez ici" | Texte d'ancrage descriptif |
| Texte aligné justifié | Alignement à gauche (lisibilité) |
| Cassette de cookies bloquante | Banner non bloquant |
| Pas de date de mise à jour | Date visible en haut |
| Texte tout en majuscules | Capitalisation normale |
