/**
 * Données réalistes Maroc-aligned pour factories.
 *
 * Évite les "John Doe" générés par faker — privilégie des données qui
 * ressemblent au marché cible FemiGlow (femmes 25-40, MA).
 */
import { faker } from '@faker-js/faker';

const FIRST_NAMES_MA = [
  'Leila', 'Yasmine', 'Salma', 'Imane', 'Houda', 'Khadija', 'Aicha', 'Souad',
  'Fatima', 'Meryem', 'Sara', 'Nadia', 'Latifa', 'Najat', 'Karima', 'Samira',
] as const;

const LAST_NAMES_MA = [
  'El Amrani', 'Benani', 'Tazi', 'Bennani', 'Alaoui', 'Cherkaoui', 'Idrissi',
  'El Fassi', 'Berrada', 'Lahlou', 'Sefrioui', 'Bouhouch',
] as const;

const CITIES_MA = [
  'Casablanca', 'Rabat', 'Marrakech', 'Fès', 'Tanger', 'Agadir',
  'Meknès', 'Oujda', 'Tétouan', 'Salé', 'Kénitra', 'Mohammedia',
] as const;

export function maFirstName(): string {
  return faker.helpers.arrayElement(FIRST_NAMES_MA);
}

export function maLastName(): string {
  return faker.helpers.arrayElement(LAST_NAMES_MA);
}

export function maFullName(): { firstName: string; lastName: string } {
  return { firstName: maFirstName(), lastName: maLastName() };
}

/**
 * Format Maroc — `06XXXXXXXX` (mobile préfixe 6) ou `07XXXXXXXX` (préfixe 7).
 * Pour tests, on retourne toujours sans espaces, sans `+212`, format
 * canonical national.
 */
export function maPhone(): string {
  const prefix = faker.helpers.arrayElement(['06', '07']);
  return prefix + faker.string.numeric(8);
}

export function maPhoneInternational(): string {
  return '+212' + faker.helpers.arrayElement(['6', '7']) + faker.string.numeric(8);
}

export function maCity(): string {
  return faker.helpers.arrayElement(CITIES_MA);
}
