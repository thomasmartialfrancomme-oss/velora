import type { Metadata } from 'next';
import { PageHeader, StatStrip } from '@/components/app/page-chrome';
import { Panel, PanelHeader, Divider, SectionLabel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { FilterBar } from '@/components/app/filter-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { QuickAction } from '@/components/ui/record-form';
import { TicketReply } from '@/components/app/admin-actions';
import { requireAdmin } from '@/lib/auth/session';
import { listTickets } from '@/lib/data/admin';
import { formatDateTime, label as humanise, relativeTime, STATUS_LABEL } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Correspondence · Administration' };
export const dynamic = 'force-dynamic';

const PRIORITY_TONE: Record<string, 'neutral' | 'info' | 'gold' | 'risk'> = { low: 'neutral', normal: 'info', high: 'gold', urgent: 'risk' };
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export default async function AdminTicketsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const admin = await requireAdmin();
  const status = typeof searchParams?.status === 'string' ? searchParams.status : 'open';

  const all = listTickets();
  const rows = (status === 'all' ? all : status === 'open' ? all.filter((ticket) => ticket.status === 'open' || ticket.status === 'in_review') : all.filter((ticket) => ticket.status === status)).sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const countOf = (value: string) => all.filter((ticket) => ticket.status === value).length;
  const waiting = all.filter((ticket) => ticket.status === 'open');

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Private office"
        title="Correspondence"
        lede="What members have asked for and not yet been answered. An answer written here is delivered to the member as a message and stays attached to the request, so the thread is the record."
        meta={
          <>
            <span>{all.length} written to the office</span>
            <span>{waiting.length} nobody has touched</span>
            <span>{countOf('answered')} answered</span>
            <span>read by {admin.fullName}</span>
          </>
        }
      />

      <StatStrip
        items={[
          { label: 'Open', value: countOf('open'), detail: 'no one assigned', tone: countOf('open') ? 'attention' : 'ok' },
          { label: 'Being prepared', value: countOf('in_review'), detail: 'someone is on it' },
          { label: 'Answered', value: countOf('answered'), detail: 'waiting for the member to close' },
          { label: 'Urgent', value: all.filter((ticket) => ticket.priority === 'urgent' && ticket.status !== 'closed').length, detail: 'interrupt someone', tone: all.some((ticket) => ticket.priority === 'urgent' && ticket.status !== 'closed') ? 'attention' : 'ok' },
        ]}
      />

      <FilterBar
        resultCount={`${rows.length} shown`}
        filters={[
          {
            key: 'status',
            type: 'select',
            label: 'State',
            options: [
              { value: 'open', label: 'Needs an answer' },
              { value: 'in_review', label: 'Being prepared' },
              { value: 'answered', label: 'Answered' },
              { value: 'closed', label: 'Closed' },
              { value: 'all', label: 'Everything' },
            ],
          },
        ]}
      />

      {rows.length ? (
        <div className="space-y-5">
          {rows.map((ticket) => (
            <Panel key={ticket.id}>
              <PanelHeader
                label={`${ticket.requester} · asked ${relativeTime(ticket.createdAt)}`}
                title={ticket.subject}
                actions={
                  <div className="flex items-center gap-2">
                    <Badge tone={PRIORITY_TONE[ticket.priority] ?? 'neutral'} dot={ticket.priority === 'urgent'}>
                      {ticket.priority}
                    </Badge>
                    <Badge tone={ticket.status === 'open' ? 'gold' : ticket.status === 'in_review' ? 'info' : ticket.status === 'answered' ? 'ok' : 'neutral'}>
                      {humanise(ticket.status, STATUS_LABEL)}
                    </Badge>
                  </div>
                }
              />
              <Divider className="my-5" />

              {ticket.body ? <p className="max-w-3xl whitespace-pre-line text-[13.5px] leading-relaxed text-graphite-100">{ticket.body}</p> : null}

              <p className="mt-4 text-[11px] uppercase tracking-[0.16em] text-graphite-600">
                {ticket.assignee ? `Assigned to ${ticket.assignee} · ` : 'Unassigned · '}
                last touched {formatDateTime(ticket.updatedAt, admin.timezone)}
              </p>

              {ticket.reply ? (
                <div className="mt-5 rounded-[4px] border-l border-gold-400/45 bg-gold-400/[0.04] py-3.5 pl-4 pr-3.5">
                  <SectionLabel className="mb-1.5 text-gold-300/90">Answer on file</SectionLabel>
                  <p className="max-w-3xl text-[12.5px] leading-relaxed text-graphite-100">{ticket.reply}</p>
                </div>
              ) : null}

              {ticket.status === 'closed' ? (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-ivory-200/[0.07] pt-4">
                  <p className="text-[11.5px] text-graphite-500">Closed. Reopen it if the member comes back to the same thread.</p>
                  <QuickAction
                    path={`/api/admin/tickets/${ticket.id}`}
                    method="PATCH"
                    body={{ status: 'in_review' }}
                    label="Reopen"
                    variant="secondary"
                    successMessage="Back in the queue."
                  />
                </div>
              ) : (
                <TicketReply id={ticket.id} requester={ticket.requester} status={ticket.status} assignee={ticket.assignee} />
              )}
            </Panel>
          ))}
        </div>
      ) : (
        <Panel>
          <EmptyState
            title={status === 'open' ? 'Nothing needs an answer' : 'No requests in this state'}
            description={
              status === 'open'
                ? 'Every question put to the office has been answered. Members write from /support; the queue is the same wherever it starts.'
                : 'Change the state filter to see the rest of the correspondence.'
            }
          />
        </Panel>
      )}
    </div>
  );
}
