import type {
  CareerInterest,
  InstitutionType,
  Province,
  QualificationLevel,
} from '@prisma/client';

/** Public South African institutions used by the standardised catalogue. */
export const institutions: {
  name: string;
  shortName: string;
  type: InstitutionType;
  province: Province;
  city: string;
}[] = [
  { name: 'University of Pretoria', shortName: 'UP', type: 'UNIVERSITY', province: 'GAUTENG', city: 'Pretoria' },
  { name: 'University of Johannesburg', shortName: 'UJ', type: 'UNIVERSITY', province: 'GAUTENG', city: 'Johannesburg' },
  { name: 'University of the Witwatersrand', shortName: 'Wits', type: 'UNIVERSITY', province: 'GAUTENG', city: 'Johannesburg' },
  { name: 'University of Cape Town', shortName: 'UCT', type: 'UNIVERSITY', province: 'WESTERN_CAPE', city: 'Cape Town' },
  { name: 'Stellenbosch University', shortName: 'SU', type: 'UNIVERSITY', province: 'WESTERN_CAPE', city: 'Stellenbosch' },
  { name: 'University of the Western Cape', shortName: 'UWC', type: 'UNIVERSITY', province: 'WESTERN_CAPE', city: 'Cape Town' },
  { name: 'North-West University', shortName: 'NWU', type: 'UNIVERSITY', province: 'NORTH_WEST', city: 'Potchefstroom' },
  { name: 'University of KwaZulu-Natal', shortName: 'UKZN', type: 'UNIVERSITY', province: 'KWAZULU_NATAL', city: 'Durban' },
  { name: 'Nelson Mandela University', shortName: 'NMU', type: 'UNIVERSITY', province: 'EASTERN_CAPE', city: 'Gqeberha' },
  { name: 'Rhodes University', shortName: 'RU', type: 'UNIVERSITY', province: 'EASTERN_CAPE', city: 'Makhanda' },
  { name: 'University of the Free State', shortName: 'UFS', type: 'UNIVERSITY', province: 'FREE_STATE', city: 'Bloemfontein' },
  { name: 'University of Limpopo', shortName: 'UL', type: 'UNIVERSITY', province: 'LIMPOPO', city: 'Polokwane' },
  { name: 'University of Venda', shortName: 'Univen', type: 'UNIVERSITY', province: 'LIMPOPO', city: 'Thohoyandou' },
  { name: 'University of Fort Hare', shortName: 'UFH', type: 'UNIVERSITY', province: 'EASTERN_CAPE', city: 'Alice' },
  { name: 'Sol Plaatje University', shortName: 'SPU', type: 'UNIVERSITY', province: 'NORTHERN_CAPE', city: 'Kimberley' },
  { name: 'Tshwane University of Technology', shortName: 'TUT', type: 'UNIVERSITY_OF_TECHNOLOGY', province: 'GAUTENG', city: 'Pretoria' },
  { name: 'Cape Peninsula University of Technology', shortName: 'CPUT', type: 'UNIVERSITY_OF_TECHNOLOGY', province: 'WESTERN_CAPE', city: 'Cape Town' },
  { name: 'Durban University of Technology', shortName: 'DUT', type: 'UNIVERSITY_OF_TECHNOLOGY', province: 'KWAZULU_NATAL', city: 'Durban' },
  { name: 'Vaal University of Technology', shortName: 'VUT', type: 'UNIVERSITY_OF_TECHNOLOGY', province: 'GAUTENG', city: 'Vanderbijlpark' },
  { name: 'Central University of Technology', shortName: 'CUT', type: 'UNIVERSITY_OF_TECHNOLOGY', province: 'FREE_STATE', city: 'Bloemfontein' },
  { name: 'Mangosuthu University of Technology', shortName: 'MUT', type: 'UNIVERSITY_OF_TECHNOLOGY', province: 'KWAZULU_NATAL', city: 'Durban' },
  { name: 'Ekurhuleni East TVET College', shortName: 'EEC', type: 'TVET_COLLEGE', province: 'GAUTENG', city: 'Benoni' },
  { name: 'False Bay TVET College', shortName: 'FBC', type: 'TVET_COLLEGE', province: 'WESTERN_CAPE', city: 'Cape Town' },
  { name: 'Motheo TVET College', shortName: 'MTC', type: 'TVET_COLLEGE', province: 'FREE_STATE', city: 'Bloemfontein' },
];

