import { requireUser } from '@/lib/auth/session';
import { AppShell } from '@/components/app/AppShell';
import { getMembership, listTasks, unreadCount } from '@/lib/data/read';
import { getPlan, initialsOf } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const membership = getMembership(user.id);
  const plan = getPlan(membership.subscription?.plan);
  const awaiting = listTasks(user.id, { status: 'awaiting_confirmation', limit: 200 }).length;

  return (
    <AppShell
      user={{
        fullName: user.fullName,
        email: user.email,
        initials: user.avatarInitials ?? initialsOf(user.fullName),
        role: user.role,
        timezone: user.timezone,
        briefingTime: user.briefingTime,
      }}
      unread={unreadCount(user.id)}
      planName={plan.name}
      pending={{ label: 'Awaiting your word', count: awaiting }}
    >
      {children}
    </AppShell>
  );
}
