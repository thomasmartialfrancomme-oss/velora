import type { Metadata } from 'next';
import Link from 'next/link';
import { CarFront } from 'lucide-react';
import { PageHeader, StatStrip, KeyValue, Notice } from '@/components/app/page-chrome';
import { DataTable, TitleCell, type Column } from '@/components/app/data-table';
import { FilterBar } from '@/components/app/filter-bar';
import { Badge, StatusDot, toneForStatus } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Divider, Panel, PanelHeader } from '@/components/ui/panel';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteButton, RecordForm, QuickAction, type FieldSpec } from '@/components/ui/record-form';
import { requireUser } from '@/lib/auth/session';
import { listProperties, listStaff, listVehicles } from '@/lib/data/read';
import { STAFF_STATUS, STATUS_LABEL, VEHICLE_KINDS, VEHICLE_STATUS, daysUntil, formatDate, label as humanise, relativeTime } from '@/lib/utils/format';
import type { VehicleWithDetail } from '@/lib/data/read';

export const metadata: Metadata = { title: 'Vehicles' };
export const dynamic = 'force-dynamic';

type Row = VehicleWithDetail;

export default async function VehiclesPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const user = await requireUser();
  const status = typeof searchParams?.status === 'string' ? searchParams.status : 'all';
  const kind = typeof searchParams?.kind === 'string' ? searchParams.kind : 'all';
  const q = typeof searchParams?.q === 'string' ? searchParams.q : '';

  const all = listVehicles(user.id);
  const staff = listStaff(user.id);
  const properties = listProperties(user.id);

  const filtered = all
    .filter((vehicle) => (status === 'all' || vehicle.status === status) && (kind === 'all' || vehicle.kind === kind))
    .filter((vehicle) => {
      if (!q) return true;
      const needle = q.toLowerCase();
      return [vehicle.make, vehicle.model, vehicle.plate ?? '', vehicle.location ?? ''].some((value) => value.toLowerCase().includes(needle));
    });

  const dueSoon = all.filter((vehicle) => vehicle.serviceDueSoon);
  const insuranceLapsed = all.filter((vehicle) => vehicle.insuranceStatus === 'expired' || (vehicle.insuranceDaysLeft !== null && vehicle.insuranceDaysLeft < 0));

  const fields: FieldSpec[] = [
    { key: 'make', label: 'Make', type: 'text', required: true, placeholder: 'Aston Martin' },
    { key: 'model', label: 'Model', type: 'text', required: true, placeholder: 'DB12' },
    { key: 'year', label: 'Year', type: 'number', required: true, min: 1950 },
    { key: 'plate', label: 'Registration' },
    { key: 'kind', label: 'Type', type: 'select', options: VEHICLE_KINDS.map((value) => ({ value, label: humanise(value, STATUS_LABEL) })), required: true },
    { key: 'status', label: 'Status', type: 'select', options: VEHICLE_STATUS.map((value) => ({ value, label: humanise(value, STATUS_LABEL) })), required: true },
    { key: 'propertyId', label: 'Kept at', type: 'select', options: [{ value: '', label: 'Not kept at a residence' }, ...properties.map((property) => ({ value: property.id, label: property.name }))] },
    {
      key: 'assignedDriverId',
      label: 'Usual driver',
      type: 'select',
      options: [{ value: '', label: 'No driver assigned' }, ...staff.filter((person) => person.role === 'driver' || person.status !== 'unreachable').map((person) => ({ value: person.id, label: `${person.firstName} ${person.lastName}` }))],
    },
    { key: 'location', label: 'Where it is now', type: 'text', placeholder: 'Garage B, Cap Ferrat' },
    { key: 'mileageKm', label: 'Odometer (km)', type: 'number', min: 0 },
    { key: 'serviceIntervalKm', label: 'Service interval (km)', type: 'number', min: 0 },
    { key: 'nextServiceKm', label: 'Next service at (km)', type: 'number', min: 0 },
    { key: 'nextServiceAt', label: 'Next service by', type: 'date' },
    { key: 'fuelLevelPct', label: 'Fuel / charge (%)', type: 'number', min: 0 },
    { key: 'insuranceProvider', label: 'Insurer' },
    { key: 'insuranceStatus', label: 'Insurance', type: 'select', options: ['active', 'expiring', 'expired', 'pending'].map((value) => ({ value, label: humanise(value, STATUS_LABEL) })) },
    { key: 'insuranceExpiresAt', label: 'Insurance expires', type: 'date' },
    { key: 'notes', label: 'Care notes', type: 'textarea', rows: 3, max: 800, span: 2, placeholder: 'Winter tyres swapped in November. Never left outdoors overnight.' },
  ];

  const columns: Column<Row>[] = [
    {
      key: 'vehicle',
      header: 'Vehicle',
      width: '26%',
      cell: (row) => (
        <TitleCell
          title={
            <span className="flex items-center gap-2.5">
              <StatusDot status={row.status} />
              <span className="text-ivory-50">
                {row.make} {row.model}
              </span>
            </span>
          }
          detail={`${row.year} · ${humanise(row.kind, STATUS_LABEL)}${row.plate ? ` · ${row.plate}` : ''}`}
        />
      ),
    },
    { key: 'status', header: 'Status', cell: (row) => <Badge tone={toneForStatus(row.status)}>{humanise(row.status, STATUS_LABEL)}</Badge> },
    { key: 'kept', header: 'Kept at', hideBelow: 'md', cell: (row) => (row.propertyName ? <Link href={`/properties/${row.propertyId}`} className="link-lux text-graphite-200 hover:text-ivory-50">{row.propertyName}</Link> : <span className="text-graphite-600">{row.location ?? 'Unassigned'}</span>) },
    { key: 'driver', header: 'Driver', hideBelow: 'lg', cell: (row) => <span className="text-graphite-300">{row.driverName ?? '—'}</span> },
    {
      key: 'odometer',
      header: 'Odometer',
      align: 'right',
      hideBelow: 'md',
      cell: (row) => (
        <span className="text-graphite-200">
          {row.mileageKm.toLocaleString('en-GB')} km
          {row.nextServiceKm ? <span className="ml-1.5 text-[11px] text-graphite-600">/ {row.nextServiceKm.toLocaleString('en-GB')}</span> : null}
        </span>
      ),
    },
    {
      key: 'service',
      header: 'Service',
      cell: (row) =>
        row.nextServiceAt ? (
          <span className={row.serviceDueSoon ? 'text-gold-200' : 'text-graphite-300'}>
            {formatDate(row.nextServiceAt, 'day', user.timezone)}
            {(() => {
              const days = daysUntil(row.nextServiceAt);
              return days === null ? '' : days < 0 ? ' · overdue' : ` · in ${days}d`;
            })()}
          </span>
        ) : (
          <span className="text-graphite-600">Not scheduled</span>
        ),
    },
    {
      key: 'insurance',
      header: 'Insurance',
      hideBelow: 'lg',
      cell: (row) => {
        const days = row.insuranceDaysLeft;
        const tone = row.insuranceStatus === 'expired' || (days !== null && days < 0) ? 'text-state-risk' : days !== null && days <= 30 ? 'text-gold-200' : 'text-graphite-300';
        return (
          <span className={tone}>
            {humanise(row.insuranceStatus, STATUS_LABEL)}
            {row.insuranceExpiresAt ? <span className="ml-1.5 text-[11px] text-graphite-600">{formatDate(row.insuranceExpiresAt, 'short', user.timezone)}</span> : null}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '13rem',
      cell: (row) => (
        <span className="relative z-10 inline-flex items-center justify-end gap-1.5">
          {row.status !== 'in_use' ? (
            <QuickAction path={`/api/vehicles/${row.id}`} method="PATCH" body={{ status: 'in_use' }} label="Out" successMessage="Marked in use — the office will expect it back." />
          ) : (
            <QuickAction path={`/api/vehicles/${row.id}`} method="PATCH" body={{ status: 'ready' }} label="Back" successMessage="Back in the garage." />
          )}
          <RecordForm
            title={`Edit ${row.make} ${row.model}`}
            eyebrow="Fleet"
            path="/api/vehicles"
            id={row.id}
            fields={fields}
            initial={{
              make: row.make,
              model: row.model,
              year: row.year,
              plate: row.plate,
              kind: row.kind,
              status: row.status,
              propertyId: row.propertyId ?? '',
              assignedDriverId: row.assignedDriverId ?? '',
              location: row.location,
              mileageKm: row.mileageKm,
              serviceIntervalKm: row.serviceIntervalKm,
              nextServiceKm: row.nextServiceKm,
              nextServiceAt: row.nextServiceAt,
              fuelLevelPct: row.fuelLevelPct,
              insuranceProvider: row.insuranceProvider,
              insuranceStatus: row.insuranceStatus,
              insuranceExpiresAt: row.insuranceExpiresAt,
              notes: row.notes,
            }}
            trigger={<span className="cursor-pointer px-1 text-[10.5px] uppercase tracking-[0.18em] text-graphite-400 transition-colors hover:text-gold-200">Edit</span>}
          />
          <DeleteButton path={`/api/vehicles/${row.id}`} label="Remove" title={`Remove the ${row.make} ${row.model}?`} body="Servicing history for this vehicle is deleted with it. Nothing else is touched." />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Module 03 · Fleet"
        title="Vehicles"
        lede="What you own, where it is, when it next needs the workshop, and whether it is insured to be driven."
        meta={
          <>
            <span>{all.length} in the fleet</span>
            <span>{all.filter((v) => v.status === 'ready').length} ready</span>
            <span>{dueSoon.length} service due within 30 days</span>
          </>
        }
        actions={
          <RecordForm
            title="Add a vehicle"
            eyebrow="Fleet"
            description="Recording a vehicle lets the office keep its service window, its insurance date and its driver in one place."
            path="/api/vehicles"
            fields={fields}
            defaults={{ kind: 'suv', status: 'ready', insuranceStatus: 'active', year: new Date().getFullYear() }}
            submitLabel="Add a vehicle"
            size="lg"
          />
        }
      />

      {insuranceLapsed.length ? (
        <Notice tone="risk" title={`${insuranceLapsed.length} vehicle${insuranceLapsed.length === 1 ? '' : 's'} without valid cover`}>
          {insuranceLapsed.map((vehicle) => `${vehicle.make} ${vehicle.model}`).join(', ')} — the office will not assign a driver to these until the
          renewal is recorded.
        </Notice>
      ) : null}

      <StatStrip
        items={[
          { label: 'Fleet', value: all.length, detail: `${new Set(all.map((v) => v.make)).size} makes` },
          { label: 'Ready to go', value: all.filter((v) => v.status === 'ready').length, tone: 'ok', detail: `${all.filter((v) => v.status === 'in_service').length} in the workshop` },
          { label: 'Service due', value: dueSoon.length, detail: dueSoon.length ? 'within 30 days or by mileage' : 'nothing imminent', tone: dueSoon.length ? 'attention' : 'default' },
          { label: 'Assigned drivers', value: all.filter((v) => v.assignedDriverId).length, detail: 'people you have named for a car', href: '/people' },
        ]}
      />

      <FilterBar
        resultCount={`${filtered.length} of ${all.length}`}
        filters={[
          { key: 'q', type: 'search', label: 'Search fleet', placeholder: 'Make, model, plate…' },
          { key: 'status', type: 'select', label: 'Status', options: [{ value: 'all', label: 'All' }, ...VEHICLE_STATUS.map((value) => ({ value, label: humanise(value, STATUS_LABEL) }))] },
          { key: 'kind', type: 'select', label: 'Type', options: [{ value: 'all', label: 'All' }, ...VEHICLE_KINDS.map((value) => ({ value, label: humanise(value, STATUS_LABEL) }))] },
        ]}
      />

      <DataTable
        rows={filtered}
        columns={columns}
        empty={
          all.length ? (
            <EmptyState compact title="No vehicle matches those filters" description="Clear the filters to see the whole fleet." icon={<CarFront size={18} strokeWidth={1.3} />} />
          ) : (
            <EmptyState compact title="No vehicles recorded" description="Add a car and the office will watch its service window and its insurance date." icon={<CarFront size={18} strokeWidth={1.3} />} />
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Panel>
          <PanelHeader label="Workshop" title="Service plan" description="Dates the office holds for each vehicle, nearest first." />
          <Divider className="my-5" />
          {all.length ? (
            <KeyValue
              items={all
                .filter((vehicle) => vehicle.nextServiceAt)
                .sort((a, b) => Date.parse(a.nextServiceAt!) - Date.parse(b.nextServiceAt!))
                .slice(0, 6)
                .map((vehicle) => ({
                  label: `${vehicle.make} ${vehicle.model}`,
                  value: (
                    <span className={vehicle.serviceDueSoon ? 'text-gold-200' : undefined}>
                      {formatDate(vehicle.nextServiceAt, 'day', user.timezone)}
                      <span className="ml-2 text-[11px] text-graphite-600">{relativeTime(vehicle.nextServiceAt)}</span>
                    </span>
                  ),
                }))
              }
            />
          ) : (
            <p className="text-[12.5px] leading-relaxed text-graphite-400">Nothing scheduled.</p>
          )}
        </Panel>

        <Panel>
          <PanelHeader label="Drivers" title="Who drives what" description="Availability as the office last heard it." />
          <Divider className="my-5" />
          <KeyValue
            items={STAFF_STATUS.map((value) => ({
              label: humanise(value, STATUS_LABEL),
              value: staff.filter((person) => person.status === value).length,
            }))}
          />
          <p className="mt-5 text-[11.5px] leading-relaxed text-graphite-500">
            A driver is only assigned to a vehicle when the car is insured, serviced and in the same country. The office will not stretch that rule to
            make a plan look tidy.
          </p>
        </Panel>
      </div>
    </div>
  );
}
