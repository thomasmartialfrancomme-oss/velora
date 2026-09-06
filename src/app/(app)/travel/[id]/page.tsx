import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, Check, CircleDashed, PhoneCall } from 'lucide-react';
import { PageHeader, StatStrip, KeyValue, Notice } from '@/components/app/page-chrome';
import { Badge, StatusDot, toneForStatus } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Divider, Panel, PanelHeader, SectionLabel } from '@/components/ui/panel';
import { DeleteButton, RecordForm, QuickAction, type FieldSpec } from '@/components/ui/record-form';
import { requireUser } from '@/lib/auth/session';
import { getTrip, listProperties } from '@/lib/data/read';
import { STATUS_LABEL, TRAVEL_MODES, TRIP_STATUS, formatDate, formatDateTime, formatTime, label as humanise, relativeTime } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

const LEG_KINDS = ['transfer', 'flight', 'train', 'arrival', 'house', 'dinner', 'meeting', 'departure'];
const LEG_STATUSES = ['pending', 'requested', 'confirmed', 'cancelled'];

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const user = await requireUser();
  const trip = getTrip(user.id, params.id);
  return { title: trip ? trip.title : 'Journey' };
}

export default async function JourneyPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const trip = getTrip(user.id, params.id);
  if (!trip) notFound();

  const properties = listProperties(user.id);
  const confirmed = trip.legs.filter((leg) => leg.status === 'confirmed').length;

  const fields: FieldSpec[] = [
    { key: 'title', label: 'Journey', type: 'text', required: true, span: 2 },
    { key: 'originCity', label: 'From', type: 'text', required: true },
    { key: 'destinationCity', label: 'To', type: 'text', required: true },
    { key: 'startsAt', label: 'Departs', type: 'datetime', required: true },
    { key: 'endsAt', label: 'Returns', type: 'datetime' },
    { key: 'mode', label: 'By', type: 'select', options: TRAVEL_MODES.map((value) => ({ value, label: humanise(value, STATUS_LABEL) })) },
    { key: 'status', label: 'Status', type: 'select', options: TRIP_STATUS.map((value) => ({ value, label: humanise(value, STATUS_LABEL) })) },
    { key: 'travelers', label: 'Travellers', type: 'number', min: 1 },
    { key: 'propertyId', label: 'Arriving at', type: 'select', options: [{ value: '', label: 'No residence linked' }, ...properties.map((property) => ({ value: property.id, label: property.name }))] },
    { key: 'notes', label: 'Notes', type: 'textarea', rows: 3, max: 800, span: 2 },
    {
      key: 'legs',
      label: 'Arrival plan',
      type: 'repeat',
      span: 2,
      itemLabel: 'Step',
      addLabel: 'Add a step',
      hint: 'Saving this list replaces the plan. Steps already confirmed keep their status only if you set it again here.',
      subfields: [
        { key: 'label', label: 'Step', type: 'text', required: true },
        { key: 'kind', label: 'Type', type: 'select', options: LEG_KINDS.map((value) => ({ value, label: humanise(value, STATUS_LABEL) })) },
        { key: 'at', label: 'When', type: 'datetime' },
        { key: 'provider', label: 'Provider' },
        { key: 'detail', label: 'Detail' },
        { key: 'status', label: 'Status', type: 'select', options: LEG_STATUSES.map((value) => ({ value, label: humanise(value, STATUS_LABEL) })) },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <Link href="/travel" className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-graphite-400 transition-colors hover:text-ivory-100">
        <ArrowLeft size={12} strokeWidth={1.4} /> All journeys
      </Link>

      <PageHeader
        eyebrow={`${humanise(trip.mode, STATUS_LABEL)} · ${trip.originCity} → ${trip.destinationCity}`}
        title={trip.title}
        lede={trip.notes ?? 'No notes recorded for this journey.'}
        meta={
          <>
            <span className="flex items-center gap-2">
              <StatusDot status={trip.status} /> {humanise(trip.status, STATUS_LABEL)}
            </span>
            <span>
              Departs {formatDateTime(trip.startsAt, user.timezone)}
            </span>
            {trip.endsAt ? <span>Returns {formatDate(trip.endsAt, 'day', user.timezone)}</span> : null}
            <span>{trip.travelers} travelling</span>
          </>
        }
        actions={
          <>
            {trip.status !== 'cancelled' ? (
              <QuickAction
                path={`/api/trips/${trip.id}`}
                method="PATCH"
                body={{ status: 'cancelled' }}
                label="Cancel journey"
                variant="danger"
                successMessage="Marked cancelled. Providers were not contacted — do that directly."
                confirm={{
                  title: 'Cancel this journey in your records?',
                  body: 'The office will stop chasing the steps below. Anything already booked with a hotel, driver or chef still has to be cancelled with them — VELORA does not do that for you.',
                  confirmLabel: 'Mark cancelled',
                }}
              />
            ) : (
              <QuickAction path={`/api/trips/${trip.id}`} method="PATCH" body={{ status: 'pending' }} label="Reopen" variant="secondary" successMessage="Reopened — the plan is live again." />
            )}
            <RecordForm
              title={`Edit ${trip.title}`}
              eyebrow="Journey"
              path="/api/trips"
              id={trip.id}
              size="lg"
              fields={fields}
              initial={{
                title: trip.title,
                originCity: trip.originCity,
                destinationCity: trip.destinationCity,
                startsAt: trip.startsAt,
                endsAt: trip.endsAt,
                mode: trip.mode,
                status: trip.status,
                travelers: trip.travelers,
                propertyId: trip.propertyId ?? '',
                notes: trip.notes,
                legs: trip.legs.map((leg) => ({ label: leg.label, kind: leg.kind, at: leg.at, provider: leg.provider, detail: leg.detail, status: leg.status })),
              }}
              submitLabel="Edit journey"
            />
            <DeleteButton path={`/api/trips/${trip.id}`} label="Remove" title="Delete this journey?" body="The record and its steps are removed from your history. Nothing else is touched." />
          </>
        }
      />

      {trip.pendingLegs ? (
        <Notice
          tone="attention"
          title={`${trip.pendingLegs} step${trip.pendingLegs === 1 ? '' : 's'} still need a person on the other end`}
          action={
            <QuickAction
              path={`/api/trips/${trip.id}`}
              method="PATCH"
              body={{ status: 'confirmed' }}
              label="Mark journey confirmed"
              variant="gold-outline"
              size="sm"
              successMessage="Journey marked confirmed. Steps keep their own status."
            />
          }
        >
          Pressing “confirmed” here records what someone told you. Action requires confirmation — the platform never books by itself.
        </Notice>
      ) : null}

      <StatStrip
        items={[
          { label: 'Steps in the plan', value: trip.legCount, detail: trip.legCount ? `${confirmed} confirmed` : 'nothing assembled yet' },
          { label: 'Waiting', value: trip.pendingLegs, tone: trip.pendingLegs ? 'attention' : 'ok', detail: trip.pendingLegs ? 'provider has not answered' : 'all answered' },
          { label: 'Residence', value: trip.propertyName ?? 'Not linked', detail: trip.propertyId ? 'prepared by the house team' : 'attach one to coordinate the arrival', href: trip.propertyId ? `/properties/${trip.propertyId}` : '/properties' },
          { label: 'Countdown', value: relativeTime(trip.startsAt), detail: formatTime(trip.startsAt, user.timezone) + ' local' },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Panel>
          <PanelHeader label="Arrival plan" title="Every step, in order" description="Each line is what the office has to chase, and what it was last told." />
          <Divider className="my-5" />
          {trip.legs.length ? (
            <ol className="space-y-0">
              {trip.legs.map((leg, index) => (
                <li key={leg.id} className="relative flex gap-5 pb-6 last:pb-0">
                  {index < trip.legs.length - 1 ? <span className="absolute bottom-0 left-[11px] top-6 w-px bg-ivory-200/[0.09]" aria-hidden /> : null}
                  <span
                    className={
                      leg.status === 'confirmed'
                        ? 'relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-state-ok/45 bg-ink-950 text-state-ok'
                        : leg.status === 'cancelled'
                          ? 'relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-state-risk/45 bg-ink-950 text-state-risk'
                          : 'relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold-400/45 bg-ink-950 text-gold-300'
                    }
                  >
                    {leg.status === 'confirmed' ? <Check size={11} strokeWidth={1.8} /> : leg.status === 'cancelled' ? <CircleDashed size={11} strokeWidth={1.6} /> : <PhoneCall size={10} strokeWidth={1.6} />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="text-[13.5px] text-ivory-50">{leg.label}</p>
                      <span className="flex items-center gap-3 text-[11px] text-graphite-500">
                        {leg.at ? formatDateTime(leg.at, user.timezone) : 'time to be set'}
                        <Badge tone={toneForStatus(leg.status)}>{humanise(leg.status, STATUS_LABEL)}</Badge>
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-graphite-400">
                      {leg.detail ?? 'No instruction recorded.'}
                      {leg.provider ? <span className="text-graphite-600"> · {leg.provider}</span> : null}
                      {leg.reference ? <span className="text-graphite-600"> · ref {leg.reference}</span> : null}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {leg.status !== 'confirmed' ? (
                        <QuickAction
                          path={`/api/trips/${trip.id}/legs/${leg.id}`}
                          method="PATCH"
                          body={{ status: 'confirmed' }}
                          label="It is confirmed"
                          icon={<Check size={12} strokeWidth={1.6} />}
                          successMessage="Recorded. The counterparty was not contacted."
                        />
                      ) : (
                        <QuickAction path={`/api/trips/${trip.id}/legs/${leg.id}`} method="PATCH" body={{ status: 'pending' }} label="Reopen step" size="sm" successMessage="Step reopened." />
                      )}
                      {leg.status !== 'requested' ? (
                        <QuickAction
                          path={`/api/trips/${trip.id}/legs/${leg.id}`}
                          method="PATCH"
                          body={{ status: 'requested' }}
                          label="Ask them"
                          size="sm"
                          variant="ghost"
                          successMessage="Marked as requested — somebody still has to make the call."
                        />
                      ) : null}
                      {leg.status !== 'cancelled' ? (
                        <QuickAction path={`/api/trips/${trip.id}/legs/${leg.id}`} method="PATCH" body={{ status: 'cancelled' }} label="Drop" size="sm" variant="ghost" successMessage="Step dropped from the plan." />
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="text-center">
              <SectionLabel>The plan is empty</SectionLabel>
              <p className="mx-auto mt-3 max-w-sm text-[12.5px] leading-relaxed text-graphite-400">
                Edit the journey and add the steps a household needs around an arrival: the transfer, the handling at the gate, the house opened, dinner
                held, a car fuelled.
              </p>
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel>
            <PanelHeader label="The movement" title="What is known" />
            <Divider className="my-5" />
            <KeyValue
              items={[
                { label: 'From', value: trip.originCity },
                { label: 'To', value: trip.destinationCity },
                { label: 'By', value: humanise(trip.mode, STATUS_LABEL) },
                { label: 'Departs', value: formatDateTime(trip.startsAt, user.timezone) },
                { label: 'Returns', value: trip.endsAt ? formatDate(trip.endsAt, 'long', user.timezone) : 'Open' },
                { label: 'Party', value: `${trip.travelers} travelling` },
                { label: 'Residence', value: trip.propertyId ? <Link href={`/properties/${trip.propertyId}`} className="link-lux text-gold-200">{trip.propertyName}</Link> : 'Not linked' },
                { label: 'Raised', value: relativeTime(trip.createdAt) },
              ]}
            />
          </Panel>

          <Panel>
            <PanelHeader label="Coordination" title="What the office does with this" />
            <Divider className="my-5" />
            <ul className="space-y-3.5">
              {[
                'The staff assigned to the destination residence see the arrival in their list.',
                'A request made in Lifestyle for the same dates is shown beside this plan.',
                'Anything left unconfirmed the night before appears in your briefing.',
                'No step is ever marked confirmed because the calendar looks tidy.',
              ].map((item) => (
                <li key={item} className="flex gap-3 text-[12.5px] leading-relaxed text-graphite-300">
                  <span className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-gold-400/80" />
                  {item}
                </li>
              ))}
            </ul>
            <Button asLink href="/lifestyle" variant="secondary" size="sm" className="mt-6 w-full">
              Requests for this trip
            </Button>
          </Panel>
        </div>
      </div>
    </div>
  );
}
