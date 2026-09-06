import type { Metadata } from 'next';
import Link from 'next/link';
import { Plane } from 'lucide-react';
import { PageHeader, StatStrip } from '@/components/app/page-chrome';
import { DataTable, TitleCell, type Column } from '@/components/app/data-table';
import { FilterBar } from '@/components/app/filter-bar';
import { Tabs } from '@/components/ui/tabs';
import { Badge, StatusDot, toneForStatus } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteButton, RecordForm, type FieldSpec } from '@/components/ui/record-form';
import { requireUser } from '@/lib/auth/session';
import { listProperties, listTrips } from '@/lib/data/read';
import type { TripWithDetail } from '@/lib/data/read';
import { TRAVEL_MODES, TRIP_STATUS, STATUS_LABEL, formatDate, formatTime, label as humanise, relativeTime } from '@/lib/utils/format';
import { getT } from '@/lib/i18n/server';

export const metadata: Metadata = { title: 'Travel' };
export const dynamic = 'force-dynamic';

type Row = TripWithDetail;

const LEG_KINDS = ['transfer', 'flight', 'train', 'arrival', 'house', 'dinner', 'meeting', 'departure'];
const LEG_STATUSES = ['pending', 'requested', 'confirmed', 'cancelled'];

export default async function TravelPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const T = getT();
  const user = await requireUser();
  const scopeRaw = typeof searchParams?.scope === 'string' ? searchParams.scope : 'upcoming';
  const scope = (['upcoming', 'past', 'all'].includes(scopeRaw) ? scopeRaw : 'upcoming') as 'upcoming' | 'past' | 'all';
  const q = typeof searchParams?.q === 'string' ? searchParams.q : '';
  const mode = typeof searchParams?.mode === 'string' ? searchParams.mode : 'all';

  const trips = listTrips(user.id, { scope });
  const properties = listProperties(user.id);
  const filtered = trips.filter(
    (trip) =>
      (mode === 'all' || trip.mode === mode) &&
      (!q || [trip.title, trip.originCity, trip.destinationCity, trip.notes ?? ''].some((value) => value.toLowerCase().includes(q.toLowerCase()))),
  );

  const fields: FieldSpec[] = [
    { key: 'title', label: 'Journey', type: 'text', required: true, span: 2, placeholder: 'Nice → Monaco, arrival weekend' },
    { key: 'originCity', label: 'From', type: 'text', required: true },
    { key: 'destinationCity', label: 'To', type: 'text', required: true },
    { key: 'startsAt', label: 'Departs', type: 'datetime', required: true, hint: 'Local time at departure.' },
    { key: 'endsAt', label: 'Returns', type: 'datetime' },
    { key: 'mode', label: 'By', type: 'select', options: TRAVEL_MODES.map((value) => ({ value, label: humanise(value, STATUS_LABEL) })), required: true },
    { key: 'status', label: 'Status', type: 'select', options: TRIP_STATUS.map((value) => ({ value, label: humanise(value, STATUS_LABEL) })), required: true },
    { key: 'travelers', label: 'Travellers', type: 'number', min: 1, hint: 'Seats and covers are set from this number.' },
    {
      key: 'propertyId',
      label: 'Arriving at',
      type: 'select',
      options: [{ value: '', label: 'No residence linked' }, ...properties.map((property) => ({ value: property.id, label: `${property.name} · ${property.city}` }))],
    },
    { key: 'notes', label: 'Notes', type: 'textarea', rows: 2, max: 800, span: 2 },
    {
      key: 'legs',
      label: 'Arrival plan',
      type: 'repeat',
      span: 2,
      itemLabel: 'Step',
      addLabel: 'Add a step',
      hint: 'Each step is a thing the office must chase. Leave the status at “requested” until a person tells you it is confirmed.',
      subfields: [
        { key: 'label', label: 'Step', type: 'text', required: true, placeholder: 'Driver from Nice airport' },
        { key: 'kind', label: 'Type', type: 'select', options: LEG_KINDS.map((value) => ({ value, label: humanise(value, STATUS_LABEL) })) },
        { key: 'at', label: 'When', type: 'datetime' },
        { key: 'provider', label: 'Provider' },
        { key: 'detail', label: 'Detail', type: 'text' },
        { key: 'status', label: 'Status', type: 'select', options: LEG_STATUSES.map((value) => ({ value, label: humanise(value, STATUS_LABEL) })) },
      ],
    },
  ];

  const counts = {
    upcoming: trips.filter((trip) => new Date(trip.startsAt) >= new Date()).length,
    pendingLegs: trips.reduce((sum, trip) => sum + trip.pendingLegs, 0),
    legs: trips.reduce((sum, trip) => sum + trip.legCount, 0),
  };

  const columns: Column<Row>[] = [
    {
      key: 'journey',
      header: 'Journey',
      width: '30%',
      cell: (row) => (
        <TitleCell
          title={
            <span className="flex items-center gap-2.5">
              <StatusDot status={row.status} />
              <span className="text-ivory-50">{row.title}</span>
            </span>
          }
          detail={`${row.originCity} → ${row.destinationCity}${row.propertyName ? ` · ${row.propertyName}` : ''}`}
        />
      ),
    },
    {
      key: 'when',
      header: 'Departs',
      cell: (row) => (
        <span className="text-graphite-200">
          {formatDate(row.startsAt, 'day', user.timezone)}
          <span className="ml-2 text-[11.5px] text-graphite-500">{formatTime(row.startsAt, user.timezone)}</span>
        </span>
      ),
    },
    { key: 'mode', header: 'By', hideBelow: 'md', cell: (row) => <span className="text-graphite-300">{humanise(row.mode, STATUS_LABEL)}</span> },
    { key: 'status', header: 'Status', cell: (row) => <Badge tone={toneForStatus(row.status)}>{humanise(row.status, STATUS_LABEL)}</Badge> },
    {
      key: 'plan',
      header: 'Arrival plan',
      cell: (row) =>
        row.legCount ? (
          <span className={row.pendingLegs ? 'text-gold-200' : 'text-state-ok'}>
            {row.legCount - row.pendingLegs}/{row.legCount} confirmed
          </span>
        ) : (
          <span className="text-graphite-600">{T("No plan yet")}</span>
        ),
    },
    { key: 'party', header: 'Party', align: 'right', hideBelow: 'lg', cell: (row) => <span className="text-graphite-300">{row.travelers}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '11rem',
      cell: (row) => (
        <span className="relative z-10 inline-flex items-center justify-end gap-2">
          <Link href={`/travel/${row.id}`} className="text-[10.5px] uppercase tracking-[0.18em] text-gold-200 transition-colors hover:text-gold-100">{T("Plan →")}</Link>
          <RecordForm
            title={`Edit ${row.title}`}
            eyebrow="Journey"
            path="/api/trips"
            id={row.id}
            fields={fields}
            initial={{
              title: row.title,
              originCity: row.originCity,
              destinationCity: row.destinationCity,
              startsAt: row.startsAt,
              endsAt: row.endsAt,
              mode: row.mode,
              status: row.status,
              travelers: row.travelers,
              propertyId: row.propertyId ?? '',
              notes: row.notes,
              legs: row.legs.map((leg) => ({ label: leg.label, kind: leg.kind, at: leg.at, provider: leg.provider, detail: leg.detail, status: leg.status })),
            }}
            size="lg"
            trigger={<span className="cursor-pointer px-1 text-[10.5px] uppercase tracking-[0.18em] text-graphite-400 transition-colors hover:text-gold-200">{T("Edit")}</span>}
          />
          <DeleteButton path={`/api/trips/${row.id}`} label="Remove" title={`Remove “${row.title}”?`} body="The journey and its arrival steps are deleted. Anything already booked with a counterparty is not affected — cancel those directly." />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Module 04 · Travel"
        title="Movements"
        lede="A journey is a timeline, not a calendar entry: the transfer, the handling, the house being made ready, dinner on the table when you walk in."
        meta={
          <>
            <span>{counts.upcoming} upcoming</span>
            <span>{counts.pendingLegs} steps waiting on a counterparty</span>
            <span>time zone {user.timezone}</span>
          </>
        }
        actions={
          <>
            <Button asLink href="/lifestyle" variant="ghost" size="md">{T("Reservations")}</Button>
            <RecordForm
              title="Raise a journey"
              eyebrow="Travel"
              description="Add the movement first; the office builds the arrival plan around it. Nothing here books anything by itself — each step is chased and recorded."
              path="/api/trips"
              fields={fields}
              defaults={{ mode: 'car', status: 'pending', travelers: 2, legs: [{ label: 'Arrival — residence prepared', kind: 'arrival', status: 'pending', detail: 'Housekeeping to be scheduled' }] }}
              submitLabel="Raise a journey"
              size="lg"
            />
          </>
        }
      />

      <StatStrip
        items={[
          { label: 'Journeys in view', value: trips.length, detail: scope === 'upcoming' ? 'from today onwards' : scope === 'past' ? 'completed or cancelled' : 'everything on record' },
          { label: 'Steps to chase', value: counts.pendingLegs, detail: counts.pendingLegs ? 'not yet confirmed by a provider' : 'everything confirmed', tone: counts.pendingLegs ? 'attention' : 'ok' },
          { label: 'Residences prepared', value: trips.filter((trip) => trip.propertyId).length, detail: 'journeys with a house attached', href: '/properties' },
          { label: 'Last movement', value: trips[0] ? relativeTime(trips[0].startsAt).replace(' ago', '').replace('in ', '') : '—', detail: trips[0] ? `${trips[0].originCity} → ${trips[0].destinationCity}` : 'nothing booked' },
        ]}
      />

      <Tabs
        paramKey="scope"
        tabs={[
          { value: 'upcoming', label: 'Upcoming', count: trips.filter((trip) => new Date(trip.startsAt) >= new Date()).length },
          { value: 'past', label: 'Past' },
          { value: 'all', label: 'All', count: trips.length },
        ]}
      />

      <FilterBar
        resultCount={`${filtered.length} shown`}
        filters={[
          { key: 'q', type: 'search', label: 'Search journeys', placeholder: 'Title, city, note…' },
          { key: 'mode', type: 'select', label: 'By', options: [{ value: 'all', label: 'All' }, ...TRAVEL_MODES.map((value) => ({ value, label: humanise(value, STATUS_LABEL) }))] },
        ]}
      />

      <DataTable
        rows={filtered}
        columns={columns}
        hrefFor={(row) => `/travel/${row.id}`}
        empty={
          <EmptyState
            compact
            title={scope === 'upcoming' ? 'Nothing is scheduled' : 'No journeys recorded'}
            description="Raise a journey and the office assembles the arrival plan: driver, handling, the house, dinner, a car waiting."
            icon={<Plane size={18} strokeWidth={1.3} />}
            action={undefined}
          />
        }
      />

      <p className="text-[11.5px] leading-relaxed text-graphite-600">
        A step reads “requested” until a person at the other end tells us it is confirmed. VELORA records what it is told; it does not invent a yes.
      </p>
    </div>
  );
}
