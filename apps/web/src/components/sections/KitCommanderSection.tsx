'use client';

/**
 * CHA-231 — Section commander embarquée sur /kit.
 *
 * Embed du wizard checkout (Mode A — `wizard_kit`, `wizard_embed`) directement
 * dans la page produit. Ancre #commander-femiglow ciblée par la sticky CTA et
 * les boutons « Commander » in-page.
 *
 * Responsabilité
 * ──────────────
 * - Reçoit le snapshot panier déjà construit côté serveur (Server Component
 *   parent — `KitPage` — pour ne pas dupliquer la requête DB).
 * - Monte le WizardShell avec le profil Mode A (lead → address → thank_you).
 * - Encadre le shell dans un cadre éditorial sobre, voix FemiGlow.
 *
 * Pourquoi pas un Server Component ?
 * ──────────────────────────────────
 * Le WizardShell est `'use client'` (Zustand store + form state). On garde la
 * section côté client pour pouvoir injecter directement les props sans wrapper
 * intermédiaire. Le coût bundle est marginal (la section ne fait que rendre
 * du markup statique autour du WizardShell qui est déjà côté client).
 */

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import { WizardShell } from '@/components/checkout/wizard/WizardShell';
import { WizardMobilePackThumb } from '@/components/checkout/wizard/WizardMobilePackThumb';
import { DEFAULT_WIZARD_FEATURES } from '@/lib/checkout/copy/wizard-copy';
import { WizardScrollContainerProvider } from '@/components/checkout/wizard/wizard-scroll-container';
import type { CartSnapshot } from '@/lib/checkout/schemas/common';
import { useWizardStore, type WizardFormContext } from '@/lib/checkout/state/wizard-store';
import {
  COMMANDER_ANCHOR_ID,
  openCommander,
  useCommanderLauncherStore,
} from '@/lib/checkout/commander-launcher';
import type { CommanderCmsMode } from '@/lib/checkout/commander-mode';
import { useCommanderMode } from '@/lib/checkout/use-commander-mode';
import {
  KIT_CHECKOUT_EXPOSURE_EVENT,
  buildKitCheckoutExposureParams,
  claimKitCheckoutExposure,
} from '@/lib/checkout/kit-checkout-exposure';
import { readKitAngleFromDocument } from '@/lib/kit/angle';
import { readHeroMediaTrackingFromDocument } from '@/lib/kit/hero-media';
import { useTracking } from '@/lib/tracking/use-tracking';
import {
  DEFAULT_KIT_CHECKOUT_CONFIG,
  type KitCheckoutConfig,
} from '@/lib/checkout/kit-checkout-config';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface KitCommanderSectionProps {
  /** Snapshot panier construit côté serveur (variantId + prix + SKU). */
  initialCart: CartSnapshot;
  /** Kicker éditorial (optionnel — override possible côté CMS). */
  kicker?: string;
  /** Titre principal du bloc commander. */
  title?: string;
  /** Sous-titre (réassurance courte). */
  subtitle?: string;
  /** Slot custom au-dessus du wizard (ex. recap visuel produit). */
  preface?: ReactNode;
  /**
   * Image du pack à afficher dans le thumb mobile + le cart-recap.
   * Résolue côté serveur depuis la galerie hero (slot Component-Media
   * `kit-hero-produit/primary`) → cohérence visuelle hero → wizard.
   * Si undefined, les sous-composants retombent sur leur default
   * `/products/kit-principale.png`.
   */
  packImage?: { src: string; alt: string };
  /**
   * Phase 8 (7E-13) — langue du wizard checkout embarqué. Injectée dans le
   * `formContext` → `useWizardTranslation` sélectionne le dictionnaire
   * (`fr`/`ar`/`en`). En `ar` et `en`, on n'applique PAS l'override `copy` FR :
   * le wizard utilise le dictionnaire complet de la langue. La langue persistée
   * reste `fr|ar` (CHA-232) ; `en` est une langue d'affichage ramenée à `fr`
   * côté serveur.
   */
  wizardLanguage?: 'fr' | 'ar' | 'en';
  /** Coupon d'accueil résolu serveur → mention « geste d'accueil » au récap. */
  welcomeCoupon?: { active: boolean; postPurchaseCreditCents?: number };
  /**
   * Kit CRO v2 §2 — réglage CMS `kit-checkout` (défilement, panneau ou A/B).
   * Défaut : `scroll` (comportement historique).
   */
  checkoutConfig?: KitCheckoutConfig;
  /** Libellés localisés du panneau de commande (défaut FR). */
  sheetStrings?: KitCommanderSheetStrings;
}

