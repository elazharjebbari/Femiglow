# Microcopy — ton & vocabulaire

## Ton général

- **Tutoiement** ("Tu peux modifier...") — cohérent avec FemiGlow B2C
- **Direct, factuel** — pas d'humour, pas de "Oops"
- **Concret** — pas de jargon ESP ; "ouverture" plutôt que "open rate"
- **Bilingue cohérent** — UI 100% français, slugs/types en anglais (`cart.abandoned`)

## Vocabulaire standardisé

| Anglais usuel | Français retenu |
|---|---|
| audience | audience (terme reconnu) |
| segment | segment (équivalent) |
| campaign | campagne |
| transactional | transactionnel |
| automation | automation (vs "automatisation" : on garde anglicisme court) |
| workflow | workflow |
| trigger | déclencheur (substantif) / déclencher (verbe) |
| run | exécution |
| step | étape |
| send | envoi (subst.) / envoyer (verbe) |
| open rate | taux d'ouverture |
| click rate | taux de clic |
| bounce | rejet ; hard bounce = rejet définitif ; soft = temporaire |
| unsubscribe | désinscription |
| suppression list | liste de suppression |
| double opt-in | double confirmation |
| draft | brouillon |
| schedule | planifier (verbe) / planning (subst.) |
| snapshot | snapshot (technique, conservé) |
| cooldown | délai de répétition (UI) / cooldown (technique) |
| quiet hours | heures de silence |

## Boutons

| Action | Texte |
|---|---|
| Créer | "Créer" (jamais "Soumettre") |
| Sauvegarder | "Enregistrer" |
| Annuler | "Annuler" |
| Retour | "← Retour" |
| Suivant | "Continuer →" |
| Confirmer | "Confirmer" |
| Supprimer | "Supprimer" |
| Activer | "Activer" / "Désactiver" |
| Lancer | "Lancer" (snapshot, campagne) |
| Tester | "Tester" |

## Confirmations

```
Action destructive :
  Titre        : "Supprimer l'audience ?"
  Body         : "Cette action est irréversible. Les snapshots associés
                  seront aussi supprimés (X snapshots, Y emails au total)."
  CTA primary  : "Supprimer" (style danger)
  CTA secondary: "Annuler"
  Require text : "supprimer" (tapé en minuscules)
```

```
Action coûteuse :
  Titre        : "Lancer l'envoi à 1 247 contacts ?"
  Body         : "L'envoi commencera immédiatement. Tu pourras consulter
                  les stats en temps réel sur la page détail."
  CTA primary  : "Lancer maintenant"
  CTA secondary: "Annuler"
```

## Tooltips

Format : phrase courte, 1 ligne idéal.

| Élément | Tooltip |
|---|---|
| Status badge "delivered" | "Email reçu par le destinataire (confirmé par Stalwart)" |
| Status badge "bounced_hard" | "Adresse définitivement invalide. Ajoutée à la suppression list." |
| Audience type "dynamic" | "Re-évaluée au moment de chaque envoi" |
| Audience type "static" | "Figée au moment du snapshot. Ne change plus." |
| Step "wait_for_event" | "Attend qu'un événement précis se produise, ou expire après un délai." |
| Quiet hours | "Empêche l'envoi entre {start} et {end}. Les sends nocturnes sont décalés." |

## Empty states

Voir [03-empty-states.md](03-empty-states.md).

## Erreurs

Voir [04-error-states.md](04-error-states.md).

## Statuts (badges)

| Statut | Badge text | Couleur |
|---|---|---|
| pending | "en attente" | gris |
| queued | "en file" | gris foncé |
| sending | "en cours" | bleu |
| sent | "envoyé" | bleu clair |
| delivered | "reçu" | vert |
| failed | "échec" | rouge |
| bounced_soft | "soft bounce" | ambre |
| bounced_hard | "hard bounce" | rouge |
| suppressed | "supprimé" | gris (strikethrough) |
| active (automation) | "active" | vert |
| draft | "brouillon" | gris |
| running (run) | "en cours" | bleu |
| waiting_for_event | "en attente d'event" | bleu pâle |
| completed | "terminé" | vert |
| errored | "erreur" | rouge |
| cancelled | "annulé" | gris |

## Confirmations de succès (toasts)

```
✓ "Audience créée"
✓ "Snapshot lancé (1 247 contacts)"
✓ "Automation activée"
✓ "12 emails retried"
✓ "View sauvegardée"
```

Format : "Action passée" — court, factuel.

## Helpers UI

```
ℹ icon = info
⚠ icon = avertissement (action requise mais pas critique)
⚠ rouge = erreur ou action critique
✓ = succès
✗ = échec
⏳ = en cours/en attente
🟢 ⚪ 🔴 = active / inactive / erreur
```

## i18n future

Si V2 i18n, externaliser tous les strings en `messages/{lang}.json` —
préparer dès maintenant les clefs : `audience.create.button`, etc.
Pas en V1.
