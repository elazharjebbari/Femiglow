/**
 * Concatène des classes CSS conditionnelles, tolère undefined / false / null.
 * Volontairement minimaliste — pas de dépendance clsx pour économiser le bundle.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
