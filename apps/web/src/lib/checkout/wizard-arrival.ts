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
/** Délai au-delà duquel un défilement `smooth` qui n'a pas bougé est forcé. */
const SMOOTH_START_GUARD_MS = 400;

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

/** Élément fixe/sticky (lui ou un ancêtre) sous le point, s'il y en a un. */
function pinnedAt(x: number, y: number): Element | null {
  // `?.` : absent en jsdom (tests).
  let el = document.elementFromPoint?.(x, y) ?? null;
  while (el && el !== document.body && el !== document.documentElement) {
    if (isPinned(el)) return el;
    el = el.parentElement;
  }
  return null;
}

/**
 * Hauteur couverte en haut : on empile les éléments collés depuis le haut de
 * l'écran (header, barre d'annonce `geo-promo-slide-header`, futurs bandeaux)
 * — sans liste figée. Plus le récap panier du wizard, `sticky top-0` en
 * mobile : une fois arrivée dans le formulaire, il se colle lui aussi.
 */
function measureTopInset(shell: Element): number {
  let inset = 0;
  const x = window.innerWidth / 2;
  for (let i = 0; i < 6; i += 1) {
    const el = pinnedAt(x, inset + 1);
    if (!el || shell.contains(el)) break;
    const bottom = el.getBoundingClientRect().bottom;
    if (bottom <= inset || bottom > window.innerHeight / 2) break;
    inset = bottom;
  }
  const recap = shell.querySelector('[data-testid="wizard-cart-recap"]');
  if (recap && getComputedStyle(recap).position === 'sticky') {
    const stickyTop = parseFloat(getComputedStyle(recap).top) || 0;
    inset = Math.max(inset, stickyTop + recap.getBoundingClientRect().height);
  }
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

/** Incrémenté à chaque arrivée : un double clic annule la précédente. */
let arrivalToken = 0;
let arrivalCleanup: (() => void) | null = null;

function playArrival(card: HTMLElement | null, field: HTMLElement | null): void {
  arrivalCleanup?.();
  const marked = [card, field].filter((el): el is HTMLElement => !!el);
  marked.forEach((el) => {
    // Relance propre si on clique deux fois de suite.
    el.removeAttribute('data-fg-arrival');
    void el.offsetWidth;
    el.setAttribute('data-fg-arrival', el === card ? 'card' : 'field');
  });
  const clear = () => marked.forEach((el) => el.removeAttribute('data-fg-arrival'));
  const timer = window.setTimeout(() => {
    clear();
    arrivalCleanup = null;
  }, ARRIVAL_MS);
  arrivalCleanup = () => {
    window.clearTimeout(timer);
    clear();
  };
}

/**
 * Appelle `done` quand le défilement est VRAIMENT fini : position atteinte,
 * ou position stable 250 ms (cible bornée par le bas de page), plafond 3 s.
 * `scrollend` n'est pas fiable ici : un défilement intermédiaire (clic sur
 * l'onglet, focus) le déclenche avant la fin du trajet.
 */
function whenScrollSettles(targetTop: number, token: number, done: () => void): void {
  const start = performance.now();
  let lastY = window.scrollY;
  let stableSince = start;
  const tick = (now: number) => {
    if (token !== arrivalToken) return;
    const y = window.scrollY;
    if (Math.abs(y - lastY) >= 1) {
      lastY = y;
      stableSince = now;
    }
    const reached = Math.abs(y - targetTop) < 3;
    const stalled = now - stableSince > 250 && now - start > 400;
    if (reached || stalled || now - start > 3000) done();
    else window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
}

/**
 * Défile jusqu'au formulaire, centré, puis joue l'accueil. Sans wizard dans
 * l'ancre (ex. page sans funnel), retombe sur l'ancien `scrollIntoView`.
 */
export interface ArriveOptions {
  /**
   * Hauteur à réserver en plus au-dessus de la sticky (ex. le toast « code
   * déjà appliqué » du flag promo, rendu juste après le clic et qui sinon
   * masquerait le bouton du formulaire pendant 4 s).
   */
  extraBottomInset?: number;
}

export function arriveAtCommander(
  anchorId = 'commander-femiglow',
  { extraBottomInset = 0 }: ArriveOptions = {},
): void {
  const target = document.getElementById(anchorId);
  if (!target) return;
  const token = (arrivalToken += 1);
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
    topInset: measureTopInset(shell),
    bottomInset: measureBottomInset() + extraBottomInset,
  });

  const alreadyThere = Math.abs(window.scrollY - top) < 2;
  window.scrollTo({ top, behavior });

  const field = firstEmptyField(zone);
  const onArrived = () => {
    if (token !== arrivalToken) return;
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

  if (alreadyThere || reduceMotion) {
    onArrived();
    return;
  }
  // Filet : si le défilement `smooth` n'a pas démarré (navigateur qui l'ignore
  // hors geste utilisateur), on saute directement à la cible.
  const startY = window.scrollY;
  window.setTimeout(() => {
    if (token === arrivalToken && Math.abs(window.scrollY - startY) < 2) {
      window.scrollTo({ top, behavior: 'auto' });
    }
  }, SMOOTH_START_GUARD_MS);
  whenScrollSettles(top, token, onArrived);
}
