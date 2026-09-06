import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, StatStrip, Notice } from '@/components/app/page-chrome';
import { Panel, PanelHeader, Divider, SectionLabel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { ConsoleLink } from '@/components/app/admin-actions';
import { requireAdmin } from '@/lib/auth/session';
import { adminAccessRequests, adminActivity, adminAiRequests, adminProperties, adminSettings, adminStats, adminSubscriptions, listTickets } from '@/lib/data/admin';
import { getBillingStatus } from '@/lib/billing';
import { activeProviderInfo } from '@/lib/ai/service';
import { formatDate, formatMoney, label as humanise, relativeTime, STATUS_LABEL } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Administration' };
export const dynamic = 'force-dynamic';

function Sparkline({ points, label }: { points: { day: string; count: number }[]; label: string }) {
  const max = Math.max(1, ...points.map((point) => point.count));
  return (
    <div>
      <div className="flex h-14 items-end gap-1" role="img" aria-label={`${label}: ${points.map((point) => `${point.day} ${point.count}`).join(', ') || 'no data'}`}>
        {points.length ? (
          points.map((point) => (
            <div key={point.day} className="group relative flex-1">
              <div
                className="w-full rounded-[1px] bg-gold-400/45 transition-colors duration-300 group-hover:bg-gold-300/80"
                style={{ height: `${Math.max(2, Math.round((point.count / max) * 52))}px` }}
              />
              <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-[2px] border border-ivory-200/10 bg-ink-950 px-1.5 py-0.5 text-[10px] text-graphite-200 group-hover:block">
                {point.day.slice(5)} · {point.count}
              </span>
            </div>
          ))
        ) : (
          <div className="h-px w-full bg-ivory-200/10" />
        )}
      </div>
      <p className="mt-2 text-[10.5px] uppercase tracking-[0.16em] text-graphite-600">
        {label} · {points.length ? `${points[0]?.day.slice(5)} → ${points[points.length - 1]?.day.slice(5)}` : 'nothing yet'}
      </p>
    </div>
  );
}

export default async function AdminOverviewPage() {
  const admin = await requireAdmin();
  const stats = adminStats();
  const subscriptions = adminSubscriptions();
  const queue = adminAccessRequests('new').slice(0, 5);
  const tickets = listTickets().filter((ticket) => ticket.status === 'open' || ticket.status === 'in_review').slice(0, 6);
  const activity = adminActivity(10);
  const requests = adminAiRequests(6);
  const residences = adminProperties(6);
  const settings = adminSettings();
  const billing = getBillingStatus();
  const provider = activeProviderInfo();

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Private office"
        title="Administration"
        lede="Everything the office needs to run the platform: who is inside it, what they hold, what the coordinator is being asked, and what is waiting for a decision. This console crosses accounts; a member’s own screens never can."
        meta={
          <>
            <span>Signed in as {admin.email}</span>
            <span>{formatMoney(stats.monthlyRecurringCents, { currency: 'EUR' })} MRR</span>
            <span>{stats.newAccessRequests} in the access queue</span>
            <span>{billing.stripeConfigured ? 'Stripe connected' : 'Billing simulated'}</span>
          </>
        }
        actions={<ConsoleLink href="/admin/access-requests">Open the queue</ConsoleLink>}
      />

      <StatStrip
        items={[
          { label: 'Principals', value: stats.principals, detail: `${stats.suspended} suspended · ${stats.invited} invited`, href: '/admin/users' },
          { label: 'Active memberships', value: stats.activeSubscriptions, detail: `${formatMoney(stats.annualValueCents, { currency: 'EUR' })} a year${stats.pastDue ? ` · ${stats.pastDue} past due` : ''}`, tone: stats.pastDue ? 'attention' : 'ok' },
          { label: 'Coordinator requests', value: stats.aiRequestsToday, detail: `today · ${stats.aiRequestsWeek} this week`, href: '/ai' },
          { label: 'Awaiting a person', value: stats.tasksAwaitingConfirmation, detail: 'actions held for confirmation', tone: stats.tasksAwaitingConfirmation ? 'attention' : 'ok', href: '/dashboard#open-items' },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Panel>
          <PanelHeader
            label="Book of members"
            title="Subscriptions"
            description="Read from our own rows. Amounts are what the membership was recorded at, not an invoice from a processor."
            actions={<ConsoleLink href="/admin/users">Accounts</ConsoleLink>}
          />
          <Divider className="my-5" />
          {subscriptions.length ? (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.18em] text-graphite-500">
                    <th className="px-2 pb-3 font-medium">Member</th>
                    <th className="px-2 pb-3 font-medium">Plan</th>
                    <th className="px-2 pb-3 font-medium">State</th>
                    <th className="px-2 pb-3 text-right font-medium">Amount</th>
                    <th className="px-2 pb-3 text-right font-medium">Period end</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ivory-200/[0.05]">
                  {subscriptions.map((row) => (
                    <tr key={row.id} className="text-[12.5px]">
                      <td className="px-2 py-3">
                        <span className="block text-ivory-100">{row.user}</span>
                        <span className="block text-[11px] text-graphite-500">{row.email}</span>
                      </td>
                      <td className="px-2 py-3 text-graphite-200">
                        {row.planName}
                        <span className="ml-2 text-[10.5px] uppercase tracking-[0.14em] text-graphite-600">{row.cycle}</span>
                      </td>
                      <td className="px-2 py-3">
                        <Badge tone={row.status === 'active' ? 'ok' : row.status === 'past_due' ? 'risk' : row.status === 'cancelled' ? 'neutral' : 'info'}>
                          {humanise(row.status, STATUS_LABEL)}
                        </Badge>
                        {row.cancel_at_period_end ? <span className="ml-2 text-[10.5px] uppercase tracking-[0.14em] text-gold-200">ends soon</span> : null}
                      </td>
                      <td className="px-2 py-3 text-right text-graphite-100 tabular-nums">{formatMoney(row.amountCents, { currency: row.currency })}</td>
                      <td className="px-2 py-3 text-right text-graphite-300 tabular-nums">{row.current_period_end ? formatDate(row.current_period_end, 'medium') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[12.5px] leading-relaxed text-graphite-400">No subscription has been recorded on this deployment.</p>
          )}
          <p className="mt-5 text-[11.5px] leading-relaxed text-graphite-500">
            {billing.stripeConfigured
              ? 'A payment provider is connected: this table is a mirror, and the provider remains the source of truth for money.'
              : 'No payment provider is connected. Changing a membership here writes to our database only — nothing is charged, and no invoice is issued by a processor.'}
          </p>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <PanelHeader label="Demand" title="Fourteen days" />
            <Divider className="my-5" />
            <div className="grid gap-7 sm:grid-cols-2">
              <Sparkline points={stats.signupTrend} label="Sign-ups" />
              <Sparkline points={stats.aiTrend} label="Coordinator requests" />
            </div>
            <Divider className="my-6" />
            <div className="space-y-2.5">
              {stats.planMix.map((entry) => {
                const share = Math.round((entry.count / Math.max(1, subscriptions.length)) * 100);
                return (
                  <div key={entry.key} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 text-[11.5px] text-graphite-300">{entry.name}</span>
                    <span className="h-[3px] flex-1 rounded-full bg-ivory-200/[0.07]">
                      <span className="block h-full rounded-full bg-gold-400/60" style={{ width: `${Math.max(2, share)}%` }} />
                    </span>
                    <span className="w-20 shrink-0 text-right text-[11.5px] text-graphite-400 tabular-nums">
                      {entry.count} · {formatMoney(entry.cents, { currency: 'EUR', compact: true })}
                    </span>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Notice
            tone={billing.stripeConfigured ? 'ok' : 'attention'}
            title={billing.stripeConfigured ? 'Billing live · Stripe keys detected' : 'Billing is simulated in this build'}
          >
            {billing.note}
          </Notice>

          <Panel>
            <PanelHeader label="Config" title="What this deployment is wired to" />
            <Divider className="my-5" />
            <ul className="space-y-3 text-[12.5px]">
              {[
                { label: 'Payment provider', value: billing.label, tone: billing.stripeConfigured ? 'ok' : 'attention' },
                { label: 'Coordinator model', value: `${provider.label}${provider.external ? ' · external API' : ' · deterministic, offline'}`, tone: provider.external ? 'ok' : 'attention' },
                { label: 'Subscriptions on Stripe', value: `${settings.integration.billing} recorded`, tone: 'default' },
                { label: 'Plan definitions', value: 'code · src/lib/utils/format.ts', tone: 'default' },
              ].map((row) => (
                <li key={row.label} className="flex items-baseline justify-between gap-4">
                  <span className="text-graphite-500">{row.label}</span>
                  <span className={row.tone === 'attention' ? 'text-right text-gold-200' : row.tone === 'ok' ? 'text-right text-state-ok' : 'text-right text-graphite-100'}>
                    {row.value}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[11.5px] leading-relaxed text-graphite-500">{settings.note}</p>
          </Panel>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel>
          <PanelHeader label="Access" title="Waiting for a yes" actions={<ConsoleLink href="/admin/access-requests">{stats.newAccessRequests} new</ConsoleLink>} />
          <Divider className="my-5" />
          {queue.length ? (
            <ul className="space-y-4">
              {queue.map((row) => (
                <li key={row.id}>
                  <p className="text-[13px] text-ivory-50">
                    {row.firstName} {row.lastName}
                  </p>
                  <p className="mt-1 text-[11.5px] text-graphite-500">
                    {row.email} · {row.residences} residence{row.residences === 1 ? '' : 's'} · {humanise(row.primaryRequirement, STATUS_LABEL)}
                  </p>
                  {row.message ? <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-graphite-300">{row.message}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] leading-relaxed text-graphite-400">Nobody is waiting. The intake form is open at /access/request.</p>
          )}
        </Panel>

        <Panel>
          <PanelHeader label="Correspondence" title="Open with members" actions={<ConsoleLink href="/admin/tickets">{tickets.length}</ConsoleLink>} />
          <Divider className="my-5" />
          {tickets.length ? (
            <ul className="space-y-4">
              {tickets.map((ticket) => (
                <li key={ticket.id} className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-ivory-50">{ticket.subject}</span>
                    <span className="mt-1 block text-[11.5px] text-graphite-500">
                      {ticket.requester} · {relativeTime(ticket.createdAt)}
                    </span>
                  </span>
                  <Badge tone={ticket.priority === 'urgent' ? 'risk' : ticket.priority === 'high' ? 'gold' : 'neutral'}>{ticket.priority}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] leading-relaxed text-graphite-400">Every question asked has been answered and closed.</p>
          )}
        </Panel>

        <Panel>
          <PanelHeader label="Residences" title="Across all accounts" description="Condition first, then name. Nothing here is editable — the owning member does that." />
          <Divider className="my-5" />
          <ul className="space-y-3.5">
            {residences.map((row) => (
              <li key={row.id} className="flex items-baseline justify-between gap-4 text-[12.5px]">
                <span className="min-w-0">
                  <span className="block truncate text-graphite-100">{row.name}</span>
                  <span className="block text-[11px] text-graphite-500">
                    {row.city}, {row.country} · {row.owner} · {row.staff} staff · {row.tasks} open
                  </span>
                </span>
                <Badge tone={row.status === 'attention' ? 'risk' : row.status === 'maintenance' ? 'gold' : 'ok'}>{humanise(row.status, STATUS_LABEL)}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-graphite-600">{stats.residences} residences and {stats.staff} people are on record in total.</p>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader label="Coordinator" title="What members are asking" description="The raw request text, so the office can see whether the platform is being asked for things it should answer natively." />
          <Divider className="my-5" />
          {requests.length ? (
            <ul className="space-y-4">
              {requests.map((row) => (
                <li key={row.id} className="border-l border-ivory-200/10 pl-3.5">
                  <p className="text-[12.5px] leading-relaxed text-graphite-100">{row.content}</p>
                  <p className="mt-1.5 text-[11px] text-graphite-500">
                    {row.requester} · {relativeTime(row.created_at)} · {row.actions} action{row.actions === 1 ? '' : 's'}
                    {row.requires ? `, ${row.requires} awaiting confirmation` : ''} · {row.plan ? humanise(row.plan, STATUS_LABEL) : 'no plan'}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] leading-relaxed text-graphite-400">No request has reached the coordinator yet.</p>
          )}
        </Panel>

        <Panel>
          <PanelHeader label="Trail" title="Recent platform actions" description="Who did what, when. Hashed source addresses only; the ledger itself is append-only." />
          <Divider className="my-5" />
          <ul className="space-y-3">
            {activity.map((row) => (
              <li key={row.id} className="flex items-baseline justify-between gap-4 border-b border-ivory-200/[0.05] pb-2.5 text-[12px] last:border-b-0">
                <span className="min-w-0 truncate">
                  <span className="text-graphite-200">{humanise(row.event.replace(/\./g, ' '), STATUS_LABEL)}</span>
                  {row.target ? <span className="ml-2 text-graphite-600">{row.target}</span> : null}
                </span>
                <span className="shrink-0 text-[11px] text-graphite-600">
                  {row.requester ?? 'system'} · {relativeTime(row.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[5px] border border-ivory-200/[0.07] bg-ink-950/50 px-5 py-4">
        <p className="max-w-2xl text-[12px] leading-relaxed text-graphite-400">
          <SectionLabel className="mb-1.5 inline-block text-graphite-500">Self-service limit</SectionLabel>
          You cannot change your own role or status from this console — an administrator locking themselves out of their own deployment is the oldest
          accident in the trade. Use a second office account for that.
        </p>
        <Link href="/admin/users" className="text-[11px] uppercase tracking-[0.2em] text-gold-200 transition-colors hover:text-gold-100">
          Manage accounts →
        </Link>
      </div>
    </div>
  );
}