export interface KitCommanderSheetStrings {
  /** Titre du panneau (nom accessible du dialogue). */
  title: string;
  /** `aria-label` du bouton de fermeture. */
  close: string;
  /** Emplacement réservé en ligne pendant que le panneau est ouvert. */
  placeholderTitle: string;
  placeholderBody: string;
  reopen: string;
}

export const DEFAULT_KIT_COMMANDER_SHEET_STRINGS: KitCommanderSheetStrings = {
  title: 'Commander le rituel',
  close: 'Fermer le formulaire de commande',
  placeholderTitle: 'Votre commande est ouverte',
  placeholderBody: 'Vos informations sont gardées\u00A0: reprenez où vous en étiez.',
  reopen: 'Reprendre ma commande',
};

// ─────────────────────────────────────────────────────────────────────────────
// Const — profil Mode A figé pour /kit
// ─────────────────────────────────────────────────────────────────────────────

const KIT_FORM_CONTEXT: WizardFormContext = {
  formId: 'wizard_kit',
  formMode: 'wizard_embed',
  variantKey: 'A',
  source: 'wizard_kit',
};

// CHA-231 : parcours simplifié (plus de step paiement UI). Le serveur
// auto-aligne `payment_selected_at` côté `/api/checkout/order`.
const KIT_STEPS = ['lead', 'address', 'thank_you'] as const;

/**
 * Hauteur minimale de l'emplacement réservé quand la carte n'a pas pu être
 * mesurée (premier rendu directement en panneau, environnement sans layout).
 */
const PLACEHOLDER_MIN_HEIGHT_CLASS = 'min-h-[16rem]';

/** Nombre max. d'images à attendre qu'un step lazy affiche son titre. */
const STEP_FOCUS_MAX_FRAMES = 30;

// SSR-safe : `useLayoutEffect` n'existe pas côté serveur.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// ─────────────────────────────────────────────────────────────────────────────
// Mode d'ouverture (scroll | sheet)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Résout le mode (override `?cta=`, réglage CMS, A/B par `fg_aid`) et le
 * pousse dans le lanceur. Isolé sous `<Suspense>` : `useSearchParams` ne
 * fait pas basculer toute la page en rendu client.
 *
 * Mesure du test A/B : dès que la variante est résolue (ici, ou plus tôt à
 * la demande par un clic), UN événement first-party `kit_checkout_exposure`
 * par page vue — après le chargement du consentement (`isReady`), sinon
 * `/api/track` l'écarterait.
 */
function CommanderModeSync({ cmsMode, sharePct }: { cmsMode: CommanderCmsMode; sharePct: number }) {
  useCommanderMode({ cmsMode, sharePct });
  const assignment = useCommanderLauncherStore((s) => s.assignment);
  const { emit, isReady } = useTracking();
  useEffect(() => {
    if (!assignment || !isReady) return;
    if (!claimKitCheckoutExposure()) return;
    emit(
      KIT_CHECKOUT_EXPOSURE_EVENT,
      buildKitCheckoutExposureParams({
        assignment,
        cmsMode: assignment.cmsMode,
        sharePct: assignment.sharePct,
        kitAngle: readKitAngleFromDocument(),
        heroMedia: readHeroMediaTrackingFromDocument(),
      }),
    );
  }, [assignment, isReady, emit]);
  return null;
}

