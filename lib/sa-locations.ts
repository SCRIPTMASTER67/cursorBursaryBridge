import type { Province } from '@prisma/client';

/**
 * South African cities and towns offered by the location search field.
 *
 * Deliberately a plain module (no `server-only`) because the onboarding and
 * profile forms that consume it run in the browser.
 */
export const southAfricanCities: Record<Province, string[]> = {
  GAUTENG: ['Johannesburg', 'Pretoria', 'Soweto', 'Benoni', 'Boksburg', 'Centurion', 'Germiston', 'Kempton Park', 'Krugersdorp', 'Midrand', 'Roodepoort', 'Sandton', 'Springs', 'Vanderbijlpark', 'Vereeniging'],
  WESTERN_CAPE: ['Cape Town', 'Bellville', 'George', 'Paarl', 'Stellenbosch', 'Worcester', 'Mossel Bay', 'Oudtshoorn', 'Somerset West', 'Malmesbury'],
  KWAZULU_NATAL: ['Durban', 'Pietermaritzburg', 'Newcastle', 'Richards Bay', 'Umhlanga', 'Ladysmith', 'Empangeni', 'Port Shepstone', 'Pinetown'],
  EASTERN_CAPE: ['Gqeberha', 'East London', 'Mthatha', 'Queenstown', 'Uitenhage', 'Makhanda', 'King William’s Town', 'Butterworth', 'Alice'],
  FREE_STATE: ['Bloemfontein', 'Welkom', 'Bethlehem', 'Kroonstad', 'Sasolburg', 'Parys', 'Phuthaditjhaba'],
  LIMPOPO: ['Polokwane', 'Tzaneen', 'Thohoyandou', 'Mokopane', 'Lephalale', 'Musina', 'Giyani'],
  MPUMALANGA: ['Mbombela', 'Emalahleni', 'Secunda', 'Middelburg', 'Ermelo', 'Barberton', 'Standerton'],
  NORTH_WEST: ['Mahikeng', 'Rustenburg', 'Potchefstroom', 'Klerksdorp', 'Brits', 'Vryburg', 'Lichtenburg'],
  NORTHERN_CAPE: ['Kimberley', 'Upington', 'Springbok', 'De Aar', 'Kuruman', 'Kathu'],
};
