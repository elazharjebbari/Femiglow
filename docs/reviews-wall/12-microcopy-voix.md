# 12 — Microcopy et voix : catalogue complet

Toutes les chaînes affichées par le composant « Rituels partagés », classées par surface et par contexte. Une chaîne = une intention, dans la voix maison.

## 1. Principes de rédaction

### 1.1 Voix

- **Sensoriel** plutôt que descriptif.
- **Complice** plutôt que commercial.
- **Lent** plutôt que urgent.
- **Suggestif** plutôt qu'injonctif (K-LUX-03).

### 1.2 Mots préférés

`rituel` · `voix` · `initiée` · `geste` · `lent` · `lecture` · `partager` · `écouter` · `accueillir` · `recevoir` · `révéler` · `patience`

### 1.3 Mots interdits

`avis` · `cliente` · `note` · `étoile` · `commenter` · `acheter` · `réduction` · `promo` · `solde` · `gratuit` (sauf « livraison offerte ») · `vite` · `dernier` · tout point d'exclamation · tout emoji

### 1.4 Typographie

- Apostrophes courbes `'` (U+2019).
- Guillemets français « » avec espace fine insécable (U+202F).
- Em-dash `—` (U+2014) littéral.
- Points de suspension `…` (U+2026).

## 2. Module compact sur `/kit`

| Clé | Chaîne |
| --- | --- |
| `module.kicker` | `LES VOIX DE LA MAISON` |
| `module.title_template` | `{count} initiées ont partagé. {oui_count} reprendraient le rituel.` |
| `module.title_singular` | `Une initiée a partagé son rituel. Elle le reprendrait.` |
| `module.link_template` | `Lire les {count} rituels partagés →` |
| `module.link_first` | `Lire le premier rituel →` |
| `module.empty_state` | `La maison écoute. Soyez la première à partager.` |

## 3. Drawer du wall — en-tête et synthèse

| Clé | Chaîne |
| --- | --- |
| `drawer.kicker` | `RITUELS PARTAGÉS` |
| `drawer.title` | `Les voix de la maison.` |
| `drawer.summary_oui_count_template` | `{count} initiées ont partagé. {oui_count} reprendraient le rituel.` |
| `drawer.summary_top_tags_label` | (rien — les tags sont affichés directement séparés par ` · `) |
| `drawer.close_label` | `Fermer` (aria-label, pas visible) |

## 4. Drawer — filtres

| Clé | Chaîne |
| --- | --- |
| `filter.all` | `Tous` |
| `filter.with_photos` | `Avec photos` |
| `filter.halal` | `Halal` |
| `filter.recent` | `Récents` |
| `filter.recommended_default` | `Recommandés` (ordre par défaut, pas un chip à part) |

## 5. Drawer — cartes de témoignage

| Clé | Chaîne |
| --- | --- |
| `card.signature_with_name_template` | `— {firstName}, {city}` |
| `card.signature_anonymous_template` | `— Une initiée, {city}` |
| `card.initiated_since_template` | `Initiée depuis {month} {year}` |
| `card.would_recommend_badge` | `Reviendrait` |
| `card.tags_separator` | ` · ` |
| `card.photo_alt_template` | `Mains de {firstName}, {weeks} semaines après le début du rituel` |
| `card.photo_alt_anonymous_template` | `Mains d'une initiée, {weeks} semaines après le début du rituel` |
| `card.photo_alt_generic` | `Photo partagée par une initiée` |

## 6. Drawer — load more

| Clé | Chaîne |
| --- | --- |
| `loadmore.button_template` | `Afficher plus ({current} / {total})` |
| `loadmore.button_loading` | `La maison cherche…` |
| `loadmore.end` | `Vous avez lu toutes les voix de la maison.` |
| `loadmore.error` | `La maison n'a pas pu charger d'autres voix. Essayez à nouveau dans un instant.` |

## 7. Drawer — empty state

| Clé | Chaîne |
| --- | --- |
| `empty.title` | `La maison écoute.` |
| `empty.subtitle` | `Soyez la première à partager votre rituel.` |
| `empty.cta` | `Partager mon rituel →` |

