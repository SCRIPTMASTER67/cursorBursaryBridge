import { AppShell } from '@/components/layout/app-shell';
import {
  Bell,
  Bookmark,
  ClipboardList,
  FileText,
  HelpCircle,
  LayoutGrid,
  Settings,
  Sparkles,
  Target,
  User,
} from '@/components/icons';
import { requireOnboardedStudent } from '@/lib/auth/guards';
import { unreadNotificationCount } from '@/services/notifications';

/**
 * Student application shell.
 *
 * The guard runs here so every page beneath /student is authenticated,
 * role-checked and past onboarding before it renders.
 */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireOnboardedStudent();
  const unread = await unreadNotificationCount(user.id);

  const primary = [
    {
      href: '/student/dashboard',
      label: 'Dashboard',
      icon: <LayoutGrid className="h-[18px] w-[18px]" />,
    },
    // Two separate experiences, deliberately not merged. My Matches answers
    // "what fits me"; All Bursaries answers "what exists".
    {
      href: '/student/opportunities',
      label: 'My Matches',
      icon: <Target className="h-[18px] w-[18px]" />,
    },
    {
      href: '/student/bursaries',
      label: 'All Bursaries',
      icon: <Bookmark className="h-[18px] w-[18px]" />,
    },
    {
      href: '/student/applications',
      label: 'My Applications',
      icon: <ClipboardList className="h-[18px] w-[18px]" />,
    },
    {
      href: '/student/notifications',
      label: 'Notifications',
      icon: <Bell className="h-[18px] w-[18px]" />,
      badge: unread,
    },
    { href: '/student/profile', label: 'My Profile', icon: <User className="h-[18px] w-[18px]" /> },
    {
      href: '/student/documents',
      label: 'Documents',
      icon: <FileText className="h-[18px] w-[18px]" />,
    },
    {
      href: '/student/auto-fill',
      label: 'Auto-Fill Forms',
      icon: <Sparkles className="h-[18px] w-[18px]" />,
    },
  ];

  const secondary = [
    {
      href: '/student/settings',
      label: 'Settings',
      icon: <Settings className="h-[18px] w-[18px]" />,
    },
    { href: '/help', label: 'Help & Support', icon: <HelpCircle className="h-[18px] w-[18px]" /> },
  ];

  return (
    <AppShell primary={primary} secondary={secondary}>
      {children}
    </AppShell>
  );
}
