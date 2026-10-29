/**
 * Arrivée sur le formulaire /kit (sticky « Commander », flag « Code appliqué »,
 * CTA in-page).
 *
 * 1. CENTRAGE — la zone d'action (le step actif : titre court, « deux
 *    informations seulement », champs, bouton) est centrée dans la bande
 *    réellement visible, entre le header fixe et la sticky d'achat. Avant :
 *    `scrollIntoView({block:'start'})` posait le titre de section en haut et
 *    les champs sous la ligne de flottaison.
 * 2. ACCUEIL — une fois le défilement terminé, une seule passe très douce :
 *    halo sauge autour de la carte (« c'est ici »), puis le premier champ vide
 *    se teinte de sauge (« commencez là »). Vert = tout va bien, jamais une
 *    couleur d'erreur ; pas de boucle ; rien sous `prefers-reduced-motion`.
 *    Le clavier ne s'ouvre jamais tout seul sur mobile (focus du champ
 *    uniquement avec un pointeur fin).
 *
 * Les styles vivent dans `globals.css` (`[data-fg-arrival]`).
 */

/** Marge de respiration entre la zone centrée et les barres fixes. */
const BAND_GAP_PX = 12;
/** Durée totale de l'accueil (halo 1,6 s ; champ 0,35 s + 1,4 s). */
const ARRIVAL_MS = 2000;
/** Repli si `scrollend` n'est pas supporté (Safari < 18). */
const SCROLL_FALLBACK_MS = 900;

export interface CenterInput {
  /** Haut absolu (document) et hauteur de la zone à montrer. */
  zoneTop: number;
  zoneHeight: number;
  /** Hauteur de la zone de repli (le `<form>`) si la zone ne tient pas. */
  fallbackTop?: number;
  fallbackHeight?: number;
  viewportHeight: number;
  /** Hauteur masquée en haut (header fixe) et en bas (sticky d'achat). */
  topInset: number;
  bottomInset: number;
}

/**
 * Position de scroll (pur, testable) qui centre la zone dans la bande
 * visible. Si elle ne tient pas, on essaie le repli ; s'il ne tient pas non
 * plus, on aligne son haut sur le haut de la bande (les champs d'abord).
 */
export function centeredScrollTop(input: CenterInput): number {
  const bandTop = input.topInset + BAND_GAP_PX;
  const bandHeight = Math.max(0, input.viewportHeight - input.topInset - input.bottomInset - 2 * BAND_GAP_PX);

  const fit = (top: number, height: number) => top - bandTop - (bandHeight - height) / 2;

  if (input.zoneHeight <= bandHeight) return Math.max(0, Math.round(fit(input.zoneTop, input.zoneHeight)));
  if (input.fallbackTop !== undefined && input.fallbackHeight !== undefined) {
    if (input.fallbackHeight <= bandHeight) {
      return Math.max(0, Math.round(fit(input.fallbackTop, input.fallbackHeight)));
    }
    return Math.max(0, Math.round(input.fallbackTop - bandTop));
  }
  return Math.max(0, Math.round(input.zoneTop - bandTop));
}

function isPinned(el: Element): boolean {
  const pos = getComputedStyle(el).position;
  return pos === 'fixed' || pos === 'sticky';
}

/** Hauteur couverte en haut par le header fixe / la barre d'annonce. */
function measureTopInset(): number {
  let inset = 0;
  document.querySelectorAll('header, [role="banner"]').forEach((el) => {
    // Un header sticky n'est collé qu'une fois défilé : on prend sa hauteur.
    if (!isPinned(el)) return;
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.height < window.innerHeight / 3) inset = Math.max(inset, r.height + Math.max(0, r.top));
  });
  return inset;
}

/** Hauteur couverte en bas par la sticky d'achat (+ son flag) en mobile. */
function measureBottomInset(): number {
  const sticky = document.querySelector('[data-testid="sticky-cart-cta"]');
  if (!(sticky instanceof HTMLElement)) return 0;
  const r = sticky.getBoundingClientRect();
  // En desktop la sticky est une carte flottante à droite : elle ne couvre
  // pas la colonne du formulaire.
  if (r.width < window.innerWidth * 0.8) return 0;
  const flag = sticky.querySelector('[data-testid="sticky-promo-flag"]');
  const flagHeight = flag instanceof HTMLElement ? flag.getBoundingClientRect().height : 0;
  return r.height + flagHeight;
}

function firstEmptyField(zone: Element): HTMLInputElement | null {
  const inputs = zone.querySelectorAll<HTMLInputElement>(
    'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([tabindex="-1"]):not([disabled])',
  );
  for (const input of Array.from(inputs)) {
    if (!input.value) return input;
  }
  return null;
}

function playArrival(card: HTMLElement | null, field: HTMLElement | null): void {
  const marked = [card, field].filter((el): el is HTMLElement => !!el);
  marked.forEach((el) => {
    // Relance propre si on clique deux fois de suite.
    el.removeAttribute('data-fg-arrival');
    void el.offsetWidth;
    el.setAttribute('data-fg-arrival', el === card ? 'card' : 'field');
  });
  window.setTimeout(() => marked.forEach((el) => el.removeAttribute('data-fg-arrival')), ARRIVAL_MS);
}

function whenScrollSettles(done: () => void): void {
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    window.removeEventListener('scrollend', finish);
    done();
  };
  window.addEventListener('scrollend', finish, { once: true });
  window.setTimeout(finish, SCROLL_FALLBACK_MS);
}

/**
 * Défile jusqu'au formulaire, centré, puis joue l'accueil. Sans wizard dans
 * l'ancre (ex. page sans funnel), retombe sur l'ancien `scrollIntoView`.
 */
export function arriveAtCommander(anchorId = 'commander-femiglow'): void {
  const target = document.getElementById(anchorId);
  if (!target) return;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth';

  const shell = target.querySelector('[data-testid="wizard-shell"]');
  if (!(shell instanceof HTMLElement)) {
    target.scrollIntoView({ behavior, block: 'start' });
    return;
  }

  const zone = shell.querySelector('section[data-testid^="wizard-step-"]') ?? shell;
  const form = zone.querySelector('form');
  const zoneRect = zone.getBoundingClientRect();
  const formRect = form?.getBoundingClientRect();
  const top = centeredScrollTop({
    zoneTop: zoneRect.top + window.scrollY,
    zoneHeight: zoneRect.height,
    fallbackTop: formRect ? formRect.top + window.scrollY : undefined,
    fallbackHeight: formRect?.height,
    viewportHeight: window.innerHeight,
    topInset: measureTopInset(),
    bottomInset: measureBottomInset(),
  });

  const alreadyThere = Math.abs(window.scrollY - top) < 2;
  window.scrollTo({ top, behavior });

  const field = firstEmptyField(zone);
  const onArrived = () => {
    // Pointeur fin (souris) : on place le curseur dans le premier champ vide.
    // Tactile : jamais (le clavier masquerait la page et la rassurance) — on
    // focus le shell pour que la lecture d'écran reprenne au step actif.
    const finePointer = window.matchMedia?.('(pointer: fine)').matches ?? false;
    if (finePointer && field) {
      field.focus({ preventScroll: true });
    } else {
      shell.setAttribute('tabindex', '-1');
      shell.focus({ preventScroll: true });
    }
    if (!reduceMotion) playArrival(shell.parentElement, field);
  };

  if (alreadyThere || reduceMotion) onArrived();
  else whenScrollSettles(onArrived);
}
