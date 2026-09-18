import { AppShell } from '@/components/layout/app-shell';
import {
  Award,
  Building,
  FileText,
  GraduationCap,
  LayoutGrid,
  ShieldCheck,
  Users,
} from '@/components/icons';
import { requireAdmin } from '@/lib/auth/guards';

/**
 * Administrator application shell.
 *
 * `requireAdmin` runs here, so every page beneath /admin is authenticated and
 * role-checked before it renders. Each page calls the guard again for its own
 * data, on the same principle the other two portals follow: the layout is not
 * treated as the authorisation boundary on its own.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  const primary = [
    {
      href: '/admin/dashboard',
      label: 'Dashboard',
      icon: <LayoutGrid className="h-[18px] w-[18px]" />,
    },
    {
      href: '/admin/users',
      label: 'Accounts',
      icon: <Users className="h-[18px] w-[18px]" />,
    },
    {
      href: '/admin/organisations',
      label: 'Organisations',
      icon: <Building className="h-[18px] w-[18px]" />,
    },
    {
      href: '/admin/programmes',
      label: 'Programmes',
      icon: <Award className="h-[18px] w-[18px]" />,
    },
    {
      href: '/admin/catalogue',
      label: 'Catalogue',
      icon: <GraduationCap className="h-[18px] w-[18px]" />,
    },
    {
      href: '/admin/audit',
      label: 'Audit log',
      icon: <FileText className="h-[18px] w-[18px]" />,
    },
  ];

  const secondary = [
    {
      href: '/help',
      label: 'Help & Support',
      icon: <ShieldCheck className="h-[18px] w-[18px]" />,
    },
  ];

  return (
    <AppShell primary={primary} secondary={secondary}>
      {children}
    </AppShell>
  );
}
