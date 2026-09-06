import { requireAdmin } from '@/lib/auth/session';
import { adminAccessRequests, listTickets } from '@/lib/data/admin';
import { AdminSubnav } from '@/components/app/admin-actions';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Guarded twice on purpose: the page tree refuses non-admins here, and every
  // route under /api/admin re-checks the role claim in its own handler.
  await requireAdmin();

  const queue = adminAccessRequests('new').length;
  const tickets = listTickets().filter((ticket) => ticket.status === 'open' || ticket.status === 'in_review').length;

  return (
    <div className="space-y-7">
      <AdminSubnav
        items={[
          { href: '/admin', label: 'Overview' },
          { href: '/admin/users', label: 'Accounts' },
          { href: '/admin/access-requests', label: 'Access queue', count: queue },
          { href: '/admin/tickets', label: 'Correspondence', count: tickets },
        ]}
      />
      {children}
    </div>
  );
}
