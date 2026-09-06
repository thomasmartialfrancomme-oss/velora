import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarClock, UtensilsCrossed } from 'lucide-react';
import { PageHeader, StatStrip, Notice } from '@/components/app/page-chrome';
import { DataTable, TitleCell, type Column } from '@/components/app/data-table';
import { FilterBar } from '@/components/app/filter-bar';
import { Tabs } from '@/components/ui/tabs';
import { Badge, StatusDot, toneForStatus } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteButton, RecordForm, QuickAction, type FieldSpec } from '@/components/ui/record-form';
import { requireUser } from '@/lib/auth/session';
import { listProperties, listReservations } from '@/lib/data/read';
import type { ReservationRow } from '@/lib/data/tables';
import { RESERVATION_KINDS, RESERVATION_STATUS, STATUS_LABEL, formatDate, formatDateTime, formatTime, label as humanise, relativeTime } from '@/lib/utils/format';
import { getT } from '@/lib/i18n/server';

export const metadata: Metadata = { title: 'Lifestyle' };
export const dynamic = 'force-dynamic';

type Row = ReservationRow;

export default async function LifestylePage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const T = getT();
  const user = await requireUser();
  const scopeRaw = typeof searchParams?.scope === 'string' ? searchParams.scope : 'upcoming';
  const scope = (['upcoming', 'past', 'all'].includes(scopeRaw) ? scopeRaw : 'upcoming') as 'upcoming' | 'past' | 'all';
  const kind = typeof searchParams?.kind === 'string' ? searchParams.kind : 'all';
  const q = typeof searchParams?.q === 'string' ? searchParams.q : '';

  const all = listReservations(user.id, { scope });
  const properties = listProperties(user.id);
  const filtered = all.filter(
    (reservation) => (kind === 'all' || reservation.kind === kind) && (!q || [reservation.title, reservation.vendor ?? '', reservation.city ?? ''].some((value) => value.toLowerCase().includes(q.toLowerCase()))),
  );

  const requested = all.filter((reservation) => reservation.status === 'requested' || reservation.status === 'pending');
  const confirmed = all.filter((reservation) => reservation.status === 'confirmed');

  const fields: FieldSpec[] = [
    { key: 'title', label: 'What', type: 'text', required: true, span: 2, placeholder: 'Dinner, Table 4, Le Louis Louis' },
    { key: 'kind', label: 'Type', type: 'select', required: true, options: RESERVATION_KINDS.map((value) => ({ value, label: humanise(value, STATUS_LABEL) })) },
    { key: 'vendor', label: 'Venue or supplier', type: 'text', placeholder: 'Le Louis Louis' },
    { key: 'city', label: 'City', type: 'text' },
    { key: 'startsAt', label: 'When', type: 'datetime', hint: 'Leave empty for an open request — the office will propose times.' },
    { key: 'guests', label: 'Guests', type: 'number', min: 1 },
    { key: 'status', label: 'Status', type: 'select', required: true, options: RESERVATION_STATUS.map((value) => ({ value, label: humanise(value, STATUS_LABEL) })) },
    { key: 'reference', label: 'Reference', type: 'text', hint: 'Only what the venue gave you.' },
    { key: 'dressCode', label: 'Dress', type: 'text' },
    { key: 'propertyId', label: 'Near which residence', type: 'select', options: [{ value: '', label: 'None' }, ...properties.map((property) => ({ value: property.id, label: property.name }))] },
    { key: 'notes', label: 'Instructions', type: 'textarea', rows: 3, max: 600, span: 2, placeholder: 'No shellfish. Window table if the terrace is closed.' },
  ];

  const columns: Column<Row>[] = [
    {
      key: 'what',
      header: 'Request',
      width: '30%',
      cell: (row) => (
        <TitleCell
          title={
            <span className="flex items-center gap-2.5">
              <StatusDot status={row.status} />
              <span className="text-ivory-50">{row.title}</span>
            </span>
          }
          detail={[humanise(row.kind, STATUS_LABEL), row.vendor, row.city].filter(Boolean).join(' · ')}
        />
      ),
    },
    {
      key: 'when',
      header: 'When',
      cell: (row) => (row.startsAt ? <span className="text-graphite-200">{formatDateTime(row.startsAt, user.timezone)}</span> : <span className="text-graphite-600">{T("Time to be agreed")}</span>),
    },
    { key: 'guests', header: 'Party', align: 'right', hideBelow: 'md', cell: (row) => <span className="text-graphite-300">{row.guests}</span> },
    { key: 'status', header: 'Status', cell: (row) => <Badge tone={toneForStatus(row.status)}>{humanise(row.status, STATUS_LABEL)}</Badge> },
    {
      key: 'ref',
      header: 'Reference',
      hideBelow: 'lg',
      cell: (row) => (row.reference ? <span className="text-graphite-300">{row.reference}</span> : <span className="text-graphite-600">—</span>),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '14rem',
      cell: (row) => (
        <span className="relative z-10 inline-flex items-center justify-end gap-1.5">
          {row.status !== 'confirmed' && row.status !== 'cancelled' ? (
            <QuickAction path={`/api/reservations/${row.id}`} method="PATCH" body={{ status: 'confirmed' }} label="Confirmed" successMessage="Confirmation recorded." />
          ) : null}
          {row.status !== 'cancelled' ? (
            <QuickAction
              path={`/api/reservations/${row.id}`}
              method="PATCH"
              body={{ decision: 'cancel' }}
              label="Cancel"
              variant="ghost"
              successMessage="Cancelled in your records. The venue was not contacted."
              confirm={{
                title: 'Cancel this request?',
                body: 'This marks your own record as cancelled. If the venue already confirmed, the table has to be released with them directly — action requires confirmation.',
                confirmLabel: 'Cancel the record',
              }}
            />
          ) : null}
          <RecordForm
            title="Edit request"
            eyebrow="Lifestyle"
            path="/api/reservations"
            id={row.id}
            fields={fields}
            initial={{
              title: row.title,
              kind: row.kind,
              vendor: row.vendor,
              city: row.city,
              startsAt: row.startsAt,
              guests: row.guests,
              status: row.status,
              reference: row.reference,
              dressCode: row.dressCode,
              propertyId: row.propertyId ?? '',
              notes: row.notes,
            }}
            trigger={<span className="cursor-pointer px-1 text-[10.5px] uppercase tracking-[0.18em] text-graphite-400 transition-colors hover:text-gold-200">{T("Edit")}</span>}
          />
          <DeleteButton path={`/api/reservations/${row.id}`} label="Remove" title="Delete this request?" body="Removes it from your history entirely — including any reference you recorded." />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Module 05 · Lifestyle"
        title="Requests & reservations"
        lede="A table, a boat, a fitting, a closing of the museum after hours. You ask; the office arranges and reports exactly where each one stands."
        meta={
          <>
            <span>{requested.length} awaiting a venue</span>
            <span>{confirmed.length} confirmed</span>
            <Link href="/travel" className="text-gold-200 transition-colors hover:text-gold-100">{T("Travel →")}</Link>
          </>
        }
        actions={
          <RecordForm
            title="Make a request"
            eyebrow="Lifestyle"
            description="Requests are recorded and chased by the office. Nothing is booked with a venue until a person has spoken to them."
            path="/api/reservations"
            fields={fields}
            defaults={{ kind: 'restaurant', status: 'requested', guests: 2 }}
            submitLabel="Make a request"
            size="lg"
          />
        }
      />

      {requested.length ? (
        <Notice tone="attention" title={`${requested.length} request${requested.length === 1 ? '' : 's'} are with the office, not with you`}>{T("Each one is being chased. Where a venue has not answered, the status stays “requested” — the platform will not dress up a silence as a booking.")}</Notice>
      ) : null}

      <StatStrip
        items={[
          { label: 'In view', value: all.length, detail: scope === 'upcoming' ? 'from today onwards' : 'everything on record' },
          { label: 'Requested', value: requested.length, tone: requested.length ? 'attention' : 'ok', detail: 'waiting on a counterparty' },
          { label: 'Confirmed', value: confirmed.length, tone: 'ok', detail: confirmed.length ? `next: ${formatDate(confirmed[confirmed.length - 1].startsAt ?? '', 'day', user.timezone)}` : 'nothing yet' },
          { label: 'Unavailable', value: all.filter((r) => r.status === 'unavailable').length, detail: 'declined or impossible — recorded honestly' },
        ]}
      />

      <Tabs
        paramKey="scope"
        tabs={[
          { value: 'upcoming', label: 'Upcoming', count: all.length },
          { value: 'past', label: 'Past' },
          { value: 'all', label: 'All' },
        ]}
      />

      <FilterBar
        resultCount={`${filtered.length} shown`}
        filters={[
          { key: 'q', type: 'search', label: 'Search requests', placeholder: 'Venue, title, city…' },
          { key: 'kind', type: 'select', label: 'Type', options: [{ value: 'all', label: 'All' }, ...RESERVATION_KINDS.map((value) => ({ value, label: humanise(value, STATUS_LABEL) }))] },
        ]}
      />

      <DataTable
        rows={filtered}
        columns={columns}
        empty={
          <EmptyState
            compact
            title={scope === 'upcoming' ? 'No open requests' : 'Nothing recorded'}
            description="Ask for a table, a car, an hour with a tailor. The office turns it into a task with a status you can trust."
            icon={<UtensilsCrossed size={18} strokeWidth={1.3} />}
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {[
          { title: 'Requested', body: 'The office has been told and has not yet heard from the venue. Nothing more than that.', icon: <CalendarClock size={14} strokeWidth={1.4} /> },
          { title: 'Confirmed', body: 'A person at the venue said yes, and the reference was written down. Until then it does not read as confirmed.', icon: <UtensilsCrossed size={14} strokeWidth={1.4} /> },
          { title: 'Unavailable', body: 'Fully booked, closed, or the wrong season. Recorded rather than quietly deleted.', icon: <StatusDot status="cancelled" /> },
        ].map((item) => (
          <div key={item.title} className="rounded-[5px] border border-ivory-200/[0.07] bg-ink-950/60 p-5">
            <span className="flex items-center gap-2.5 text-gold-300/80">{item.icon}</span>
            <p className="mt-4 text-[12.5px] uppercase tracking-[0.18em] text-ivory-100">{item.title}</p>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-graphite-400">{item.body}</p>
          </div>
        ))}
      </div>

      <p className="text-[11.5px] leading-relaxed text-graphite-600">
        Statuses last changed {all[0] ? relativeTime(all[0].updatedAt) : '—'}. A request with no time set is not forgotten: it stays open until somebody
        puts an hour against it.
      </p>
    </div>
  );
}
