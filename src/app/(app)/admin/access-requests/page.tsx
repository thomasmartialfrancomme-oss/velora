import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, StatStrip, Notice } from '@/components/app/page-chrome';
import { Panel, PanelHeader, Divider } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { FilterBar } from '@/components/app/filter-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { AccessRequestTriage } from '@/components/app/admin-actions';
import { requireAdmin } from '@/lib/auth/session';
import { adminAccessRequests } from '@/lib/data/admin';
import { formatDateTime, label as humanise, relativeTime, STATUS_LABEL } from '@/lib/utils/format';
import { getT } from '@/lib/i18n/server';

export const metadata: Metadata = { title: 'Access queue · Administration' };
export const dynamic = 'force-dynamic';

const ORDER: Record<string, number> = { new: 0, reviewing: 1, invited: 2, declined: 3, archived: 4 };

export default async function AdminAccessRequestsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const T = getT();
  const admin = await requireAdmin();
  const status = typeof searchParams?.status === 'string' ? searchParams.status : 'open';

  const all = adminAccessRequests('all');
  // "Needs a decision" is not a state a row can hold — it is the name for the two
  // states that still require one. Matching the literal 'open' returned nothing, so
  // the queue rendered "no one is waiting" beside a header reading four awaiting a
  // first read: the default view of the intake queue was permanently empty.
  const OPEN_STATES = ['new', 'reviewing'];
  const visible = all.filter((row) =>
    status === 'all' ? true : status === 'open' ? OPEN_STATES.includes(row.status) : row.status === status,
  );
  const rows = visible.sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const countOf = (value: string) => all.filter((row) => row.status === value).length;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Private office"
        title="Access queue"
        lede="Every household that asked to be managed. The decision here is who is let in — inviting creates an account with no passphrase, only a link the applicant uses to set one."
        meta={
          <>
            <span>{all.length} on record</span>
            <span>{countOf('new')} awaiting a first read</span>
            <span>{countOf('invited')} invited</span>
            <span>triaged by {admin.fullName}</span>
          </>
        }
        actions={
          <Link href="/access/request" className="text-[11px] uppercase tracking-[0.2em] text-gold-200 transition-colors hover:text-gold-100">{T("The form members see →")}</Link>
        }
      />

      <StatStrip
        items={[
          { label: 'New', value: countOf('new'), detail: 'no one has read them yet', tone: countOf('new') ? 'attention' : 'ok' },
          { label: 'Reviewing', value: countOf('reviewing'), detail: 'a person is on it' },
          { label: 'Invited', value: countOf('invited'), detail: 'waiting for a passphrase to be chosen' },
          { label: 'Declined', value: countOf('declined'), detail: 'with the reason on file' },
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
              { value: 'open', label: 'Needs a decision' },
              { value: 'new', label: 'New only' },
              { value: 'reviewing', label: 'Reviewing' },
              { value: 'invited', label: 'Invited' },
              { value: 'declined', label: 'Declined' },
              { value: 'archived', label: 'Archived' },
              { value: 'all', label: 'Everything' },
            ],
          },
        ]}
      />

      {rows.length ? (
        <div className="space-y-5">
          {rows.map((row) => {
            const applicant = `${row.firstName} ${row.lastName}`.trim();
            return (
              <Panel key={row.id}>
                <PanelHeader
                  label={`Asked ${relativeTime(row.createdAt)}`}
                  title={applicant || row.email}
                  description={row.message ?? 'No message was left with the request.'}
                  actions={
                    <div className="flex items-center gap-2">
                      <Badge tone={row.status === 'new' ? 'gold' : row.status === 'reviewing' ? 'info' : row.status === 'invited' ? 'ok' : 'neutral'}>
                        {humanise(row.status, STATUS_LABEL)}
                      </Badge>
                    </div>
                  }
                />
                <Divider className="my-5" />

                <dl className="grid gap-x-8 gap-y-3 text-[12.5px] sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: 'Email', value: row.email },
                    { label: 'Country', value: row.country || '—' },
                    { label: 'Residences', value: `${row.residences}` },
                    { label: 'Primary need', value: humanise(row.primaryRequirement, STATUS_LABEL) },
                    { label: 'Heard of us', value: row.referrer || '—' },
                    { label: 'Paid campaign', value: row.campaign || 'organic / direct' },
                    { label: 'Submitted', value: formatDateTime(row.createdAt, admin.timezone) },
                  ].map((entry) => (
                    <div key={entry.label}>
                      <dt className="text-[10.5px] uppercase tracking-[0.18em] text-graphite-500">{entry.label}</dt>
                      <dd className="mt-1.5 text-graphite-100">{entry.value}</dd>
                    </div>
                  ))}
                </dl>

                {row.reviewerNote ? (
                  <p className="mt-5 rounded-[4px] border-l border-gold-400/45 bg-gold-400/[0.04] py-3 pl-4 pr-3 text-[12.5px] leading-relaxed text-graphite-100">
                    <span className="label mr-2 text-gold-300/80">{T("On file")}</span>
                    {row.reviewerNote}
                  </p>
                ) : null}

                {row.status === 'declined' || row.status === 'archived' ? (
                  <p className="mt-5 text-[11.5px] text-graphite-500">{T("Closed. Reopen it by moving it to")}<span className="text-graphite-200">reviewing</span>{T("— nothing is deleted from the queue, only marked.")}</p>
                ) : null}

                <AccessRequestTriage id={row.id} applicant={applicant || row.email} />
              </Panel>
            );
          })}
        </div>
      ) : (
        <Panel>
          <EmptyState
            title="Nobody is waiting"
            description="The intake form at /access/request is public. Whatever arrives appears here with the residence count and the first message, and it stays here after it is decided."
          />
        </Panel>
      )}

      <Notice tone="info" title="What an invite does not do">
        It does not email anybody and it does not choose a passphrase for the applicant. An account is created in the “invited” state with an unusable
        credential and a fourteen-day link; the applicant sets their own passphrase through the reset screen. Until then they cannot read anything.
      </Notice>
    </div>
  );
}
