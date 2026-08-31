import { AppShell } from '@/components/layout/app-shell';
import {
  Award,
  Bell,
  BarChart,
  Building,
  ClipboardList,
  HelpCircle,
  LayoutGrid,
  Settings,
  Star,
  Users,
} from '@/components/icons';
import { requireCorporate } from '@/lib/auth/guards';
import { unreadNotificationCount } from '@/services/notifications';

/**
 * Corporate application shell.
 *
 * `requireCorporate` runs here, so every page beneath /corporate is
 * authenticated, role-checked, past onboarding, and carries the organisationId
 * that scopes its queries.
 */
export default async function CorporateLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireCorporate();
  const unread = await unreadNotificationCount(user.id);

  const primary = [
    { href: '/corporate/dashboard', label: 'Dashboard', icon: <LayoutGrid className="h-[18px] w-[18px]" /> },
    { href: '/corporate/programmes', label: 'Programmes', icon: <Award className="h-[18px] w-[18px]" /> },
    { href: '/corporate/applications', label: 'Applications', icon: <ClipboardList className="h-[18px] w-[18px]" /> },
    { href: '/corporate/shortlists', label: 'Shortlists', icon: <Star className="h-[18px] w-[18px]" /> },
    { href: '/corporate/beneficiaries', label: 'Beneficiaries', icon: <Users className="h-[18px] w-[18px]" /> },
    { href: '/corporate/reports', label: 'Reports', icon: <BarChart className="h-[18px] w-[18px]" /> },
    { href: '/corporate/notifications', label: 'Notifications', icon: <Bell className="h-[18px] w-[18px]" />, badge: unread },
    { href: '/corporate/organisation', label: 'Organisation', icon: <Building className="h-[18px] w-[18px]" /> },
  ];

  const secondary = [
    { href: '/corporate/settings', label: 'Settings', icon: <Settings className="h-[18px] w-[18px]" /> },
    { href: '/help', label: 'Help & Support', icon: <HelpCircle className="h-[18px] w-[18px]" /> },
  ];

  return (
    <AppShell primary={primary} secondary={secondary}>
      {children}
    </AppShell>
  );
}
