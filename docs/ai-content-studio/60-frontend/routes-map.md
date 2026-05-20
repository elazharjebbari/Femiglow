# Frontend — routes admin

## Routes prototype

| Route | Rôle |
| --- | --- |
| `/admin/content-studio` | Dashboard studio |
| `/admin/content-studio/calendar` | Calendrier éditorial |
| `/admin/content-studio/ideas` | Bibliothèque d’idées |
| `/admin/content-studio/create` | Wizard création |
| `/admin/content-studio/drafts` | Brouillons à revoir |
| `/admin/content-studio/drafts/[id]` | Éditeur + preview + score |
| `/admin/content-studio/posts` | Posts programmés/publiés |
| `/admin/content-studio/campaigns` | Campagnes |
| `/admin/content-studio/settings` | Providers, Postiz, garde-fous |

## Composants principaux

| Composant | Rôle |
| --- | --- |
| `ContentStudioShell` | Layout section |
| `IdeaCapturePanel` | Capture intention |
| `BriefEditor` | Brief structuré |
| `DraftComposer` | Caption + hashtags + alt text |
| `BrandScorePanel` | Violations et score |
| `PlatformPreview` | Preview Instagram/Facebook |
| `AssetPicker` | Sélection media existant |
| `VisualDirectionPanel` | Prompts et références |
| `ApprovalBar` | Approve/reject/schedule |
| `EditorialCalendar` | Semaine/mois |
| `PipelineKanban` | Statuts |
| `PostizIntegrationCard` | Compte social sync |

## États UX critiques

| État | Comportement |
| --- | --- |
| Génération en cours | Progression claire, annulation possible |
| Score bloquant | Bouton schedule désactivé, raisons visibles |
| Postiz indisponible | Draft reste approved, retry proposé |
| Média non prêt | Afficher job media et action réparer/remplacer |
| Token expiré | Message admin clair, lien vers runbook Postiz |
| Aucun compte actif | Onboarding integration |

