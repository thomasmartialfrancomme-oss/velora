import type { Metadata } from 'next';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { PageHeader, StatStrip } from '@/components/app/page-chrome';
import { DataTable, TitleCell, type Column } from '@/components/app/data-table';
import { FilterBar } from '@/components/app/filter-bar';
import { Badge, StatusDot, toneForStatus } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteButton, RecordForm, QuickAction, type FieldSpec } from '@/components/ui/record-form';
import { requireUser } from '@/lib/auth/session';
import { listProperties, listStaff, listTasks } from '@/lib/data/read';
import { STAFF_ROLES, STAFF_STATUS, STATUS_LABEL, label as humanise, relativeTime, truncate } from '@/lib/utils/format';
import type { StaffWithProperty } from '@/lib/data/read';
import { getT } from '@/lib/i18n/server';

export const metadata: Metadata = { title: 'People' };
export const dynamic = 'force-dynamic';

type Row = StaffWithProperty;

export default async function PeoplePage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const T = getT();
  const user = await requireUser();
  const q = typeof searchParams?.q === 'string' ? searchParams.q : '';
  const role = typeof searchParams?.role === 'string' ? searchParams.role : 'all';
  const status = typeof searchParams?.status === 'string' ? searchParams.status : 'all';
  const propertyId = typeof searchParams?.propertyId === 'string' ? searchParams.propertyId : 'all';

  const staff = listStaff(user.id, { role, status, propertyId });
  const properties = listProperties(user.id);
  const tasks = listTasks(user.id, { limit: 400 });
  const filtered = staff.filter((person) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    return [person.firstName, person.lastName, person.role, person.nextTask ?? '', person.lastActivity ?? '', person.email ?? ''].some((value) => value.toLowerCase().includes(needle));
  });

  const fields: FieldSpec[] = [
    { key: 'firstName', label: 'First name', type: 'text', required: true },
    { key: 'lastName', label: 'Last name', type: 'text', required: true },
    { key: 'role', label: 'Role', type: 'select', required: true, placeholder: 'Select', options: STAFF_ROLES.map((value) => ({ value, label: humanise(value, STATUS_LABEL) })) },
    { key: 'status', label: 'Availability', type: 'select', options: STAFF_STATUS.map((value) => ({ value, label: humanise(value, STATUS_LABEL) })), required: true },
    {
      key: 'propertyId',
      label: 'Based at',
      type: 'select',
      options: [{ value: '', label: 'Floating / not assigned' }, ...properties.map((property) => ({ value: property.id, label: property.name }))],
    },
    { key: 'employment', label: 'Engagement', type: 'select', options: ['full_time', 'part_time', 'daily', 'agency', 'on_call'].map((value) => ({ value, label: humanise(value, STATUS_LABEL) })) },
    { key: 'email', label: 'Email', type: 'text', hint: 'Used by the office to send a task, nothing else.' },
    { key: 'phone', label: 'Phone' },
    { key: 'languages', label: 'Languages', type: 'tags', hint: 'Comma separated — useful when assigning a driver to a guest.' },
    { key: 'yearsHouse', label: 'Years in the house', type: 'number', min: 0 },
    { key: 'nextTask', label: 'Next task on their plate', type: 'text', span: 2 },
    { key: 'lastActivity', label: 'Last thing the office heard', type: 'text', span: 2 },
    { key: 'notes', label: 'Notes', type: 'textarea', rows: 3, max: 800, span: 2, hint: 'Standards, preferences, things never to ask them to do.' },
  ];

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Person',
      width: '26%',
      cell: (row) => (
        <TitleCell
          title={
            <span className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-ivory-200/12 text-[9.5px] text-gold-200">
                {row.firstName.slice(0, 1)}
                {row.lastName.slice(0, 1)}
              </span>
              <span className="text-ivory-50">
                {row.firstName} {row.lastName}
              </span>
            </span>
          }
          detail={[humanise(row.employment, STATUS_LABEL), row.yearsHouse ? `${row.yearsHouse} yr${row.yearsHouse === 1 ? '' : 's'} in the house` : null, row.languages.length ? row.languages.join(', ') : null]
            .filter(Boolean)
            .join(' · ')}
        />
      ),
    },
    { key: 'role', header: 'Role', cell: (row) => <span className="text-graphite-200">{humanise(row.role, STATUS_LABEL)}</span> },
    {
      key: 'status',
      header: 'Availability',
      cell: (row) => (
        <span className="inline-flex items-center gap-2">
          <StatusDot status={row.status} />
          <Badge tone={toneForStatus(row.status)}>{humanise(row.status, STATUS_LABEL)}</Badge>
        </span>
      ),
    },
    { key: 'base', header: 'Based at', hideBelow: 'md', cell: (row) => (row.propertyName ? <Link href={`/properties/${row.propertyId}`} className="link-lux text-graphite-200 hover:text-ivory-50">{row.propertyName}</Link> : <span className="text-graphite-600">{T("Floating")}</span>) },
    { key: 'open', header: 'Open', align: 'right', hideBelow: 'lg', cell: (row) => <span className={row.openTaskCount ? 'text-gold-200' : 'text-graphite-600'}>{row.openTaskCount || '—'}</span> },
    {
      key: 'next',
      header: 'Next task',
      hideBelow: 'xl',
      cell: (row) =>
        row.nextTask ? (
          <span className="block max-w-[240px] truncate text-graphite-300" title={row.nextTask}>
            {truncate(row.nextTask, 52)}
          </span>
        ) : (
          <span className="text-graphite-600">{T("Nothing assigned")}</span>
        ),
    },
    {
      key: 'activity',
      header: 'Last heard',
      hideBelow: 'lg',
      cell: (row) => (row.lastActivityAt ? <span className="text-graphite-400">{relativeTime(row.lastActivityAt)}</span> : <span className="text-graphite-600">—</span>),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '12rem',
      cell: (row) => (
        <span className="relative z-10 inline-flex items-center justify-end gap-1.5">
          {row.status !== 'on_site' ? (
            <QuickAction path={`/api/people/${row.id}`} method="PATCH" body={{ status: 'on_site' }} label="On site" successMessage={`${row.firstName} is marked on site.`} />
          ) : (
            <QuickAction path={`/api/people/${row.id}`} method="PATCH" body={{ status: 'off_duty' }} label="Off duty" successMessage={`${row.firstName} is marked off duty.`} />
          )}
          <RecordForm
            title={`Edit ${row.firstName} ${row.lastName}`}
            eyebrow="Directory"
            path="/api/people"
            id={row.id}
            fields={fields}
            initial={{
              firstName: row.firstName,
              lastName: row.lastName,
              role: row.role,
              status: row.status,
              propertyId: row.propertyId ?? '',
              employment: row.employment,
              email: row.email,
              phone: row.phone,
              languages: row.languages,
              yearsHouse: row.yearsHouse,
              nextTask: row.nextTask,
              lastActivity: row.lastActivity,
              notes: row.notes,
            }}
            trigger={
              <span className="cursor-pointer px-1 text-[10.5px] uppercase tracking-[0.18em] text-graphite-400 transition-colors hover:text-gold-200">{T("Edit")}</span>
            }
          />
          <DeleteButton
            path={`/api/people/${row.id}`}
            label="Remove"
            title={`Remove ${row.firstName} ${row.lastName} from the directory?`}
            body="Their tasks stay in the ledger but become unassigned. If they are merely away, mark them on leave instead."
          />
        </span>
      ),
    },
  ];

  const counts = {
    total: staff.length,
    onSite: staff.filter((person) => person.status === 'on_site').length,
    unreachable: staff.filter((person) => person.status === 'unreachable').length,
    assigned: tasks.filter((task) => task.staffId && task.status !== 'done').length,
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Module 02 · People"
        title="The household directory"
        lede="Everyone who works for you, where they are, what they owe next. Availability is what the office last heard — not a guess."
        meta={
          <>
            <span>{counts.total} people</span>
            <span>{counts.onSite} on site</span>
            <span>{counts.assigned} tasks assigned</span>
          </>
        }
        actions={
          <>
            <Button asLink href="/properties" variant="ghost" size="md">{T("By residence")}</Button>
            <RecordForm
              title="Add a person"
              eyebrow="Directory"
              description="A person can be assigned tasks, put on a vehicle, and named in a travel plan. Contracts and right-to-work paperwork belong in Documents."
              path="/api/people"
              fields={fields}
              defaults={{ role: 'housekeeper', status: 'available', employment: 'full_time' }}
              submitLabel="Add a person"
              size="lg"
            />
          </>
        }
      />

      <StatStrip
        items={[
          { label: 'In the directory', value: counts.total, detail: `${properties.length} residences to place them in`, href: '/properties' },
          { label: 'On site now', value: counts.onSite, tone: 'ok', detail: staff.filter((p) => p.status === 'on_leave').length ? `${staff.filter((p) => p.status === 'on_leave').length} on leave` : 'no one on leave' },
          { label: 'Unreachable', value: counts.unreachable, detail: counts.unreachable ? 'the office will route their tasks elsewhere' : 'everyone is contactable', tone: counts.unreachable ? 'attention' : 'default' },
          { label: 'Awaiting a person', value: tasks.filter((task) => !task.staffId && task.status !== 'done').length, detail: 'open tasks with nobody assigned', href: '/dashboard#open-items' },
        ]}
      />

      <FilterBar
        resultCount={`${filtered.length} of ${counts.total}`}
        filters={[
          { key: 'q', type: 'search', label: 'Search people', placeholder: 'Name, role, task…' },
          { key: 'role', type: 'select', label: 'Role', options: [{ value: 'all', label: 'All' }, ...STAFF_ROLES.map((value) => ({ value, label: humanise(value, STATUS_LABEL) }))] },
          { key: 'status', type: 'select', label: 'Availability', options: [{ value: 'all', label: 'All' }, ...STAFF_STATUS.map((value) => ({ value, label: humanise(value, STATUS_LABEL) }))] },
          { key: 'propertyId', type: 'select', label: 'Based at', options: [{ value: 'all', label: 'All' }, ...properties.map((property) => ({ value: property.id, label: property.name }))] },
        ]}
      />

      <DataTable
        rows={filtered}
        columns={columns}
        empty={
          counts.total ? (
            <EmptyState compact title="Nobody matches those filters" description="Try another role or residence — the directory is searched by name, task and email too." icon={<Users size={18} strokeWidth={1.3} />} />
          ) : (
            <EmptyState
              compact
              title="The directory is empty"
              description="Add the people who work for you. The office uses this to route tasks and to know who to call when a residence reports a problem."
              icon={<Users size={18} strokeWidth={1.3} />}
            />
          )
        }
      />

      <p className="text-[11.5px] leading-relaxed text-graphite-600">{T("“Last heard” is the timestamp the office recorded on the most recent activity for that person. It is never inferred from their tasks.")}</p>
    </div>
  );
}