/** Remonte le panneau en haut et place le focus sur le titre du step actif. */
function focusStepHeading(container: HTMLElement): () => void {
  container.scrollTop = 0;
  let frames = 0;
  let rafId = 0;
  const tryFocus = () => {
    const heading = container.querySelector<HTMLElement>('section[data-testid^="wizard-step-"] h2');
    if (heading) {
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
      return;
    }
    // Step chargé en lazy (Suspense) : on réessaie à l'image suivante.
    frames += 1;
    if (frames < STEP_FOCUS_MAX_FRAMES) rafId = window.requestAnimationFrame(tryFocus);
  };
  rafId = window.requestAnimationFrame(tryFocus);
  return () => window.cancelAnimationFrame(rafId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function KitCommanderSection({
  initialCart,
  kicker = 'Commander le rituel',
  title = 'Trois objets, livrés chez vous.',
  subtitle = 'Quelques coordonnées, une adresse au Maroc, et nous nous occupons du reste. Livraison\u00A0: Rabat en 24\u00A0h, reste du Maroc en 48 à 72\u00A0h.',
  preface,
  packImage,
  wizardLanguage,
  welcomeCoupon,
  checkoutConfig = DEFAULT_KIT_CHECKOUT_CONFIG,
  sheetStrings = DEFAULT_KIT_COMMANDER_SHEET_STRINGS,
}: KitCommanderSectionProps) {
  const mode = useCommanderLauncherStore((s) => s.mode);
  const isSheetOpen = useCommanderLauncherStore((s) => s.isSheetOpen);
  const closeCommander = useCommanderLauncherStore((s) => s.closeCommander);
  const registerSheetHost = useCommanderLauncherStore((s) => s.registerSheetHost);
  const configureCommander = useCommanderLauncherStore((s) => s.configure);
  const currentStep = useWizardStore((s) => s.currentStep);
  const sheetMode = mode === 'sheet';

  // Phase 8 (7E-13) — injecte la langue dans le formContext du wizard. En AR/EN,
  // le dictionnaire de la langue (`useWizardTranslation`) pilote tous les libellés.
  // Kit CRO v2 — la variante d'ouverture est portée par `variantKey`
  // (A = défilement, B = panneau) jusqu'à `orders.variant_key`. `mode` est
  // posé par la résolution de la variante (effet de synchronisation OU clic
  // antérieur, résolu à la demande) : la clé suit toujours le bras attribué.
  const formContext = useMemo<WizardFormContext>(
    () => ({
      ...KIT_FORM_CONTEXT,
      variantKey: sheetMode ? 'B' : 'A',
      ...(wizardLanguage ? { language: wizardLanguage } : {}),
    }),
    [sheetMode, wizardLanguage],
  );

  // Cette section sait afficher le panneau : le lanceur peut l'utiliser.
  useEffect(() => registerSheetHost(), [registerSheetHost]);

  // Réglage admin déclaré au plus tôt (effet de layout, avant tout effet
  // passif) : un clic arrivé avant la synchronisation résout déjà la bonne
  // variante. Section démontée : retour au défilement historique.
  const { ctaMode, sheetSharePct } = checkoutConfig;
  useIsomorphicLayoutEffect(() => {
    configureCommander({ cmsMode: ctaMode, sharePct: sheetSharePct });
  }, [configureCommander, ctaMode, sheetSharePct]);
  useEffect(() => () => configureCommander(null), [configureCommander]);

  // UNE seule instance du wizard montée à la fois. Elle passe dans le panneau
  // dès l'ouverture et n'en ressort qu'après l'animation de sortie
  // (`onExitComplete`) — l'état vit dans le store persistant, le remontage ne
  // perd rien. Mise à jour pendant le rendu (état dérivé) : aucune image où
  // les deux emplacements montent le wizard.
  const [sheetPresent, setSheetPresent] = useState(false);
  if (sheetMode && isSheetOpen && !sheetPresent) setSheetPresent(true);
  const wizardInSheet = sheetMode && sheetPresent;
  const onSheetExitComplete = useCallback(() => setSheetPresent(false), []);

  // Hauteur réelle de la carte en ligne (padding responsive et bordure
  // compris), mesurée tant qu'elle contient le wizard, donc juste avant que
  // celui-ci parte dans le panneau. Appliquée à la carte (border-box) pendant
  // l'ouverture : la page ne saute pas sous le panneau, quel que soit le
  // breakpoint.
  const inlineCardRef = useRef<HTMLDivElement>(null);
  const inlineHeightRef = useRef<number | undefined>(undefined);
  useIsomorphicLayoutEffect(() => {
    if (!wizardInSheet && inlineCardRef.current) {
      const { height } = inlineCardRef.current.getBoundingClientRect();
      inlineHeightRef.current = height > 0 ? Math.round(height) : undefined;
    }
  });
  const reservedHeight = wizardInSheet ? inlineHeightRef.current : undefined;

  // Arrivée avec `#commander-femiglow` (lien partagé, bandeau promo d'une
  // autre page) : en mode panneau, on l'ouvre directement. Une seule fois.
  const handledHashRef = useRef(false);
  useEffect(() => {
    if (!sheetMode || handledHashRef.current) return;
    handledHashRef.current = true;
    if (window.location.hash === `#${COMMANDER_ANCHOR_ID}`) openCommander({ source: 'hash' });
  }, [sheetMode]);

  // Changement d'étape dans le panneau (et ouverture) : haut du panneau +
  // focus sur le titre du step (lecteur d'écran, clavier).
  // Ref-état : le corps du panneau est monté par le portail Radix, parfois
  // un rendu APRÈS l'ouverture — l'effet doit se relancer à son arrivée.
  const sheetBodyRef = useRef<HTMLDivElement | null>(null);
  const [sheetBody, setSheetBody] = useState<HTMLDivElement | null>(null);
  const attachSheetBody = useCallback((node: HTMLDivElement | null) => {
    sheetBodyRef.current = node;
    setSheetBody(node);
  }, []);
  useEffect(() => {
    if (!wizardInSheet || !isSheetOpen || !sheetBody) return;
    return focusStepHeading(sheetBody);
  }, [currentStep, wizardInSheet, isSheetOpen, sheetBody]);
  const getSheetBody = useCallback(() => sheetBodyRef.current, []);

  const onSheetOpenChange = useCallback(
    (open: boolean) => {
      if (!open) closeCommander();
    },
    [closeCommander],
  );

  const wizard = (
    <WizardShell
      formContext={formContext}
      steps={[...KIT_STEPS]}
      initialCart={initialCart}
      welcomeCoupon={welcomeCoupon}
      cartRecapThumbnailSrc={packImage?.src}
      // FR : override marketing custom. AR/EN : pas d'override → le
      // dictionnaire complet de la langue fournit tous les libellés.
      copy={
        wizardLanguage && wizardLanguage !== 'fr'
          ? undefined
          : {
              title: 'Commander le rituel FemiGlow',
              // Kolenda §5 W1 (P2) — CTA outcome qui désamorce la peur
              // du paiement upfront (Trust #1 loss aversion).
              ctaLead: 'Continuer · paiement à la livraison',
              ctaAddress: 'Confirmer la commande',
              thankYouTitle: 'Commande reçue, on vous rappelle.',
            }
      }
      paymentMethods={['cod']}
    />
  );

  return (
    <section
      id={COMMANDER_ANCHOR_ID}
      aria-labelledby="kit-commander-heading"
      data-testid="kit-commander-section"
      data-commander-mode={mode}
      className="scroll-mt-24 bg-creme py-16 lg:py-24"
    >
      <Suspense fallback={null}>
        <CommanderModeSync cmsMode={checkoutConfig.ctaMode} sharePct={checkoutConfig.sheetSharePct} />
      </Suspense>
      <Container width="content" padded>
        {/* Kolenda §5 W3 P7 — thumb pack 64×80 mobile only (< lg).
            Image résolue côté server depuis `kit-hero-produit/primary`
            (Component-Media) → packshot dynamique cohérent avec le hero. */}
        <header className="mb-10 flex max-w-2xl gap-4">
          {DEFAULT_WIZARD_FEATURES.mobilePackThumbnail && (
            <WizardMobilePackThumb
              src={packImage?.src}
              alt={packImage?.alt}
            />
          )}
          <div className="space-y-3">
            <Text
              size="small"
              tone="secondary"
              className="uppercase tracking-[0.18em]"
            >
              {kicker}
            </Text>
            <Heading
              as="h2"
              size="display-md"
              italic="always"
              id="kit-commander-heading"
            >
              {title}
            </Heading>
            <Text
              tone="secondary"
              // Subtitle peut contenir un &nbsp; — on s'autorise dangerouslySet ?
              // Non : on garde du texte plat et on laisse le navigateur gérer
              // l'espacement. Le NBSP littéral fonctionne en JSX.
            >
              {subtitle.replace(/&nbsp;/g, '\u00a0')}
            </Text>
          </div>
        </header>

        {preface}

        <div
          ref={inlineCardRef}
          data-testid="kit-commander-card"
          className={
            'mx-auto max-w-2xl rounded border border-encre/10 bg-white p-6 shadow-sm sm:p-8 lg:p-10' +
            (wizardInSheet ? ' flex flex-col' : '')
          }
          style={reservedHeight ? { minHeight: reservedHeight } : undefined}
        >
          {wizardInSheet ? (
            <div
              data-testid="kit-commander-sheet-placeholder"
              className={`flex flex-1 flex-col items-center justify-center gap-4 text-center ${PLACEHOLDER_MIN_HEIGHT_CLASS}`}
            >
              <Text className="font-medium">{sheetStrings.placeholderTitle}</Text>
              <Text size="small" tone="secondary">
                {sheetStrings.placeholderBody}
              </Text>
              <Button
                variant="secondary"
                onClick={() => openCommander({ source: 'inline_placeholder' })}
                data-testid="kit-commander-sheet-reopen"
              >
                {sheetStrings.reopen}
              </Button>
            </div>
          ) : (
            wizard
          )}
        </div>
      </Container>

      {sheetMode && (
        <BottomSheet
          ref={attachSheetBody}
          open={isSheetOpen}
          onOpenChange={onSheetOpenChange}
          onExitComplete={onSheetExitComplete}
          title={sheetStrings.title}
          closeLabel={sheetStrings.close}
          dir={wizardLanguage === 'ar' ? 'rtl' : 'ltr'}
          data-testid="kit-commander-sheet"
          // p-6 en mobile : le récap panier (`sticky top-0 -mx-6 -mt-6`) se
          // colle en haut du panneau, bord à bord, comme dans la carte.
          bodyClassName="px-6 pb-10 pt-6 sm:p-8"
        >
          {wizardInSheet ? (
            <WizardScrollContainerProvider getContainer={getSheetBody}>{wizard}</WizardScrollContainerProvider>
          ) : null}
        </BottomSheet>
      )}
    </section>
  );
}
