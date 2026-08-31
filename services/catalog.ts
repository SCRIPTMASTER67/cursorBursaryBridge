import 'server-only';
import { cache } from 'react';
import { prisma } from '@/lib/db';

export type CatalogInstitution = {
  id: string;
  name: string;
  shortName: string | null;
  province: string;
  city: string;
};

export type CatalogProgramme = {
  id: string;
  name: string;
  field: string;
};

/**
 * Reference data loader.
 *
 * Cached per request so a page rendering several preference rows hits the
 * database once rather than once per row.
 */
export const getCatalog = cache(
  async (): Promise<{ institutions: CatalogInstitution[]; programmes: CatalogProgramme[] }> => {
    const [institutions, programmes] = await Promise.all([
      prisma.institution.findMany({
        select: { id: true, name: true, shortName: true, province: true, city: true },
        orderBy: { name: 'asc' },
      }),
      prisma.programme.findMany({
        select: { id: true, name: true, field: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { institutions, programmes };
  },
);

/** South African cities and towns offered by the location step's search field. */
export const southAfricanCities: Record<string, string[]> = {
  GAUTENG: ['Johannesburg', 'Pretoria', 'Soweto', 'Benoni', 'Boksburg', 'Centurion', 'Germiston', 'Kempton Park', 'Krugersdorp', 'Midrand', 'Roodepoort', 'Sandton', 'Springs', 'Vanderbijlpark', 'Vereeniging'],
  WESTERN_CAPE: ['Cape Town', 'Bellville', 'George', 'Paarl', 'Stellenbosch', 'Worcester', 'Mossel Bay', 'Oudtshoorn', 'Somerset West', 'Malmesbury'],
  KWAZULU_NATAL: ['Durban', 'Pietermaritzburg', 'Newcastle', 'Richards Bay', 'Umhlanga', 'Ladysmith', 'Empangeni', 'Port Shepstone', 'Pinetown'],
  EASTERN_CAPE: ['Gqeberha', 'East London', 'Mthatha', 'Queenstown', 'Uitenhage', 'Grahamstown', 'King William’s Town', 'Butterworth'],
  FREE_STATE: ['Bloemfontein', 'Welkom', 'Bethlehem', 'Kroonstad', 'Sasolburg', 'Parys', 'Phuthaditjhaba'],
  LIMPOPO: ['Polokwane', 'Tzaneen', 'Thohoyandou', 'Mokopane', 'Lephalale', 'Musina', 'Giyani'],
  MPUMALANGA: ['Mbombela', 'Emalahleni', 'Secunda', 'Middelburg', 'Ermelo', 'Barberton', 'Standerton'],
  NORTH_WEST: ['Mahikeng', 'Rustenburg', 'Potchefstroom', 'Klerksdorp', 'Brits', 'Vryburg', 'Lichtenburg'],
  NORTHERN_CAPE: ['Kimberley', 'Upington', 'Springbok', 'De Aar', 'Kuruman', 'Kathu'],
};