/** Standardised courses. `field` drives career-interest alignment. */
export const programmes: {
  name: string;
  field: CareerInterest;
  qualificationLevels: QualificationLevel[];
}[] = [
  { name: 'Computer Science', field: 'TECHNOLOGY', qualificationLevels: ['BACHELORS', 'HONOURS', 'MASTERS', 'DOCTORAL'] },
  { name: 'Information Technology', field: 'TECHNOLOGY', qualificationLevels: ['DIPLOMA', 'ADVANCED_DIPLOMA', 'BACHELORS'] },
  { name: 'Information Systems', field: 'TECHNOLOGY', qualificationLevels: ['BACHELORS', 'HONOURS'] },
  { name: 'Data Science', field: 'TECHNOLOGY', qualificationLevels: ['BACHELORS', 'HONOURS', 'MASTERS'] },
  { name: 'Software Engineering', field: 'TECHNOLOGY', qualificationLevels: ['BACHELORS', 'HONOURS'] },
  { name: 'Cyber Security', field: 'TECHNOLOGY', qualificationLevels: ['DIPLOMA', 'BACHELORS', 'HONOURS'] },
  { name: 'Computer Engineering', field: 'ENGINEERING', qualificationLevels: ['BACHELORS', 'HONOURS'] },
  { name: 'Electrical Engineering', field: 'ENGINEERING', qualificationLevels: ['DIPLOMA', 'BACHELORS', 'HONOURS', 'MASTERS'] },
  { name: 'Mechanical Engineering', field: 'ENGINEERING', qualificationLevels: ['DIPLOMA', 'BACHELORS', 'HONOURS', 'MASTERS'] },
  { name: 'Civil Engineering', field: 'ENGINEERING', qualificationLevels: ['DIPLOMA', 'BACHELORS', 'HONOURS'] },
  { name: 'Chemical Engineering', field: 'ENGINEERING', qualificationLevels: ['BACHELORS', 'HONOURS', 'MASTERS'] },
  { name: 'Industrial Engineering', field: 'ENGINEERING', qualificationLevels: ['BACHELORS', 'HONOURS'] },
  { name: 'Mining Engineering', field: 'MINING', qualificationLevels: ['BACHELORS', 'HONOURS'] },
  { name: 'Metallurgical Engineering', field: 'MINING', qualificationLevels: ['BACHELORS', 'HONOURS'] },
  { name: 'Accounting', field: 'FINANCE_ACCOUNTING', qualificationLevels: ['DIPLOMA', 'BACHELORS', 'HONOURS'] },
  { name: 'Financial Management', field: 'FINANCE_ACCOUNTING', qualificationLevels: ['DIPLOMA', 'BACHELORS'] },
  { name: 'Actuarial Science', field: 'FINANCE_ACCOUNTING', qualificationLevels: ['BACHELORS', 'HONOURS'] },
  { name: 'Economics', field: 'FINANCE_ACCOUNTING', qualificationLevels: ['BACHELORS', 'HONOURS', 'MASTERS'] },
  { name: 'Business Management', field: 'BUSINESS', qualificationLevels: ['DIPLOMA', 'BACHELORS', 'HONOURS'] },
  { name: 'Human Resource Management', field: 'BUSINESS', qualificationLevels: ['DIPLOMA', 'BACHELORS'] },
  { name: 'Supply Chain Management', field: 'BUSINESS', qualificationLevels: ['DIPLOMA', 'BACHELORS'] },
  { name: 'Marketing Management', field: 'BUSINESS', qualificationLevels: ['DIPLOMA', 'BACHELORS'] },
  { name: 'Medicine', field: 'HEALTHCARE', qualificationLevels: ['BACHELORS'] },
  { name: 'Nursing', field: 'HEALTHCARE', qualificationLevels: ['DIPLOMA', 'BACHELORS'] },
  { name: 'Pharmacy', field: 'HEALTHCARE', qualificationLevels: ['BACHELORS'] },
  { name: 'Physiotherapy', field: 'HEALTHCARE', qualificationLevels: ['BACHELORS'] },
  { name: 'Law', field: 'LAW', qualificationLevels: ['BACHELORS', 'HONOURS', 'MASTERS'] },
  { name: 'Education', field: 'EDUCATION', qualificationLevels: ['DIPLOMA', 'BACHELORS', 'HONOURS'] },
  { name: 'Agriculture', field: 'AGRICULTURE', qualificationLevels: ['DIPLOMA', 'BACHELORS'] },
  { name: 'Environmental Science', field: 'SCIENCE_RESEARCH', qualificationLevels: ['BACHELORS', 'HONOURS'] },
  { name: 'Chemistry', field: 'SCIENCE_RESEARCH', qualificationLevels: ['BACHELORS', 'HONOURS', 'MASTERS'] },
  { name: 'Physics', field: 'SCIENCE_RESEARCH', qualificationLevels: ['BACHELORS', 'HONOURS', 'MASTERS'] },
  { name: 'Mathematics', field: 'SCIENCE_RESEARCH', qualificationLevels: ['BACHELORS', 'HONOURS'] },
  { name: 'Geology', field: 'MINING', qualificationLevels: ['BACHELORS', 'HONOURS'] },
  { name: 'Quantity Surveying', field: 'CONSTRUCTION', qualificationLevels: ['BACHELORS', 'HONOURS'] },
  { name: 'Construction Management', field: 'CONSTRUCTION', qualificationLevels: ['DIPLOMA', 'BACHELORS'] },
  { name: 'Journalism', field: 'MEDIA_COMMUNICATIONS', qualificationLevels: ['DIPLOMA', 'BACHELORS'] },
  { name: 'Public Administration', field: 'GOVERNMENT', qualificationLevels: ['DIPLOMA', 'BACHELORS'] },
];
