import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, Check, CirclePlay } from 'lucide-react';
import { PageHeader, StatStrip, KeyValue, Notice } from '@/components/app/page-chrome';
import { Badge, StatusDot, toneForStatus } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Divider, Panel, PanelHeader, SectionLabel } from '@/components/ui/panel';
import { BarChart } from '@/components/ui/charts';
import { DeleteButton, RecordForm, QuickAction, type FieldSpec } from '@/components/ui/record-form';
import { EmptyState } from '@/components/ui/empty-state';
import { requireUser } from '@/lib/auth/session';
import { getPropertyDossier, listStaff, listTasks } from '@/lib/data/read';
import {
  COUNTRIES,
  PROPERTY_KINDS,
  PROPERTY_STATUS,
  STATUS_LABEL,
  daysUntil,
  formatDate,
  formatMoney,
  label as humanise,
  relativeTime,
} from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const user = await requireUser();
  const dossier = getPropertyDossier(user.id, params.id);
  return { title: dossier ? dossier.property.name : 'Residence' };
}

export default async function PropertyDossierPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const dossier = getPropertyDossier(user.id, params.id);
  if (!dossier) notFound();

  const { property, staff, tasks, expenses, documents, vehicles, history, monthlySpend } = dossier;
  const openTasks = tasks.filter((task) => task.status !== 'done');
  const serviceDays = daysUntil(property.nextServiceAt);
  const spendRatio = property.monthlyOpsCents ? Math.round((property.monthSpendCents / property.monthlyOpsCents) * 100) : null;

  const sharedFields: FieldSpec[] = [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'city', label: 'City', type: 'text', required: true },
    { key: 'country', label: 'Country', type: 'select', required: true, placeholder: 'Select', options: COUNTRIES.map((c) => ({ value: c, label: c })) },
    { key: 'kind', label: 'Type', type: 'select', options: PROPERTY_KINDS.map((k) => ({ value: k, label: humanise(k, STATUS_LABEL) })), required: true },
    { key: 'status', label: 'Status', type: 'select', options: PROPERTY_STATUS.map((s) => ({ value: s, label: humanise(s, STATUS_LABEL) })), required: true },
    { key: 'isPrimary', label: 'Primary residence', type: 'toggle' },
    { key: 'bedrooms', label: 'Bedrooms', type: 'number', min: 0 },
    { key: 'bathrooms', label: 'Bathrooms', type: 'number', min: 0 },
    { key: 'areaSqm', label: 'Interior area (m²)', type: 'number', min: 0 },
    { key: 'staffOnSite', label: 'Staff on site', type: 'number', min: 0 },
    { key: 'monthlyOpsCents', label: 'Monthly operating budget', type: 'money' },
    { key: 'temperatureC', label: 'Interior temperature (°C)', type: 'number', hint: 'Reported by the house system; left blank when nobody has read it.' },
    { key: 'lastMaintenanceAt', label: 'Last maintenance', type: 'date' },
    { key: 'nextServiceAt', label: 'Next service', type: 'date' },
    { key: 'accent', label: 'Ledger tone', type: 'select', options: ['gold', 'ivory', 'graphite', 'sage', 'steel'].map((v) => ({ value: v, label: humanise(v, STATUS_LABEL) })), hint: 'Used only for the thin marker beside this residence in lists.' },
    { key: 'notes', label: 'Standing instructions', type: 'textarea', rows: 5, max: 1200, span: 2 },
  ];

  const initial = {
    name: property.name,
    city: property.city,
    country: property.country,
    kind: property.kind,
    status: property.status,
    isPrimary: property.isPrimary,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    areaSqm: property.areaSqm,
    staffOnSite: property.staffOnSite,
    monthlyOpsCents: property.monthlyOpsCents,
    temperatureC: property.temperatureC,
    lastMaintenanceAt: property.lastMaintenanceAt,
    nextServiceAt: property.nextServiceAt,
    accent: property.accent,
    notes: property.notes,
  };

  const taskFields: FieldSpec[] = [
    { key: 'title', label: 'What needs doing', type: 'text', required: true, span: 2 },
    { key: 'staffId', label: 'Assign to', type: 'select', options: [{ value: '', label: 'Unassigned' }, ...staff.map((person) => ({ value: person.id, label: `${person.firstName} ${person.lastName}` }))] },
    { key: 'dueAt', label: 'By when', type: 'date' },
    { key: 'priority', label: 'Priority', type: 'select', options: ['low', 'normal', 'high', 'critical'].map((v) => ({ value: v, label: humanise(v, STATUS_LABEL) })) },
    { key: 'category', label: 'Category', type: 'select', options: ['maintenance', 'housekeeping', 'security', 'gardener', 'vehicles'].map((v) => ({ value: v, label: humanise(v, STATUS_LABEL) })) },
    { key: 'requiresConfirmation', label: 'Ask before closing', type: 'toggle' },
    { key: 'detail', label: 'Instructions', type: 'textarea', rows: 3, max: 1200, span: 2 },
  ];

  return (
    <div className="space-y-8">
      <Link href="/properties" className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-graphite-400 transition-colors hover:text-ivory-100">
        <ArrowLeft size={12} strokeWidth={1.4} /> All residences
      </Link>

      <PageHeader
        eyebrow={`${humanise(property.kind, STATUS_LABEL)} · ${property.city}, ${property.country}`}
        title={property.name}
        lede={property.notes ?? 'No standing instructions recorded for this residence yet.'}
        meta={
          <>
            <span className="flex items-center gap-2">
              <StatusDot status={property.status} /> {humanise(property.status, STATUS_LABEL)}
            </span>
            <span>Added {relativeTime(property.createdAt)}</span>
            <span>Updated {relativeTime(property.updatedAt)}</span>
          </>
        }
        actions={
          <>
            <RecordForm
              title="Raise a task here"
              eyebrow={property.name}
              description="Anything raised on a residence is visible to the staff assigned to it and appears in the morning briefing."
              path="/api/tasks"
              fields={taskFields}
              defaults={{ propertyId: property.id, priority: 'normal', category: 'maintenance' }}
              submitLabel="Raise a task"
            />
            <RecordForm
              title={`Edit ${property.name}`}
              eyebrow="Property"
              description="Changes are recorded against your account; the office sees them immediately."
              path="/api/properties"
              id={property.id}
              fields={sharedFields}
              initial={initial}
              submitLabel="Edit"
              size="lg"
            />
            <DeleteButton
              path={`/api/properties/${property.id}`}
              label="Remove"
              title={`Remove ${property.name}?`}
              body={
                <>
                  The residence is deleted from your records. Staff, tasks, documents and ledger lines that point at it are kept but unlinked — nothing
                  else is destroyed.
                </>
              }
              variant="ghost"
            />
          </>
        }
      />

      {serviceDays !== null && serviceDays <= 21 ? (
        <Notice tone={serviceDays < 0 ? 'risk' : 'attention'} title={`Scheduled service ${serviceDays < 0 ? `${Math.abs(serviceDays)} days overdue` : `in ${serviceDays} days`}`}>
          {formatDate(property.nextServiceAt, 'long', user.timezone)} — the office has not been told a contractor is booked. Confirm it, or raise the
          task above and the person you name will be asked.
        </Notice>
      ) : null}

      <StatStrip
        items={[
          { label: 'People assigned', value: staff.length, detail: `${staff.filter((p) => p.status === 'on_site').length} on site`, href: '/people' },
          { label: 'Open items', value: openTasks.length, detail: `${openTasks.filter((t) => t.status === 'awaiting_confirmation').length} waiting on you`, tone: openTasks.length ? 'gold' : 'ok' },
          { label: 'This month', value: formatMoney(property.monthSpendCents, { currency: user.currency }), detail: spendRatio === null ? 'no budget set' : `${spendRatio}% of the monthly figure` },
          { label: 'Documents held', value: documents.length, detail: `${documents.filter((d) => d.status === 'expiring' || d.status === 'expired').length} needing renewal`, href: '/documents' },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel>
            <PanelHeader label="Condition" title="The fabric of the house" description="Figures the office has been told, not inferred." />
            <Divider className="my-5" />
            <KeyValue
              items={[
                { label: 'Bedrooms / bathrooms', value: `${property.bedrooms} / ${property.bathrooms}` },
                { label: 'Interior area', value: property.areaSqm ? `${property.areaSqm} m²` : '—' },
                { label: 'Staff on site', value: property.staffOnSite },
                { label: 'Interior temperature', value: property.temperatureC === null ? 'Not reported' : `${property.temperatureC} °C` },
                { label: 'Humidity', value: property.humidityPct === null ? 'Not reported' : `${property.humidityPct} %` },
                { label: 'Last maintenance', value: property.lastMaintenanceAt ? formatDate(property.lastMaintenanceAt, 'long', user.timezone) : 'No record' },
                { label: 'Next service', value: property.nextServiceAt ? formatDate(property.nextServiceAt, 'long', user.timezone) : 'Not scheduled' },
                { label: 'Monthly budget', value: formatMoney(property.monthlyOpsCents, { currency: user.currency }) },
              ]}
            />
          </Panel>

          <Panel>
            <PanelHeader
              label="Items"
              title="Tasks on this residence"
              actions={<span className="text-[10.5px] uppercase tracking-[0.18em] text-graphite-500">{tasks.length} total</span>}
            />
            <Divider className="my-5" />
            {tasks.length ? (
              <ul>
                {tasks.map((task) => (
                  <li key={task.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ivory-200/[0.05] py-3 last:border-b-0">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] text-ivory-50">{task.title}</span>
                      <span className="mt-1 block text-[11.5px] text-graphite-500">
                        {humanise(task.category, STATUS_LABEL)}
                        {task.dueAt ? ` · due ${formatDate(task.dueAt, 'day', user.timezone)}` : ''}
                        {task.completedAt ? ` · closed ${relativeTime(task.completedAt)}` : ''}
                      </span>
                    </span>
                    <Badge tone={toneForStatus(task.status)}>{humanise(task.status, STATUS_LABEL)}</Badge>
                    <span className="relative z-10 flex items-center gap-1.5">
                      {task.status === 'awaiting_confirmation' ? (
                        <QuickAction path={`/api/tasks/${task.id}`} method="PATCH" body={{ status: 'in_progress' }} label="Start" icon={<CirclePlay size={13} strokeWidth={1.4} />} successMessage="Started." />
                      ) : null}
                      {task.status !== 'done' ? (
                        <QuickAction path={`/api/tasks/${task.id}`} method="PATCH" body={{ status: 'done' }} label="Done" icon={<Check size={13} strokeWidth={1.5} />} successMessage="Closed on the record." />
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="Nothing open on this residence" description="Raise a task and it will appear here and with the person you assign." />
            )}
          </Panel>

          <Panel>
            <PanelHeader label="Ledger" title="Recorded spend by month" description="The last six months booked against this residence." />
            <Divider className="my-5" />
            {monthlySpend.length ? (
              <BarChart
                height={170}
                data={monthlySpend.map((entry) => ({ label: entry.month.slice(5), value: entry.cents / 100, hint: formatDate(`${entry.month}-01`, 'month', user.timezone) }))}
                format={(value) => formatMoney(Math.round(value * 100), { currency: user.currency, compact: true })}
              />
            ) : (
              <p className="text-[13px] leading-relaxed text-graphite-400">Nothing has been booked to this residence yet.</p>
            )}
            <div className="mt-6">
              <SectionLabel>The five largest entries</SectionLabel>
              <ul className="mt-3 space-y-2">
                {expenses.slice(0, 5).map((expense) => (
                  <li key={expense.id} className="flex items-baseline justify-between gap-4 border-b border-ivory-200/[0.05] pb-2 text-[12.5px] last:border-b-0">
                    <span className="min-w-0 truncate text-graphite-200">
                      {expense.description}
                      {expense.vendor ? <span className="text-graphite-600"> · {expense.vendor}</span> : null}
                    </span>
                    <span className="shrink-0 tabular-nums text-ivory-100">{formatMoney(expense.amountCents, { currency: user.currency })}</span>
                  </li>
                ))}
                {!expenses.length ? <li className="text-[12.5px] text-graphite-600">No entries.</li> : null}
              </ul>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <PanelHeader label="Household" title="Who looks after it" actions={<Link href="/people" className="link-lux text-[10.5px] uppercase tracking-[0.18em] text-graphite-400 hover:text-ivory-100">Directory →</Link>} />
            <Divider className="my-5" />
            {staff.length ? (
              <ul className="space-y-3">
                {staff.map((person) => (
                  <li key={person.id} className="flex items-baseline justify-between gap-4">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] text-ivory-50">
                        {person.firstName} {person.lastName}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] text-graphite-500">
                        {humanise(person.role, STATUS_LABEL)}
                        {person.yearsHouse ? ` · ${person.yearsHouse} yr${person.yearsHouse === 1 ? '' : 's'}` : ''}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-[11px] text-graphite-400">
                      <StatusDot status={person.status} />
                      {humanise(person.status, STATUS_LABEL)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="No one assigned" description="Assign staff from the directory so tasks reach a person rather than a queue." />
            )}
          </Panel>

          <Panel>
            <PanelHeader label="Papers" title="Documents on file" actions={<Link href="/documents" className="link-lux text-[10.5px] uppercase tracking-[0.18em] text-graphite-400 hover:text-ivory-100">Library →</Link>} />
            <Divider className="my-5" />
            {documents.length ? (
              <ul className="space-y-2.5">
                {documents.slice(0, 6).map((document) => (
                  <li key={document.id} className="flex items-baseline justify-between gap-4 text-[12.5px]">
                    <span className="min-w-0 truncate text-graphite-200">{document.name}</span>
                    <span className="flex shrink-0 items-center gap-2 text-[11px] text-graphite-500">
                      {document.expiresAt ? formatDate(document.expiresAt, 'short', user.timezone) : 'no expiry'}
                      <Badge tone={toneForStatus(document.status)}>{humanise(document.status, STATUS_LABEL)}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-graphite-400">No documents are attached to this residence. Contracts, insurance and inventories belong here.</p>
            )}
          </Panel>

          <Panel>
            <PanelHeader label="Fleet" title="Vehicles kept here" />
            <Divider className="my-5" />
            {vehicles.length ? (
              <ul className="space-y-3">
                {vehicles.map((vehicle) => (
                  <li key={vehicle.id} className="flex items-baseline justify-between gap-4">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] text-ivory-50">
                        {vehicle.make} {vehicle.model}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] text-graphite-500">
                        {vehicle.year} · {vehicle.mileageKm.toLocaleString('en-GB')} km
                      </span>
                    </span>
                    <Badge tone={toneForStatus(vehicle.status)}>{humanise(vehicle.status, STATUS_LABEL)}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-graphite-400">No vehicle is kept at this residence.</p>
            )}
            <Button asLink href="/vehicles" variant="secondary" size="sm" className="mt-5 w-full">
              Open the fleet
            </Button>
          </Panel>

          <Panel>
            <PanelHeader label="History" title="What the office recorded" description="Every entry states which record it came from." />
            <Divider className="my-5" />
            {history.length ? (
              <ol className="space-y-4">
                {history.slice(0, 12).map((entry, index) => (
                  <li key={`${entry.label}-${index}`} className="relative pl-6">
                    <span className={entry.tone === 'attention' ? 'absolute left-0 top-[6px] h-[7px] w-[7px] rounded-full bg-gold-400' : 'absolute left-0 top-[6px] h-[7px] w-[7px] rounded-full border border-graphite-500'} />
                    <span className="absolute bottom-2 left-[3px] top-4 w-px bg-ivory-200/[0.08] last:hidden" aria-hidden />
                    <p className="text-[12.5px] text-ivory-100">{entry.label}</p>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-graphite-500">
                      {entry.detail ?? 'No further detail recorded.'}
                      {entry.at ? ` · ${formatDate(entry.at, 'short', user.timezone)}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-graphite-400">Nothing has been recorded against this residence yet.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
