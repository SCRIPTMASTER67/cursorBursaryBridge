import { PDFDocument, PDFForm, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import type { CanonicalKey } from '../../lib/pdf/profile';
import type { MappingStatus } from '../../lib/pdf/map';

/**
 * Test fixtures for the auto-fill engine.
 *
 * These are synthetic bursary forms, written here so the accuracy harness has
 * a known ground truth to measure against. They are deliberately awkward: the
 * six target forms ask for the same information in six different vocabularies,
 * across different page counts and field types, and each one carries at least
 * one case the engine is expected to refuse rather than guess.
 *
 * The funders are invented. No real bursary form is reproduced.
 */

// --- ground truth ------------------------------------------------------

/** What the source form says, as a person reading it would report it. */
export const GROUND_TRUTH: Partial<Record<CanonicalKey, string>> = {
  firstName: 'Nomvula Precious',
  lastName: 'Mthembu',
  fullName: 'Nomvula Precious Mthembu',
  idNumber: '0304125678083',
  dateOfBirth: '12/04/2003',
  gender: 'Female',
  citizenship: 'South African',
  email: 'nomvula.mthembu@example.ac.za',
  mobile: '072 123 4567',
  addressLine: '12 Ndlovu Street, KwaMashu',
  city: 'Durban',
  province: 'KwaZulu-Natal',
  postalCode: '4360',
  institution: 'University of Zululand',
  programme: 'Bachelor of Science in Computer Science',
  yearOfStudy: '2',
  studentNumber: '202145678',
  academicAverage: '72',
  matricYear: '2021',
  householdIncome: 'R 186000',
  disability: 'No',
  motivation: MOTIVATION(),
};

function MOTIVATION() {
  return (
    'I am the first person in my family to attend university, and I am studying computer science ' +
    'because I want to build software that works for people in rural KwaZulu-Natal. My mother ' +
    'supports three children on a single income and cannot cover my fees beyond this year. This ' +
    'bursary would let me finish my degree and take up the graduate programme I have been offered.'
  );
}

/** Information the source form carries about somebody other than the applicant. */
export const THIRD_PARTY = {
  guardianName: 'Thandiwe Mthembu',
  guardianId: '7508120123084',
  refereePhone: '031 555 0198',
};

// --- expectations ------------------------------------------------------

/**
 * What each target field should end up as.
 *
 * `status` is the outcome the engine must reach. `expect` is the value that
 * must be written when the status is FILLED or NEEDS_REVIEW; a populated field
 * carrying anything else is a failure, not a warning — a wrong value on a
 * submitted bursary form is the worst outcome this feature can have.
 */
export type Expectation = {
  status: MappingStatus;
  expect?: string;
  /** Why this outcome is the correct one, for the harness report. */
  because: string;
};

export type TargetFixture = {
  id: string;
  documentName: string;
  bytes: Uint8Array;
  expectations: Record<string, Expectation>;
};

// --- drawing helpers ---------------------------------------------------

const A4: [number, number] = [595.28, 841.89];

type Sheet = { doc: PDFDocument; form: PDFForm; page: PDFPage; y: number; pageNumber: number };

async function newSheet(title: string): Promise<Sheet> {
  const doc = await PDFDocument.create();
  const page = doc.addPage(A4);
  const sheet: Sheet = { doc, form: doc.getForm(), page, y: 0, pageNumber: 1 };
  sheet.y = await header(sheet, title);
  return sheet;
}

async function header(sheet: Sheet, title: string): Promise<number> {
  const bold = await sheet.doc.embedFont(StandardFonts.HelveticaBold);
  sheet.page.drawRectangle({
    x: 0,
    y: 781,
    width: A4[0],
    height: 61,
    color: rgb(0.09, 0.11, 0.24),
  });
  sheet.page.drawText(title, { x: 40, y: 806, size: 15, font: bold, color: rgb(1, 1, 1) });
  return 745;
}

async function nextPage(sheet: Sheet, title: string) {
  sheet.page = sheet.doc.addPage(A4);
  sheet.pageNumber += 1;
  sheet.y = await header(sheet, title);
}

async function section(sheet: Sheet, heading: string) {
  const bold = await sheet.doc.embedFont(StandardFonts.HelveticaBold);
  sheet.y -= 10;
  sheet.page.drawText(heading.toUpperCase(), {
    x: 40,
    y: sheet.y,
    size: 9,
    font: bold,
    color: rgb(0.36, 0.18, 0.86),
  });
  sheet.y -= 18;
}

/** A labelled text field. The PDF field name is what the engine reads as a label. */
async function textField(
  sheet: Sheet,
  name: string,
  value?: string,
  opts?: { width?: number; height?: number; label?: string },
) {
  const font = await sheet.doc.embedFont(StandardFonts.Helvetica);
  const label = opts?.label ?? name;
  sheet.page.drawText(`${label}`, {
    x: 40,
    y: sheet.y,
    size: 9,
    font,
    color: rgb(0.29, 0.3, 0.42),
  });
  const field = sheet.form.createTextField(name);
  if (value !== undefined) field.setText(value);
  const height = opts?.height ?? 18;
  field.addToPage(sheet.page, {
    x: 40,
    y: sheet.y - height - 4,
    width: opts?.width ?? 260,
    height,
    borderWidth: 1,
    borderColor: rgb(0.85, 0.85, 0.9),
  });
  sheet.y -= height + 22;
}

async function checkBox(sheet: Sheet, name: string, checked: boolean) {
  const font = await sheet.doc.embedFont(StandardFonts.Helvetica);
  sheet.page.drawText(name, { x: 62, y: sheet.y, size: 9, font, color: rgb(0.29, 0.3, 0.42) });
  const box = sheet.form.createCheckBox(name);
  box.addToPage(sheet.page, { x: 40, y: sheet.y - 2, width: 12, height: 12 });
  if (checked) box.check();
  sheet.y -= 26;
}

async function dropdown(sheet: Sheet, name: string, options: string[]) {
  const font = await sheet.doc.embedFont(StandardFonts.Helvetica);
  sheet.page.drawText(name, { x: 40, y: sheet.y, size: 9, font, color: rgb(0.29, 0.3, 0.42) });
  const field = sheet.form.createDropdown(name);
  field.setOptions(options);
  field.addToPage(sheet.page, { x: 40, y: sheet.y - 22, width: 220, height: 18 });
  sheet.y -= 40;
}

async function radioGroup(sheet: Sheet, name: string, options: string[]) {
  const font = await sheet.doc.embedFont(StandardFonts.Helvetica);
  sheet.page.drawText(name, { x: 40, y: sheet.y, size: 9, font, color: rgb(0.29, 0.3, 0.42) });
  const group = sheet.form.createRadioGroup(name);
  options.forEach((option, index) => {
    group.addOptionToPage(option, sheet.page, {
      x: 40 + index * 110,
      y: sheet.y - 22,
      width: 12,
      height: 12,
    });
    sheet.page.drawText(option, {
      x: 56 + index * 110,
      y: sheet.y - 20,
      size: 9,
      font,
      color: rgb(0.29, 0.3, 0.42),
    });
  });
  sheet.y -= 42;
}

// --- the source form ---------------------------------------------------

/**
 * The completed form the student uploads. Every value here is ground truth;
 * the guardian and referee details are the trap the engine must not fall into.
 */
export async function buildSourceForm(): Promise<Uint8Array> {
  const sheet = await newSheet('Ikusasa Education Trust — Bursary Application 2026');

  await section(sheet, 'Applicant details');
  await textField(sheet, 'First Name', GROUND_TRUTH.firstName);
  await textField(sheet, 'Surname', GROUND_TRUTH.lastName);
  await textField(sheet, 'ID Number', GROUND_TRUTH.idNumber);
  await textField(sheet, 'Date of Birth', GROUND_TRUTH.dateOfBirth);
  await textField(sheet, 'Gender', GROUND_TRUTH.gender);
  await textField(sheet, 'Nationality', GROUND_TRUTH.citizenship);
  await textField(sheet, 'Do you have a disability', GROUND_TRUTH.disability);

  await nextPage(sheet, 'Ikusasa Education Trust — Bursary Application 2026');
  await section(sheet, 'Contact details');
  await textField(sheet, 'Email Address', GROUND_TRUTH.email, { width: 320 });
  await textField(sheet, 'Cellphone Number', GROUND_TRUTH.mobile);
  await textField(sheet, 'Residential Address', GROUND_TRUTH.addressLine, { width: 320 });
  await textField(sheet, 'City', GROUND_TRUTH.city);
  await textField(sheet, 'Province', GROUND_TRUTH.province);
  await textField(sheet, 'Postal Code', GROUND_TRUTH.postalCode, { width: 120 });

  await nextPage(sheet, 'Ikusasa Education Trust — Bursary Application 2026');
  await section(sheet, 'Study details');
  await textField(sheet, 'Name of Institution', GROUND_TRUTH.institution, { width: 320 });
  await textField(sheet, 'Course of Study', GROUND_TRUTH.programme, { width: 320 });
  await textField(sheet, 'Year of Study', GROUND_TRUTH.yearOfStudy, { width: 80 });
  await textField(sheet, 'Student Number', GROUND_TRUTH.studentNumber, { width: 160 });
  await textField(sheet, 'Current Average', `${GROUND_TRUTH.academicAverage}%`, { width: 80 });
  await textField(sheet, 'Matric Year', GROUND_TRUTH.matricYear, { width: 80 });
  await textField(sheet, 'Annual Household Income', GROUND_TRUTH.householdIncome, { width: 160 });

  await nextPage(sheet, 'Ikusasa Education Trust — Bursary Application 2026');
  await section(sheet, 'Motivation');
  await textField(sheet, 'Motivation', GROUND_TRUTH.motivation, { width: 500, height: 120 });

  await section(sheet, 'Guardian and referee');
  await textField(sheet, 'Parent or Guardian Full Name', THIRD_PARTY.guardianName, { width: 300 });
  await textField(sheet, 'Parent or Guardian ID Number', THIRD_PARTY.guardianId, { width: 220 });
  await textField(sheet, 'Referee Contact Number', THIRD_PARTY.refereePhone, { width: 220 });
  await textField(sheet, 'Signature of Applicant', '', { width: 240, height: 34 });

  return sheet.doc.save();
}

// --- target forms ------------------------------------------------------

const G = GROUND_TRUTH;

/** A — plain synonyms on a single page. The baseline: everything should land. */
async function targetSizani(): Promise<TargetFixture> {
  const sheet = await newSheet('Sizani Education Fund — Application Form');
  await section(sheet, 'Personal particulars');
  await textField(sheet, 'Surname');
  await textField(sheet, 'First Names');
  await textField(sheet, 'Identity Number');
  await textField(sheet, 'Date of Birth');
  await section(sheet, 'How we reach you');
  await textField(sheet, 'E-mail Address', undefined, { width: 320 });
  await textField(sheet, 'Contact Number');
  await section(sheet, 'Studies');
  await textField(sheet, 'Tertiary Institution', undefined, { width: 320 });
  await textField(sheet, 'Qualification Name', undefined, { width: 320 });
  await textField(sheet, 'Year of Registration', undefined, { width: 80 });

  return {
    id: 'sizani',
    documentName: 'sizani-education-fund.pdf',
    bytes: await sheet.doc.save(),
    expectations: {
      Surname: { status: 'FILLED', expect: G.lastName, because: 'Same word as the source uses.' },
      'First Names': {
        status: 'FILLED',
        expect: G.firstName,
        because: 'Plural phrasing of "First Name".',
      },
      'Identity Number': {
        status: 'FILLED',
        expect: G.idNumber,
        because: 'Standard synonym for ID number.',
      },
      'Date of Birth': { status: 'FILLED', expect: G.dateOfBirth, because: 'Identical label.' },
      'E mail Address': {
        status: 'FILLED',
        expect: G.email,
        because: 'Hyphenated spelling, which the field name flattens to "E mail Address".',
      },
      'Contact Number': {
        status: 'FILLED',
        expect: G.mobile,
        because: 'The applicant has one number on the source.',
      },
      'Tertiary Institution': {
        status: 'FILLED',
        expect: G.institution,
        because: 'Synonym for "Name of Institution".',
      },
      'Qualification Name': {
        status: 'FILLED',
        expect: G.programme,
        because: 'Synonym for "Course of Study".',
      },
      'Year of Registration': {
        status: 'FILLED',
        expect: G.yearOfStudy,
        because: 'Synonym for "Year of Study".',
      },
    },
  };
}

/** B — two pages, and every field type other than plain text. */
async function targetThuto(): Promise<TargetFixture> {
  const title = 'Thuto Mining Bursary — 2026 Intake';
  const sheet = await newSheet(title);
  await section(sheet, 'Section 1: About you');
  await textField(sheet, 'Applicant Full Name', undefined, { width: 320 });
  await radioGroup(sheet, 'Gender', ['Male', 'Female', 'Other']);
  await dropdown(sheet, 'Province', [
    'Eastern Cape',
    'Free State',
    'Gauteng',
    'KwaZulu-Natal',
    'Western Cape',
  ]);
  await checkBox(sheet, 'Disability', false);

  await nextPage(sheet, title);
  await section(sheet, 'Section 2: Registration');
  await textField(sheet, 'Student Number', undefined, { width: 160 });
  await textField(sheet, 'Overall Average', undefined, { width: 80 });
  await textField(sheet, 'Signature of Applicant', undefined, { width: 240, height: 34 });

  return {
    id: 'thuto',
    documentName: 'thuto-mining-bursary.pdf',
    bytes: await sheet.doc.save(),
    expectations: {
      'Applicant Full Name': {
        status: 'FILLED',
        expect: G.fullName,
        because: 'Assembled from the source first name and surname.',
      },
      Gender: {
        status: 'FILLED',
        expect: 'Female',
        because: 'The source value matches one of this form’s options exactly.',
      },
      Province: {
        status: 'FILLED',
        expect: G.province,
        because: 'KwaZulu-Natal is offered by this dropdown.',
      },
      Disability: {
        status: 'FILLED',
        expect: 'false',
        because: 'The source answers "No", so the box is left unticked.',
      },
      'Student Number': { status: 'FILLED', expect: G.studentNumber, because: 'Identical label.' },
      'Overall Average': {
        status: 'FILLED',
        expect: G.academicAverage,
        because: 'Synonym for "Current Average"; the % sign is stripped on the way in.',
      },
      'Signature of Applicant': { status: 'SIGNATURE', because: 'Signatures are never automated.' },
    },
  };
}

/** C — a flat form with no fields at all, only printed labels and ruled lines. */
async function targetLerato(): Promise<TargetFixture> {
  const doc = await PDFDocument.create();
  const page = doc.addPage(A4);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  page.drawText('Lerato Legacy Scholarship', { x: 40, y: 790, size: 16, font: bold });
  page.drawText('Please complete in black ink and return to the Trust office.', {
    x: 40,
    y: 770,
    size: 9,
    font,
  });

  const labels = [
    'Full Name',
    'ID Number',
    'Cell Number',
    'Email',
    'Institution',
    'Course',
    'Signature',
  ];
  let y = 720;
  for (const label of labels) {
    page.drawText(`${label}:`, { x: 40, y, size: 10, font });
    page.drawLine({
      start: { x: 170, y: y - 3 },
      end: { x: 520, y: y - 3 },
      thickness: 0.7,
      color: rgb(0.7, 0.7, 0.76),
    });
    y -= 40;
  }

  return {
    id: 'lerato',
    documentName: 'lerato-legacy-scholarship.pdf',
    bytes: await doc.save(),
    expectations: {
      'Full Name': {
        status: 'NEEDS_REVIEW',
        expect: G.fullName,
        because:
          'Read from the printed layout rather than a real field, so it is flagged for confirmation.',
      },
      'ID Number': {
        status: 'NEEDS_REVIEW',
        expect: G.idNumber,
        because: 'Same: positional reading is never treated as certain.',
      },
      'Cell Number': { status: 'NEEDS_REVIEW', expect: G.mobile, because: 'Same.' },
      Email: { status: 'NEEDS_REVIEW', expect: G.email, because: 'Same.' },
      Institution: { status: 'NEEDS_REVIEW', expect: G.institution, because: 'Same.' },
      Course: { status: 'NEEDS_REVIEW', expect: G.programme, because: 'Same.' },
      Signature: { status: 'SIGNATURE', because: 'Signatures are never automated, on any layout.' },
    },
  };
}

/** D — a box too small for the answer, plus things no form can supply. */
async function targetNkosi(): Promise<TargetFixture> {
  const sheet = await newSheet('Nkosi Engineering Trust — Bursary Application');
  await section(sheet, 'Applicant');
  await textField(sheet, 'Full Name', undefined, { width: 300 });
  await textField(sheet, 'Motivation', undefined, { width: 120, height: 14 });
  await section(sheet, 'Supporting documents');
  await textField(sheet, 'Attach certified copy of ID', undefined, { width: 200 });
  await textField(sheet, 'Proof of household income', undefined, { width: 200 });
  await textField(sheet, 'Latest academic transcript', undefined, { width: 200 });
  await textField(sheet, 'Signature', undefined, { width: 240, height: 34 });

  return {
    id: 'nkosi',
    documentName: 'nkosi-engineering-trust.pdf',
    bytes: await sheet.doc.save(),
    expectations: {
      'Full Name': { status: 'FILLED', expect: G.fullName, because: 'Direct match.' },
      Motivation: {
        status: 'NEEDS_REVIEW',
        expect: G.motivation,
        because:
          'The whole answer is kept \u2014 never cut short \u2014 but a 120x14 box cannot display it, so the student is told to check it.',
      },
      'Attach certified copy of ID': {
        status: 'MANUAL',
        because: 'A document the student must attach; no form field can supply it.',
      },
      'Proof of household income': { status: 'MANUAL', because: 'Same.' },
      'Latest academic transcript': { status: 'MANUAL', because: 'Same.' },
      Signature: { status: 'SIGNATURE', because: 'Signatures are never automated.' },
    },
  };
}

/** E — three pages of labels that are either too vague or about somebody else. */
async function targetAmanzi(): Promise<TargetFixture> {
  const title = 'Amanzi Water Board — Study Assistance';
  const sheet = await newSheet(title);
  await section(sheet, 'Part A');
  await textField(sheet, 'Number', undefined, { width: 200 });
  await textField(sheet, 'Details', undefined, { width: 300 });
  await textField(sheet, 'Reference', undefined, { width: 200 });

  await nextPage(sheet, title);
  await section(sheet, 'Part B: Household');
  await textField(sheet, 'Parent or Guardian Full Name', undefined, { width: 300 });
  await textField(sheet, 'Parent or Guardian ID Number', undefined, { width: 220 });
  await textField(sheet, 'Next of Kin Contact Number', undefined, { width: 220 });
  await textField(sheet, 'Referee Email Address', undefined, { width: 300 });
  await textField(sheet, 'Bank Account Holder Name', undefined, { width: 300 });

  await nextPage(sheet, title);
  await section(sheet, 'Part C: Applicant');
  await textField(sheet, 'Gross Household Income', undefined, { width: 200 });
  await textField(sheet, 'Postal Code', undefined, { width: 100 });
  await textField(sheet, 'City or Town', undefined, { width: 200 });

  return {
    id: 'amanzi',
    documentName: 'amanzi-water-board.pdf',
    bytes: await sheet.doc.save(),
    expectations: {
      Number: {
        status: 'AMBIGUOUS',
        because:
          '"Number" could be an ID, a phone or a student number. Guessing would be the failure mode this feature exists to avoid.',
      },
      Details: { status: 'AMBIGUOUS', because: 'Means nothing on its own.' },
      Reference: { status: 'AMBIGUOUS', because: 'A referee marker, and vague besides.' },
      'Parent or Guardian Full Name': {
        status: 'AMBIGUOUS',
        because: 'The applicant’s name must never be written into a guardian field.',
      },
      'Parent or Guardian ID Number': {
        status: 'AMBIGUOUS',
        because: 'The applicant’s ID must never be written into a guardian field.',
      },
      'Next of Kin Contact Number': { status: 'AMBIGUOUS', because: 'Somebody else’s number.' },
      'Referee Email Address': { status: 'AMBIGUOUS', because: 'Somebody else’s email.' },
      'Bank Account Holder Name': {
        status: 'AMBIGUOUS',
        because: 'A banking field, not a personal-details field.',
      },
      'Gross Household Income': {
        status: 'FILLED',
        expect: G.householdIncome,
        because:
          'Synonym for "Annual Household Income". A money amount is carried across exactly as the source wrote it, rand sign included, rather than reformatted.',
      },
      'Postal Code': { status: 'FILLED', expect: G.postalCode, because: 'Identical label.' },
      'City or Town': { status: 'FILLED', expect: G.city, because: 'Synonym for "City".' },
    },
  };
}

/** F — questions the source form never answered, and options that do not fit. */
async function targetVuka(): Promise<TargetFixture> {
  const sheet = await newSheet('Vuka Youth Fund — Bursary Application');
  await section(sheet, 'Applicant');
  await textField(sheet, 'Surname', undefined, { width: 240 });
  await textField(sheet, 'Matric Exam Number', undefined, { width: 200 });
  await textField(sheet, 'Career Interests', undefined, { width: 320 });
  await textField(sheet, 'Funding Required', undefined, { width: 200 });
  await section(sheet, 'Classification');
  await dropdown(sheet, 'Province', ['Gauteng', 'Western Cape', 'Limpopo']);
  await radioGroup(sheet, 'Qualification Level', ['Certificate', 'Diploma', 'Honours']);

  return {
    id: 'vuka',
    documentName: 'vuka-youth-fund.pdf',
    bytes: await sheet.doc.save(),
    expectations: {
      Surname: { status: 'FILLED', expect: G.lastName, because: 'Direct match.' },
      'Matric Exam Number': {
        status: 'AMBIGUOUS',
        because:
          'Not the matric year and not the student number; nothing on the source answers it.',
      },
      'Career Interests': {
        status: 'MISSING',
        because: 'The source form never asked this, so there is nothing to carry across.',
      },
      'Funding Required': { status: 'MISSING', because: 'Same.' },
      Province: {
        status: 'NEEDS_REVIEW',
        because: 'KwaZulu-Natal is not one of this form’s three options, so nothing is selected.',
      },
      'Qualification Level': {
        status: 'MISSING',
        because:
          'The source states a course, not a qualification level; inferring "BSc means Degree" would be a guess.',
      },
    },
  };
}

export async function buildTargets(): Promise<TargetFixture[]> {
  return [
    await targetSizani(),
    await targetThuto(),
    await targetLerato(),
    await targetNkosi(),
    await targetAmanzi(),
    await targetVuka(),
  ];
}