## 8. Drawer — footer

| Clé | Chaîne |
| --- | --- |
| `footer.share_link` | `Partager mon rituel →` |
| `footer.cta_main_template` | `Recevoir le pack — {price} dh` |
| `footer.cta_main_sub` | `Livraison offerte au Maroc` |
| `footer.policy_link` | `Comment ces rituels partagés sont vérifiés →` |

## 9. Politique « Comment vérifiés »

Texte complet stocké dans `app_config` section `rituals_policy`. Version de référence :

```
Comment ces rituels partagés sont vérifiés.

Chaque rituel publié sur cette page vient d'une initiée
qui a reçu le pack FemiGlow et l'a pratiqué chez elle.

Nous le lisons à la main, dans nos heures de calme, sous
48 heures. Nous ne réécrivons pas. Nous corrigeons parfois
une apostrophe, jamais une intention.

Pour préserver l'intimité de notre maison, nous publions
des mains, des gestes, des tables de soin — jamais de
visage de face. Les émoticônes n'entrent pas non plus dans
notre grammaire ; nous les retirons à la lecture.

Si vous souhaitez retirer votre voix, écrivez-nous à
info@femiglow-maroc.com. Nous l'archiverons sous trois jours.

Avec soin,
Souheila · FemiGlow
```

Bouton retour bas de page : `← Revenir aux rituels`.

## 10. Lightbox photo

| Clé | Chaîne |
| --- | --- |
| `lightbox.close_label` | `Fermer la photo` (aria) |
| `lightbox.counter_template` | `Photo {current} / {total}` |
| `lightbox.prev_label` | `Photo précédente` (aria) |
| `lightbox.next_label` | `Photo suivante` (aria) |

## 11. Wizard — étape 1

| Clé | Chaîne |
| --- | --- |
| `wizard.step.indicator_template` | `{current} sur {total}` |
| `wizard.step1.kicker` | `PARTAGER MON RITUEL` |
| `wizard.step1.title` | `Étape 1 — Votre voix` |
| `wizard.step1.body_question` | `Qu'est-ce que le rituel a changé pour vous ?` |
| `wizard.step1.body_placeholder` | `Décrivez ce que vous avez remarqué. Cinquante mots suffisent.` |
| `wizard.step1.body_count_low_template` | `{count} / 50 mots` |
| `wizard.step1.body_count_ok_template` | `{count} mots — suffisamment dense pour être lue.` |
| `wizard.step1.body_count_too_long_template` | `{count} mots — plus court invite à plus de lecture.` |
| `wizard.step1.signal_question` | `Recommanderiez-vous ce rituel à une amie ?` |
| `wizard.step1.signal_oui` | `Oui, sans hésiter` |
| `wizard.step1.signal_hesite` | `J'hésite` |
| `wizard.step1.signal_non` | `Pas pour moi` |
| `wizard.step1.cta_continue` | `Continuer →` |
| `wizard.step1.cta_submit_now` | `Soumettre tel quel →` |
| `wizard.step1.helper` | `Vous pouvez partager dès maintenant. Les détails sont facultatifs.` |
| `wizard.step1.emoji_stripped_toast` | `Les émoticônes ne sont pas dans notre grammaire.` |

## 12. Wizard — étape 2

