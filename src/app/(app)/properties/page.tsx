import Link from 'next/link';
import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';
import { PageHeader, StatStrip } from '@/components/app/page-chrome';
import { DataTable, TitleCell, type Column } from '@/components/app/data-table';
import { FilterBar } from '@/components/app/filter-bar';
import { Button } from '@/components/ui/button';
import { Badge, StatusDot, toneForStatus } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { RecordForm, type FieldSpec } from '@/components/ui/record-form';
import { requireUser } from '@/lib/auth/session';
import { listProperties, listStaff, listTasks } from '@/lib/data/read';
import type { PropertyRow } from '@/lib/data/tables';
import { COUNTRIES, PROPERTY_KINDS, PROPERTY_STATUS, daysUntil, formatMoney, formatDate, label as humanise, STATUS_LABEL, truncate } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Properties' };
export const dynamic = 'force-dynamic';

type Row = PropertyRow & { openTasks: number; staffCount: number; monthSpendCents: number; nextServiceDays: number | null };

const KIND_OPTIONS = PROPERTY_KINDS.map((kind) => ({ value: kind, label: humanise(kind, STATUS_LABEL) }));

function fieldsFor(properties: { id: string; name: string }[]): FieldSpec[] {
  return [
    { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Villa Azure' },
    { key: 'city', label: 'City', type: 'text', required: true, placeholder: 'Cap Ferrat' },
    { key: 'country', label: 'Country', type: 'select', required: true, placeholder: 'Select', options: COUNTRIES.map((c) => ({ value: c, label: c })) },
    { key: 'kind', label: 'Type', type: 'select', options: KIND_OPTIONS, required: true },
    { key: 'status', label: 'Status', type: 'select', options: PROPERTY_STATUS.map((s) => ({ value: s, label: humanise(s, STATUS_LABEL) })), required: true },
    { key: 'isPrimary', label: 'Primary residence', type: 'toggle', hint: 'Shown first in briefings and used as the default arrival target.' },
    { key: 'bedrooms', label: 'Bedrooms', type: 'number', min: 0, hint: 'Guest bedrooms, not staff quarters.' },
    { key: 'bathrooms', label: 'Bathrooms', type: 'number', min: 0 },
    { key: 'areaSqm', label: 'Interior area (m²)', type: 'number', min: 0 },
    { key: 'monthlyOpsCents', label: 'Monthly operating budget', type: 'money', hint: 'Recorded spend is measured against this figure.' },
    { key: 'nextServiceAt', label: 'Next scheduled service', type: 'date' },
    { key: 'notes', label: 'Standing instructions', type: 'textarea', rows: 4, max: 1200, span: 2, placeholder: 'No deliveries before 09:00. Gate code changes on the first of the month.' },
    { key: 'propertyIdStatic', label: 'Linked records', type: 'static', value: properties.length ? `${properties.length} residence(s) already in your records` : 'No residences yet' },
  ];
}

export default async function PropertiesPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const user = await requireUser();
  const q = typeof searchParams?.q === 'string' ? searchParams.q : '';
  const status = typeof searchParams?.status === 'string' ? searchParams.status : 'all';
  const kind = typeof searchParams?.kind === 'string' ? searchParams.kind : 'all';

  const all = listProperties(user.id, { includeArchived: false });
  const staff = listStaff(user.id);
  const tasks = listTasks(user.id, { limit: 400 });

  const filtered = all
    .map<Row>((property) => ({
      ...property,
      openTasks: tasks.filter((task) => task.propertyId === property.id && task.status !== 'done').length,
      staffCount: staff.filter((person) => person.propertyId === property.id).length,
      nextServiceDays: daysUntil(property.nextServiceAt),
    }))
    .filter((property) => {
      if (status !== 'all' && property.status !== status) return false;
      if (kind !== 'all' && property.kind !== kind) return false;
      if (!q) return true;
      const needle = q.toLowerCase();
      return [property.name, property.city, property.country, property.notes ?? ''].some((value) => value.toLowerCase().includes(needle));
    });

  const budget = all.reduce((sum, property) => sum + property.monthlyOpsCents, 0);
  const spend = all.reduce((sum, property) => sum + property.monthSpendCents, 0);
  const attention = all.filter((property) => property.status !== 'operational').length;

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Residence',
      width: '30%',
      cell: (row) => (
        <TitleCell
          title={
            <span className="flex items-center gap-2.5">
              <StatusDot status={row.status} />
              <span className={row.isPrimary ? 'text-ivory-50' : 'text-ivory-100'}>{row.name}</span>
              {row.isPrimary ? <Badge tone="gold">Primary</Badge> : null}
            </span>
          }
          detail={`${row.city} · ${row.country} · ${humanise(row.kind, STATUS_LABEL)}`}
        />
      ),
    },
    { key: 'status', header: 'Condition', cell: (row) => <Badge tone={toneForStatus(row.status)}>{humanise(row.status, STATUS_LABEL)}</Badge> },
    { key: 'staff', header: 'People', align: 'right', hideBelow: 'md', cell: (row) => <span>{row.staffCount}</span> },
    { key: 'tasks', header: 'Open', align: 'right', cell: (row) => (row.openTasks ? <span className={row.openTasks > 2 ? 'text-gold-200' : 'text-graphite-200'}>{row.openTasks}</span> : <span className="text-graphite-600">—</span>) },
    {
      key: 'service',
      header: 'Next service',
      hideBelow: 'lg',
      cell: (row) =>
        row.nextServiceAt ? (
          <span className={row.nextServiceDays !== null && row.nextServiceDays <= 14 ? 'text-gold-200' : 'text-graphite-300'}>
            {formatDate(row.nextServiceAt, 'day', user.timezone)}
            {row.nextServiceDays !== null ? <span className="ml-2 text-[11px] text-graphite-600">{row.nextServiceDays < 0 ? `${Math.abs(row.nextServiceDays)}d overdue` : `in ${row.nextServiceDays}d`}</span> : null}
          </span>
        ) : (
          <span className="text-graphite-600">Not scheduled</span>
        ),
    },
    {
      key: 'spend',
      header: 'This month',
      align: 'right',
      cell: (row) => (
        <span className="text-ivory-100">
          {formatMoney(row.monthSpendCents, { currency: user.currency })}
          {row.monthlyOpsCents ? <span className="ml-2 text-[11px] text-graphite-600">/ {formatMoney(row.monthlyOpsCents, { currency: user.currency, compact: true })}</span> : null}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '6rem',
      cell: (row) => (
        <span className="relative z-10 inline-flex items-center gap-1.5">
          <Link href={`/properties/${row.id}`} className="text-[10.5px] uppercase tracking-[0.18em] text-gold-200 transition-colors hover:text-gold-100">
            Dossier →
          </Link>
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Module 01 · Property"
        title="Residences"
        lede="Every residence you keep, its condition, its people and what it has cost this month. The ledger, not a brochure."
        meta={
          <>
            <span>{all.length} in your records</span>
            <span>{truncate(all.map((p) => p.city).join(' · '), 60)}</span>
          </>
        }
        actions={
          <>
            <Button asLink href="/finance" variant="ghost" size="md">
              Expenditure
            </Button>
            <RecordForm
              title="Add residence"
              eyebrow="Property"
              description="A residence is the anchor for staff, tasks, documents and spend. Add the building now; the office will load contracts and inventories afterwards."
              path="/api/properties"
              fields={fieldsFor(all)}
              defaults={{ kind: 'residence', status: 'operational', bedrooms: 0, bathrooms: 0, areaSqm: 0 }}
              submitLabel="Add residence"
              size="lg"
            />
          </>
        }
      />

      <StatStrip
        items={[
          { label: 'Residences', value: all.length, detail: all.find((p) => p.isPrimary)?.name ?? 'none marked primary' },
          { label: 'Needing attention', value: attention, detail: attention ? 'status set to attention or maintenance' : 'all operational', tone: attention ? 'gold' : 'ok' },
          { label: 'People assigned', value: staff.length, detail: `${staff.filter((p) => p.status === 'on_site').length} on site now`, href: '/people' },
          { label: 'Recorded this month', value: formatMoney(spend, { currency: user.currency }), detail: `against a budget of ${formatMoney(budget, { currency: user.currency })}`, href: '/finance' },
        ]}
      />

      <FilterBar
        resultCount={`${filtered.length} of ${all.length}`}
        filters={[
          { key: 'q', type: 'search', label: 'Search residences', placeholder: 'Name, city, note…' },
          { key: 'status', type: 'select', label: 'Condition', options: [{ value: 'all', label: 'All' }, ...PROPERTY_STATUS.map((s) => ({ value: s, label: humanise(s, STATUS_LABEL) }))] },
          { key: 'kind', type: 'select', label: 'Type', options: [{ value: 'all', label: 'All' }, ...KIND_OPTIONS] },
        ]}
      />

      <DataTable
        rows={filtered}
        columns={columns}
        hrefFor={(row) => `/properties/${row.id}`}
        empty={
          all.length ? (
            <EmptyState compact title="No residence matches those filters" description="Clear the filters, or search a different name or city." icon={<Building2 size={18} strokeWidth={1.3} />} />
          ) : (
            <EmptyState
              compact
              title="Your first residence"
              description="Add a residence and the office will start a record set around it: staff to assign, documents to collect, a budget to measure against."
              icon={<Building2 size={18} strokeWidth={1.3} />}
            />
          )
        }
      />

      <p className="text-[11.5px] leading-relaxed text-graphite-600">
        Spend is what has been recorded in Finance for that residence — nothing is estimated. A budget figure is your own instruction to the office, not
        a forecast.
      </p>
    </div>
  );
}
