# Annexe — Glossaire du dossier

Termes utilisés dans le dossier `docs/reviews-wall/`, mis dans le contexte FemiGlow.

| Terme | Définition |
| --- | --- |
| **Rituel partagé** | Un témoignage publié dans le wall. C'est la traduction « maison » du mot « avis ». |
| **Initiée** | Une cliente qui a reçu le pack FemiGlow. Mot maison, jamais « cliente » côté public. |
| **Initiée vérifiée** | Une initiée dont le témoignage est rattaché à une commande `paid`. Affiche un signal discret. |
| **Wall** | Le composant côté code. Côté UI, on parle de « Rituels partagés ». |
| **Drawer** | Le panneau latéral (desktop) ou bottom sheet (mobile) qui contient le wall. |
| **Module compact** | Le bloc de 3 cartes posé sur `/kit`. Sert de proof immédiate sans demander l'ouverture du drawer. |
| **Featured** | Champ booléen sur un témoignage. Max 3 simultanés. Sélection manuelle dans l'admin pour le module compact. |
| **Signal de retour** | Réponse de l'initiée à « Recommanderiez-vous ce rituel à une amie ? » : `oui` / `hesite` / `non`. Substitut maison à la note 1-5. |
| **Tag rituel** | Un mot-clé de la liste fermée (Ongles plus lisses, Plaque souple, etc.) coché par l'initiée. Max 3 par témoignage. |
| **Auto-flag** | Signal automatique élevant la priorité dans la queue admin sans rejeter. Ex. `face_detected`, `emoji_detected`. |
| **Wizard** | L'interface de soumission en 3 étapes + confirmation. |
| **E-mail J+45** | E-mail automatique envoyé 45 jours après la commande, qui invite à partager son rituel. Canal principal de soumission. |
| **Customer hash** | HMAC SHA-256 de l'e-mail de la cliente. Permet de détecter doublons sans stocker l'e-mail en clair. |
| **Email token** | HMAC signé inclus dans le lien d'e-mail J+45. Permet le pré-remplissage et la vérification d'authenticité. |
| **Vision ML faces** | Détection automatique de visages sur les photos uploadées. Modèle MediaPipe Face Detection. |
| **Sanitization** | Nettoyage du `body` à la soumission : strip emojis, normalisation typo, etc. |
| **Public slug** | Identifiant URL court (8 caractères) d'un témoignage. Sert pour `?wall=card-xxxxxxxx`. |
| **Cursor** | Pagination opaque base64 (`{publishedAt, id}`). Plus stable que `offset/limit`. |
| **Featured fallback** | Si moins de 3 témoignages `featured = true`, le module compact se rabat sur les 3 plus récents avec photo et signal oui. |
| **Hick's law** | Loi UX : plus il y a d'options, plus le choix est lent. Cible : ≤ 4 chips filtres exposés. |
| **Fitts' law** | Loi UX : la taille et la distance d'une cible déterminent le temps pour l'atteindre. Cible : CTA pack plein largeur en pied de drawer. |
| **Indirect claim** | Heuristique Kolenda (K-LUX-03). La maison ne dit pas « les meilleurs ongles » — elle laisse les initiées le dire. |
| **K-LUX-01** | Kolenda Luxury heuristic 1 : empty space = +23 % premium perceived (Sevilla & Townsend 2016). |
| **K-LUX-04** | Kolenda Luxury heuristic 4 : imply human, mains pas visages. |
| **BAR** | Schéma narratif Before-Action-Result, structure implicite d'un témoignage performant. |
| **Bottom sheet** | Pattern mobile : panneau qui monte depuis le bas, avec drag handle. |
| **Focus trap** | Mécanique de focus qui boucle dans une modale et empêche d'atteindre l'arrière-plan. |
| **Inert** | Attribut HTML qui rend un élément non focusable et invisible aux assistive tech. Posé sur `<main>` quand le drawer est ouvert. |
| **WCAG 2.2 AA** | Niveau de conformité accessibilité visé. AAA sur les corps de texte. |
| **`prefers-reduced-motion`** | Préférence système de l'utilisateur pour réduire le mouvement. Respectée absolument. |
| **Stagger** | Décalage temporel entre l'apparition de plusieurs éléments (ex. 50 ms par carte). |
| **MediaPipe Face Detection** | Modèle open source Google pour détecter des visages. ~4 Mo, ~800 ms par image. |
| **Vercel Blob** | Service de stockage objet de Vercel. Utilisé pour les photos uploadées. |
| **Iron-session** | Lib auth admin existante dans le projet. Sert pour le CSRF token sur `/api/rituals/submit`. |
| **app_config** | Table existante pour la config admin (navigation, branding, flags, RBAC, et maintenant `rituals_policy` + `rituals_forbidden_words`). |
| **app_config_snapshots** | Table existante pour le versioning de `app_config`. |
| **insights_rituals_daily** | Nouvelle table d'agrégation à créer pour les KPI du wall. |
| **Lift conversion** | Différence relative de taux de conversion entre cohorte exposée et non-exposée à un composant. |
| **MDE** | Minimum Detectable Effect — la différence minimale qu'un test statistique peut détecter avec sa puissance configurée. |
| **DSAR** | Data Subject Access Request — demande RGPD d'accès / suppression. |
| **HMAC** | Hash-based Message Authentication Code. Signature cryptographique d'un payload. |
| **AVIF** | Format image moderne, ~50 % plus petit que JPEG à qualité équivalente. |
| **RSC** | React Server Component. Rendu côté serveur, pas de JS côté client (sauf hydration sélective). |
| **Suspense boundary** | Délimitation React qui permet le streaming et le fallback gracieux pendant le chargement. |
| **Halal Cosmetics Council** | Organisme de certification halal pour les cosmétiques. Référence utilisée pour `tag = halal`. |