| Clé | Chaîne |
| --- | --- |
| `wizard.step2.title` | `Étape 2 — Vos mots-clés` |
| `wizard.step2.tags_question` | `Que diriez-vous en trois mots ?` |
| `wizard.step2.tags_helper` | `(jusqu'à trois)` |
| `wizard.step2.tags_limit_reached` | `Trois suffisent.` |
| `wizard.step2.photos_question` | `Une photo de vos mains ?` |
| `wizard.step2.photos_drop_label` | `+ Glisser ou choisir jusqu'à 3 photos` |
| `wizard.step2.photos_drop_active` | `Déposer ici` |
| `wizard.step2.photos_helper_1` | `Mains, gestes, table de soin.` |
| `wizard.step2.photos_helper_2` | `Pour préserver l'intimité de la maison, nous ne publions pas de visage de face.` |
| `wizard.step2.photos_uploading` | `Votre photo arrive…` |
| `wizard.step2.photo_face_alert_title` | `La photo contient un visage.` |
| `wizard.step2.photo_face_alert_body` | `Pour préserver l'intimité de la maison, voudriez-vous la remplacer ?` |
| `wizard.step2.photo_face_replace` | `Choisir une autre photo` |
| `wizard.step2.photo_face_keep` | `Conserver pour relecture humaine` |
| `wizard.step2.photo_remove_label` | `Retirer cette photo` (aria) |
| `wizard.step2.cta_continue` | `Continuer →` |
| `wizard.step2.cta_skip` | `Passer cette étape →` |
| `wizard.step2.cta_back` | `← Retour` |

## 13. Tags rituels — libellés

Liste fermée, stockée dans `app_config` section `ritual_tags_catalog`.

| Clé (slug) | Libellé affiché |
| --- | --- |
| `ongles-plus-lisses` | `Ongles plus lisses` |
| `plaque-souple` | `Plaque souple` |
| `cuticules-apaisees` | `Cuticules apaisées` |
| `plus-de-casse` | `Plus de casse` |
| `eclat-naturel` | `Éclat naturel` |
| `rituel-devenu-habitude` | `Rituel devenu habitude` |
| `mains-detendues` | `Mains détendues` |
| `fini-brillant` | `Fini brillant` |
| `halal` | `Halal` |

Ordre d'affichage dans le wizard : ordre du tableau ci-dessus. Ordre dans les insights agrégés : par fréquence décroissante.

## 14. Wizard — étape 3

| Clé | Chaîne |
| --- | --- |
| `wizard.step3.title` | `Étape 3 — Votre signature` |
| `wizard.step3.intro` | `Comment souhaitez-vous signer ?` |
| `wizard.step3.first_name_label` | `Prénom` |
| `wizard.step3.first_name_helper` | `(apparaîtra publiquement)` |
| `wizard.step3.city_label` | `Ville` |
| `wizard.step3.initiated_since_label` | `Initiée depuis` |
| `wizard.step3.month_label` | `Mois` |
| `wizard.step3.year_label` | `Année` |
| `wizard.step3.anonymous_label` | `Signer anonymement` |
| `wizard.step3.anonymous_helper_template` | `(la maison gardera votre prénom en mémoire, mais publiera « Une initiée, {city} »)` |
| `wizard.step3.cta_submit` | `Partager mon rituel →` |
| `wizard.step3.cta_skip` | `Passer cette étape →` |
| `wizard.step3.cta_back` | `← Retour` |

### 14.1 Mois (FR)

`Janvier · Février · Mars · Avril · Mai · Juin · Juillet · Août · Septembre · Octobre · Novembre · Décembre`

### 14.2 Villes du Maroc (autocomplete)

`Rabat · Casablanca · Salé · Tanger · Marrakech · Fès · Agadir · Oujda · Tétouan · Meknès · Kénitra · Autre`

## 15. Wizard — confirmation

| Clé | Chaîne |
| --- | --- |
| `wizard.confirmation.title` | `La maison reçoit votre rituel.` |
| `wizard.confirmation.body_1` | `Nous l'ouvrirons sous 24 à 48 heures.` |
| `wizard.confirmation.body_2` | `Vous recevrez un mot quand il sera publié.` |
| `wizard.confirmation.signature_1` | `Avec soin,` |
| `wizard.confirmation.signature_2` | `Souheila · FemiGlow` |
| `wizard.confirmation.cta` | `Continuer la lecture` |

## 16. Wizard — brouillon

| Clé | Chaîne |
| --- | --- |
| `wizard.draft.modal_title` | `La maison a gardé votre rituel en mémoire.` |
| `wizard.draft.modal_body` | `Voulez-vous le reprendre ou recommencer ?` |
| `wizard.draft.modal_resume` | `Reprendre` |
| `wizard.draft.modal_restart` | `Recommencer` |
| `wizard.draft.modal_dismiss` | `Plus tard` |

