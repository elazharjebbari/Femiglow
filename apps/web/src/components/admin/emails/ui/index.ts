/**
 * Barrel du socle UI emails (charte 09 §A.2, gate G15).
 *
 * Point d'entrée stable et UNIQUE pour les écrans : `import { Button, Pill,
 * EmptyState, … } from '@/components/admin/emails/ui'`. Un export ici = un
 * contrat ; on ne réimporte jamais un sous-fichier au cas par cas pour un
 * primitif du socle.
 */

// Tokens (source unique de design)
export * from './tokens';

// Primitives présentationnelles
export { Pill, TONE_CLS } from './Pill';
export { Button, IconButton } from './Button';
export type { ButtonProps, IconButtonProps } from './Button';
export { Card } from './Card';
export type { CardProps } from './Card';
export { Field } from './Field';
export type { FieldProps, FieldAria } from './Field';
export { Input } from './Input';
export type { InputProps } from './Input';
export { Skeleton, SkeletonTable, SkeletonKpiCard } from './Skeleton';
export { Banner } from './Banner';
export type { BannerProps } from './Banner';
export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

// Feedback / dialogues / fraîcheur
export { ConfirmDialog } from './ConfirmDialog';
export type { ConfirmDialogProps } from './ConfirmDialog';
export { ToastProvider, useToast, useOptionalToast } from './toast';
export type { ToastApi } from './toast';
export { Freshness } from './Freshness';
export type { FreshnessProps } from './Freshness';
export { Wizard } from './Wizard';
export type { WizardProps, WizardStep } from './Wizard';

// Garde de saisie non sauvegardée
export { UnsavedChangesGuard, useBeforeUnloadGuard } from './use-dirty-guard';

// Dates / TZ (formatage centralisé)
export {
  DEFAULT_TIMEZONE,
  formatAge,
  formatAbsolute,
  timeZoneLabel,
} from './format-datetime';

// Assistance à la saisie (combobox d'entité) — promu socle (gate G11).
// Vit dans common/ (réutilisé hors emails à terme) ; ré-exporté ici comme
// primitive d'assistance officielle du socle.
export { EntityCombobox } from '../common/EntityCombobox';
export type { ComboboxOption, EntityComboboxProps } from '../common/EntityCombobox';
