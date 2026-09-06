import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, KeyValue, Notice } from '@/components/app/page-chrome';
import { Panel, PanelHeader, Divider, SectionLabel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { FilterBar } from '@/components/app/filter-bar';
import { QuickAction } from '@/components/ui/record-form';
import { EmptyState } from '@/components/ui/empty-state';
import { requireAdmin } from '@/lib/auth/session';
import { adminUserDetail, adminUsers } from '@/lib/data/admin';
import { formatDateTime, label as humanise, relativeTime, STATUS_LABEL } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Accounts · Administration' };
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const admin = await requireAdmin();
  const q = typeof searchParams?.q === 'string' ? searchParams.q.slice(0, 60) : '';
  const status = typeof searchParams?.status === 'string' ? searchParams.status : 'all';
  const role = typeof searchParams?.role === 'string' ? searchParams.role : 'all';
  const focus = typeof searchParams?.focus === 'string' ? searchParams.focus : null;

  const all = adminUsers(q);
  const rows = all.filter((row) => (status === 'all' || row.status === status) && (role === 'all' || row.role === role));
  const detail = focus ? adminUserDetail(focus) : null;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Private office"
        title="Accounts"
        lede="Every principal and office account on this deployment, with what they hold. Access to a household’s records is granted by membership, never from this screen — an administrator can change a state, not read a ledger."
        meta={
          <>
            <span>{all.length} accounts</span>
            <span>{all.filter((row) => row.status === 'active').length} active</span>
            <span>{all.filter((row) => row.role === 'admin').length} with office access</span>
            {q ? <span>filter “{q}”</span> : null}
          </>
        }
      />

      <FilterBar
        resultCount={`${rows.length} of ${all.length}`}
        filters={[
          { key: 'q', type: 'search', label: 'Find an account', placeholder: 'Name or email…' },
          {
            key: 'status',
            type: 'select',
            label: 'State',
            options: [
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'invited', label: 'Invited' },
              { value: 'suspended', label: 'Suspended' },
            ],
          },
          {
            key: 'role',
            type: 'select',
            label: 'Role',
            options: [
              { value: 'all', label: 'All' },
              { value: 'owner', label: 'Principal' },
              { value: 'admin', label: 'Private office' },
            ],
          },
        ]}
      />

      {rows.length ? (
        <Panel>
          <PanelHeader
            label="Book"
            title="Who is inside"
            description="Suspended accounts are signed out immediately: sessions are revoked server-side and the cookie becomes worthless."
          />
          <Divider className="my-5" />
          <ul className="divide-y divide-ivory-200/[0.06]">
            {rows.map((row) => {
              const isSelf = row.id === admin.id;
              return (
                <li key={row.id} className="py-5 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-5">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2.5">
                        <span className="font-serif text-[1.15rem] leading-none text-ivory-50">{row.name}</span>
                        <Badge tone={row.role === 'admin' ? 'gold' : 'neutral'}>{humanise(row.role, STATUS_LABEL)}</Badge>
                        <Badge tone={row.status === 'active' ? 'ok' : row.status === 'suspended' ? 'risk' : 'info'}>{humanise(row.status, STATUS_LABEL)}</Badge>
                        {row.plan ? (
                          <span className="text-[10.5px] uppercase tracking-[0.16em] text-graphite-500">
                            {humanise(row.plan, STATUS_LABEL)}
                            {row.planStatus && row.planStatus !== 'active' ? ` · ${humanise(row.planStatus, STATUS_LABEL)}` : ''}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-2 text-[12px] text-graphite-400">
                        {row.email}
                        {row.country ? ` · ${row.country}` : ''}
                      </p>
                      <p className="mt-1.5 text-[11px] uppercase tracking-[0.14em] text-graphite-600">
                        {row.residences} residence{row.residences === 1 ? '' : 's'} · {row.staff} staff · {row.openTasks} open · {row.aiRequests} coordinator
                        requests
                        {row.lastLoginAt ? ` · last seen ${relativeTime(row.lastLoginAt)}` : ' · never signed in'}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/users?focus=${row.id}`}
                        className="h-[26px] rounded-[3px] px-1 text-[10.5px] uppercase tracking-[0.18em] text-graphite-400 transition-colors hover:text-gold-200"
                      >
                        {focus === row.id ? 'Hide detail' : 'Detail'}
                      </Link>
                      {isSelf ? (
                        <span className="text-[10.5px] uppercase tracking-[0.16em] text-graphite-600">Your account</span>
                      ) : (
                        <>
                          {row.status === 'suspended' ? (
                            <QuickAction
                              path={`/api/admin/users/${row.id}`}
                              method="PATCH"
                              body={{ status: 'active' }}
                              label="Reinstate"
                              variant="secondary"
                              successMessage="The account can sign in again."
                            />
                          ) : (
                            <QuickAction
                              path={`/api/admin/users/${row.id}`}
                              method="PATCH"
                              body={{ status: 'suspended' }}
                              label="Suspend"
                              variant="danger"
                              successMessage="Suspended, and every session revoked."
                              confirm={{
                                title: `Suspend ${row.name}?`,
                                body: (
                                  <p>
                                    Sign-out is immediate and the account cannot authenticate until it is reinstated here. Records are untouched — a
                                    suspension is not a deletion.
                                  </p>
                                ),
                                confirmLabel: 'Suspend the account',
                              }}
                            />
                          )}
                          <QuickAction
                            path={`/api/admin/users/${row.id}`}
                            method="PATCH"
                            body={{ role: row.role === 'admin' ? 'owner' : 'admin' }}
                            label={row.role === 'admin' ? 'Remove office access' : 'Grant office access'}
                            variant="ghost"
                            successMessage="Role updated."
                            confirm={{
                              title: row.role === 'admin' ? `Take console access from ${row.name}?` : `Give ${row.name} console access?`,
                              body: (
                                <p>
                                  {row.role === 'admin'
                                    ? 'They stop seeing any administration and are signed out of the console on their next request.'
                                    : 'Office accounts can read account states and triage access requests across the whole deployment. They still cannot read a member’s ledger, documents or conversations.'}
                                </p>
                              ),
                              confirmLabel: row.role === 'admin' ? 'Remove access' : 'Grant access',
                            }}
                          />
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : (
        <Panel>
          <EmptyState
            title={all.length ? 'Nothing matches those filters' : 'No accounts yet'}
            description={
              all.length
                ? 'Widen the state or role filter, or clear the search.'
                : 'Accounts appear here when they are registered or invited from the access queue.'
            }
          />
        </Panel>
      )}

      {detail ? (
        <Panel>
          <PanelHeader
            label="Account"
            title={`${String(detail.user.first_name ?? '')} ${String(detail.user.last_name ?? '')}`.trim() || 'Account'}
            description="The shape of an account — how much is held and what was recently done. Contents are not shown here by design."
            actions={
              <Link href="/admin/users" className="text-[10.5px] uppercase tracking-[0.18em] text-graphite-400 transition-colors hover:text-gold-200">
                Close
              </Link>
            }
          />
          <Divider className="my-5" />
          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <SectionLabel className="mb-3 text-graphite-500">Standing</SectionLabel>
              <KeyValue
                items={[
                  { label: 'Email', value: String(detail.user.email ?? '') },
                  { label: 'Role', value: humanise(String(detail.user.role ?? ''), STATUS_LABEL) },
                  { label: 'State', value: humanise(String(detail.user.status ?? ''), STATUS_LABEL) },
                  { label: 'Time zone', value: String(detail.user.timezone ?? '') },
                  { label: 'Created', value: formatDateTime(String(detail.user.created_at ?? ''), admin.timezone) },
                  { label: 'Sessions revoked', value: detail.user.sessions_revoked_at ? formatDateTime(String(detail.user.sessions_revoked_at), admin.timezone) : 'Never' },
                ]}
              />
            </div>
            <div>
              <SectionLabel className="mb-3 text-graphite-500">What they hold</SectionLabel>
              <KeyValue
                items={[
                  { label: 'Residences', value: (detail.properties as unknown[]).length },
                  { label: 'Membership', value: detail.subscription ? humanise(String((detail.subscription as Record<string, unknown>).status ?? ''), STATUS_LABEL) : 'None' },
                  { label: 'Requests to the office', value: (detail.tickets as unknown[]).length },
                  { label: 'Coordinator messages', value: (detail.aiRequests as unknown[]).length },
                ]}
              />
              {detail.properties && (detail.properties as { name: string; city: string; status: string }[]).length ? (
                <ul className="mt-4 space-y-2">
                  {(detail.properties as { id: string; name: string; city: string; status: string }[]).map((property) => (
                    <li key={property.id} className="flex items-baseline justify-between gap-3 text-[12px]">
                      <span className="truncate text-graphite-200">{property.name}</span>
                      <span className="shrink-0 text-[10.5px] uppercase tracking-[0.14em] text-graphite-600">
                        {property.city} · {humanise(property.status, STATUS_LABEL)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div>
              <SectionLabel className="mb-3 text-graphite-500">Recent trail</SectionLabel>
              {(detail.audit as unknown[]).length ? (
                <ul className="space-y-2.5">
                  {(detail.audit as { event: string; target: string | null; created_at: string }[]).slice(0, 8).map((entry, index) => (
                    <li key={`${entry.event}-${index}`} className="flex items-baseline justify-between gap-3 text-[11.5px]">
                      <span className="min-w-0 truncate text-graphite-300">{humanise(entry.event.replace(/\./g, ' '), STATUS_LABEL)}</span>
                      <span className="shrink-0 text-graphite-600">{relativeTime(entry.created_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12.5px] leading-relaxed text-graphite-400">No recorded actions.</p>
              )}
            </div>
          </div>
        </Panel>
      ) : (
        <Notice tone="info" title="Reading an account is not an administrator’s job">
          Selecting an account shows its standing and how much it holds, never the contents. A member’s residences, ledger, documents and conversations are
          readable only by that member and by the office staff they have expressly shared a record with.
        </Notice>
      )}
    </div>
  );
}