## 17. Wizard — erreurs

| Code | Chaîne |
| --- | --- |
| `error.rate_limit` | `La maison a déjà reçu votre voix récemment. Si vous voulez nous écrire, info@femiglow-maroc.com reste ouverte.` |
| `error.body_too_short` | `Quelques mots de plus aideront d'autres initiées.` |
| `error.body_too_long` | `Plus court invite à plus de lecture.` |
| `error.signal_missing` | `Auriez-vous l'amitié de nous dire si vous reprendriez ce rituel ?` |
| `error.photo_too_large` | `Votre photo est généreuse — pourriez-vous nous la donner sous 5 Mo ?` |
| `error.photo_invalid_format` | `Ce format de photo n'est pas accepté. JPEG, PNG ou HEIC, s'il vous plaît.` |
| `error.invalid_email_token` | `Le lien depuis votre boîte mail n'est plus valide. Vous pouvez toujours partager depuis la page des rituels partagés.` |
| `error.network` | `La maison n'a pas pu recevoir. Essayez à nouveau dans un instant.` |
| `error.internal` | `La maison n'a pas pu recevoir votre rituel. Essayez à nouveau dans quelques minutes, ou écrivez-nous à info@femiglow-maroc.com.` |

## 18. E-mails

### 18.1 E-mail J+45 (subject)

| Variante | Objet |
| --- | --- |
| Standard | `Comment se porte votre rituel ?` |
| Si commande du pack expert | `Quarante-cinq jours, déjà.` |

### 18.2 E-mail J+45 (body)

Cf. `07-proposition-finale.md` § 7.2.

### 18.3 E-mail d'approbation

```
Objet : Votre rituel est publié

Bonjour [Prénom],

Votre rituel a été lu et publié sur notre site. D'autres
initiées le découvriront en ce moment même.

[ Lire le wall des rituels ]

Avec soin,
La maison FemiGlow
```

### 18.4 E-mail de rejet — visage détecté

Cf. `10-interface-admin.md` § 14.1.

### 18.5 E-mail de rejet — autre raison

Cf. `10-interface-admin.md` § 14.2.

## 19. Microcopy import et bulk (admin)

Le wizard d'import et la barre bulk utilisent un microcopy admin, plus fonctionnel que le wizard public. Catalogue exhaustif dans `↗ execution/14-import-wizard-ui-specification.md § 13` et `↗ execution/16-bulk-management.md`.

### 19.1 Wizard import — chaînes clés

| Surface | Chaîne |
| --- | --- |
| Titre page | « Importer des rituels partagés » |
| Étape 1 question | « Quel format souhaitez-vous importer ? » |
| Tuile ZIP tooltip | « Idéal si vous avez des photos à attacher » |
| Drop zone | « Glisser un fichier ou cliquer pour parcourir » |
| Parsing en cours | « Parsing en cours… » |
| Étape 4 synthèse | « {n} valides · {n} avertissements · {n} erreurs · {n} doublons » |
| Statut row valide | `✓ Valide` |
| Statut row warning | `⚠ {n} avertissement(s)` |
| Statut row erreur | `✗ {n} erreur(s)` |
| Statut row doublon | `⊜ Doublon de {ref}` |
| Bulk exclude_errors | « Exclure toutes les rows en erreur » |
| Confirmation commit | « Je comprends que les témoignages seront en attente de modération » |
| Succès commit | « ✓ Import réussi — {n} rituels créés en PENDING » |
| Rollback warning | « Cette action va masquer (status HIDDEN) les {n} témoignages créés » |

### 19.2 Bulk — chaînes clés

