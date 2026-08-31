import type { Metadata } from 'next';
import { requireStudent } from '@/lib/auth/guards';
import { buildStudentSummary } from '@/services/student-summary';
import { ReviewPanel } from './review-panel';

export const metadata: Metadata = { title: 'Review your profile' };

export default async function ReviewStepPage() {
  const { studentProfileId } = await requireStudent();
  const sections = await buildStudentSummary(studentProfileId);
  return <ReviewPanel sections={sections} />;
}