| Surface | Chaîne |
| --- | --- |
| Compteur sélection | `{n} rituel(s) sélectionné(s)` |
| Bouton désélectionner | « Désélectionner » |
| Sélection globale | « Tout sélectionner sur les {n} résultats » |
| Action approve confirmation | « Tous les rituels sélectionnés vont passer en status APPROVED. » |
| Action reject confirmation | « Vous êtes sur le point de rejeter {n} témoignages. » |
| Action delete confirmation | « ATTENTION — Action irréversible. Saisir SUPPRIMER {n} RITUEL(S) pour confirmer. » |
| Action feature limite atteinte | « La limite featured est de 3 simultanés. {n} ignorés. » |
| Skip flagged option | « Appliquer uniquement aux {n} sans flag » |
| Réussite bulk | « ✓ Action réussie — {n} rituels {action} » |
| Erreur partielle | « ⚠ Action partiellement réussie — {n} OK, {m} en erreur » |

### 19.3 Erreurs import

| Code | Chaîne |
| --- | --- |
| `FILE_TOO_BIG` | « Le fichier est trop volumineux. Limite : 5 Mo (ou 50 Mo pour ZIP). » |
| `INVALID_ENCODING` | « Encodage non supporté. Veuillez convertir votre fichier en UTF-8 avant l'upload. » |
| `INVALID_FORMAT` | « Ce fichier ne correspond pas au format {format} attendu. » |
| `TOO_MANY_ROWS` | « Ce fichier contient {n} rows. Maximum : 500. Veuillez splitter en plusieurs imports. » |
| `ZIP_NO_MANIFEST` | « L'archive doit contenir un fichier rituels.csv ou rituels.json à la racine. » |
| `INVALID_PATH` | « Chemin invalide détecté dans l'archive : {path} » |
| `INVALID_FILENAME` | « Filename de photo non autorisé : {filename} » |
| `BULK_LIMIT_EXCEEDED` | « Vous avez sélectionné {n} rituels. Maximum : 1 000. Veuillez splitter en lots plus petits. » |
| `BULK_NEEDS_TYPE_CONFIRMATION` | « Saisir « SUPPRIMER {n} RITUEL(S) » pour confirmer cette suppression irréversible. » |

## 20. Admin (résumé des chaînes clés)

| Surface | Chaîne |
| --- | --- |
| Nav sidebar | `Rituels partagés` |
| Onglet queue | `Queue de modération` |
| Onglet publiés | `Publiés` |
| Onglet archivés | `Masqués / Rejetés` |
| Onglet insights | `Insights` |
| Onglet politique | `Politique` |
| Bouton approuver | `Approuver` |
| Bouton rejeter | `Rejeter` |
| Bouton masquer | `Masquer` |
| Bouton featured | `Mettre en avant` |
| Bouton unfeature | `Retirer la mise en avant` |
| Bouton restore | `Restaurer` |
| Auto-flag face | `Visage détecté` |
| Auto-flag emoji | `Émoticône détectée` |
| Auto-flag link | `Lien externe détecté` |
| Auto-flag short | `Texte court` |
| Auto-flag long | `Texte très long` |
| Auto-flag forbidden | `Mot signalé` |

## 21. Synthèse — règles du microcopy maison

1. **Aucune injonction.** Toujours invitation, suggestion, ouverture.
2. **Pas de validation rouge.** Les corrections sont des aides, pas des reproches.
3. **Le sujet est la maison, pas le site.** « La maison reçoit » plutôt que « Votre soumission est enregistrée ».
4. **Le verbe est sensoriel.** « Écouter », « lire », « accueillir » — pas « valider », « traiter », « soumettre ».
5. **Souheila signe quand elle apparaît.** Pas « FemiGlow » seul dans les e-mails ou la confirmation — toujours `Souheila · FemiGlow`.
6. **Le délai est nommé sans excuse.** « Sous 24 à 48 heures » est une promesse, pas un avertissement.
7. **Le prix dans le CTA reste rond.** `199 dh`, pas `199,00 dh`. La virgule alourdit.
8. **Le mot « gratuit » est interdit.** Seul « offerte » est admis (livraison offerte).
9. **Chaque chaîne passe le test du lecteur d'écran.** Si elle est ambiguë ou ironique, elle est réécrite.
10. **Toute chaîne nouvelle est validée par la maison avant de partir en prod.** Ce catalogue est la source de vérité, versionné dans `app_config`.
