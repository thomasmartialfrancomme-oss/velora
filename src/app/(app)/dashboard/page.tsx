import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowUpRight, Check, CirclePlay, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, toneForStatus } from '@/components/ui/badge';
import { Panel, PanelHeader, LedgerRow, Divider, SectionLabel } from '@/components/ui/panel';
import { EmptyState } from '@/components/ui/empty-state';
import { RecordForm, QuickAction, type FieldSpec } from '@/components/ui/record-form';
import { KeyValue, Notice, PageHeader, StatStrip } from '@/components/app/page-chrome';
import { getDashboardData } from '@/lib/data/analytics';
import { listProperties, listStaff, listTasks, getMembership, pendingAiActions } from '@/lib/data/read';
import { requireUser } from '@/lib/auth/session';
import { formatMoney, formatDate, formatTime, relativeTime, label as humanise, STATUS_LABEL, greetingFor, STAFF_STATUS } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

function hourIn(timeZone: string): number {
  const value = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone }).format(new Date());
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : new Date().getHours();
}

export default async function DashboardPage() {
  const user = await requireUser();
  const data = getDashboardData(user);
  const properties = listProperties(user.id);
  const staff = listStaff(user.id);
  const awaiting = listTasks(user.id, { status: 'awaiting_confirmation', limit: 5 });
  const aiPending = pendingAiActions(user.id);
  const membership = getMembership(user.id);

  const greeting = `${greetingFor(hourIn(user.timezone))}, ${data.firstName}.`;
  const dayLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const spendDelta = data.previousSpendCents > 0 ? Math.round(((data.monthSpendCents - data.previousSpendCents) / data.previousSpendCents) * 100) : null;

  const taskFields: FieldSpec[] = [
    { key: 'title', label: 'What needs doing', type: 'text', required: true, span: 2, placeholder: 'Roof terrace drain to be cleared before the rain on Friday' },
    {
      key: 'propertyId',
      label: 'Residence',
      type: 'select',
      options: [{ value: '', label: 'No residence' }, ...properties.map((property) => ({ value: property.id, label: property.name }))],
    },
    {
      key: 'staffId',
      label: 'Assign to',
      type: 'select',
      options: [{ value: '', label: 'Unassigned' }, ...staff.map((person) => ({ value: person.id, label: `${person.firstName} ${person.lastName}` }))],
    },
    { key: 'dueAt', label: 'By when', type: 'date' },
    {
      key: 'priority',
      label: 'Priority',
      type: 'select',
      options: ['low', 'normal', 'high', 'critical'].map((value) => ({ value, label: humanise(value, STATUS_LABEL) })),
    },
    {
      key: 'category',
      label: 'Category',
      type: 'select',
      options: ['maintenance', 'housekeeping', 'travel', 'security', 'lifestyle', 'finance', 'staff', 'vehicles'].map((value) => ({ value, label: humanise(value, STATUS_LABEL) })),
    },
    { key: 'requiresConfirmation', label: 'Ask before closing', type: 'toggle', hint: 'The office will wait for your word rather than marking this done.' },
    { key: 'detail', label: 'Notes for the office', type: 'textarea', rows: 3, max: 1200, span: 2 },
  ];

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={dayLabel}
        title={greeting}
        lede="Nothing here is a demo of a workflow — each row is your own record, and each action writes to it."
        meta={
          <>
            <span>
              Briefing at <span className="text-graphite-300">{user.briefingTime}</span>
            </span>
            <span>{user.timezone}</span>
            <Link href="/membership" className="text-gold-200 transition-colors hover:text-gold-100">
              {humanise(membership.subscription?.status === 'active' ? 'membership active' : 'membership', STATUS_LABEL)} →
            </Link>
          </>
        }
        actions={
          <>
            <Button asLink href="/ai" variant="gold-outline" size="md" icon={<Sparkles size={13} strokeWidth={1.4} />}>
              Ask VELORA AI
            </Button>
            <RecordForm
              title="New task"
              eyebrow="Your office"
              description="Raising a task puts it in front of the person you name, and into tomorrow's briefing if it is not closed."
              path="/api/tasks"
              fields={taskFields}
              defaults={{ priority: 'normal', category: 'maintenance' }}
              submitLabel="New task"
            />
          </>
        }
      />

      {awaiting.length || aiPending.length ? (
        <Notice
          tone="attention"
          title={`${awaiting.length + aiPending.length} ${awaiting.length + aiPending.length === 1 ? 'item is' : 'items are'} waiting on you`}
          action={
            <>
              {awaiting.length ? (
                <Button asLink href="/dashboard#open-items" variant="secondary" size="sm">
                  Review tasks
                </Button>
              ) : null}
              {aiPending.length ? (
                <Button asLink href="/ai" variant="secondary" size="sm">
                  Review proposed actions
                </Button>
              ) : null}
            </>
          }
        >
          The office has prepared what it can and deliberately stopped. Nothing below is marked complete until you say so.
        </Notice>
      ) : null}

      <StatStrip
        items={[
          { label: 'Residences', value: data.counts.residences, detail: data.residences.slice(0, 2).map((p) => p.name).join(' · ') || 'none yet', href: '/properties' },
          { label: 'People on site', value: data.staffOnSite.length, detail: `${data.counts.people} in the directory`, href: '/people' },
          { label: 'Open items', value: data.counts.openTasks, detail: `${data.counts.pendingActions} awaiting confirmation`, href: '#open-items', tone: data.counts.pendingActions ? 'gold' : 'default' },
          {
            label: data.monthLabel,
            value: formatMoney(data.monthSpendCents, { currency: user.currency }),
            detail: spendDelta === null ? 'no comparison yet' : `${spendDelta >= 0 ? '+' : ''}${spendDelta}% against ${formatMoney(data.previousSpendCents, { currency: user.currency })} last month`,
            href: '/finance',
          },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <Panel>
            <PanelHeader label="Today" title="Your day, in order" description={`${data.today.length} items the office considers worth your attention.`} actions={<Link href="/briefing" className="link-lux text-[11px] uppercase tracking-[0.2em] text-graphite-300 transition-colors hover:text-ivory-100">Full briefing →</Link>} />
            <Divider className="my-5" />
            {data.today.length ? (
              <ul>
                {data.today.map((item) => (
                  <li key={item.key}>
                    <Link href={item.href} className="group -mx-2 flex items-baseline justify-between gap-6 rounded-[3px] px-2 py-3 transition-colors duration-300 hover:bg-ivory-100/[0.03]">
                      <span className="min-w-0">
                        <span className="flex items-center gap-2.5">
                          <span className={item.tone === 'gold' ? 'h-1 w-1 rounded-full bg-gold-400' : item.tone === 'attention' ? 'h-1 w-1 rounded-full bg-state-warn' : 'h-1 w-1 rounded-full bg-graphite-500'} />
                          <span className="text-[13.5px] text-ivory-50">{item.label}</span>
                        </span>
                        {item.detail ? <span className="mt-1 block pl-[14px] text-[12px] leading-relaxed text-graphite-500">{item.detail}</span> : null}
                      </span>
                      <span className="flex shrink-0 items-center gap-2.5">
                        <span className="text-[12.5px] tabular-nums text-graphite-200">{item.value}</span>
                        <ArrowUpRight size={13} className="text-graphite-600 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" strokeWidth={1.4} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="Nothing is scheduled today" description="A quiet day is a good day. Anything you raise will appear here." />
            )}
          </Panel>

          <Panel>
            <PanelHeader
              label="Open items"
              title="What is in motion"
              description="Your own tasks, ordered so that anything waiting on you or past its date comes first."
              actions={<span className="text-[10.5px] uppercase tracking-[0.18em] text-graphite-500">{data.tasks.length} shown</span>}
            />
            <Divider className="my-5" />
            {data.tasks.length ? (
              <ul className="-my-1">
                {data.tasks.map((task) => (
                  <li key={task.id} id={task.status === 'awaiting_confirmation' ? 'open-items' : undefined} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ivory-200/[0.05] py-3 last:border-b-0">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] text-ivory-50">{task.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-graphite-500">
                        {task.propertyName ? <span>{task.propertyName}</span> : <span>No residence</span>}
                        {task.staffName ? <span>· {task.staffName}</span> : null}
                        {task.dueAt ? <span>· {task.status === 'done' ? 'closed' : 'due'} {formatDate(task.dueAt, 'day')}</span> : null}
                      </span>
                    </span>
                    <Badge tone={toneForStatus(task.status)}>{humanise(task.status, STATUS_LABEL)}</Badge>
                    <span className="relative z-10 flex items-center gap-1.5">
                      {task.status === 'awaiting_confirmation' ? (
                        <QuickAction
                          path={`/api/tasks/${task.id}`}
                          method="PATCH"
                          body={{ status: 'in_progress' }}
                          label="Start"
                          icon={<CirclePlay size={13} strokeWidth={1.4} />}
                          successMessage="The office is on it."
                        />
                      ) : null}
                      {task.status !== 'done' ? (
                        <QuickAction
                          path={`/api/tasks/${task.id}`}
                          method="PATCH"
                          body={{ status: 'done' }}
                          label="Done"
                          icon={<Check size={13} strokeWidth={1.5} />}
                          successMessage="Closed. Noted in the record."
                          confirm={{
                            title: 'Mark this as done?',
                            body: 'The office records who closed it and when. If a contractor still has to attend, leave it open.',
                            confirmLabel: 'Close the item',
                          }}
                        />
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="Nothing open" description="Every task you or the office raised is closed. Use “New task” to start the next one." />
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <PanelHeader label="Needs your decision" title="Where the office stopped" description="Each item states the records it came from, so you can check the reasoning rather than trust it." />
            <Divider className="my-5" />
            {data.insights.length ? (
              <ul className="space-y-4">
                {data.insights.slice(0, 4).map((insight) => (
                  <li key={insight.id} className="rounded-[4px] border border-ivory-200/[0.07] bg-ink-950/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[13px] leading-snug text-ivory-50">{insight.title}</p>
                      <span
                        className={
                          insight.severity === 'critical'
                            ? 'mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-state-risk'
                            : insight.severity === 'attention'
                              ? 'mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400'
                              : 'mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-graphite-500'
                        }
                      />
                    </div>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-graphite-400">{insight.detail}</p>
                    {insight.evidence.length ? (
                      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                        {insight.evidence.map((item) => (
                          <li key={item.label} className="text-[11px] text-graphite-500">
                            <span className="text-graphite-600">{item.label}</span> <span className="text-graphite-200">{item.value}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <Link href={insight.actionHref} className="mt-3.5 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-gold-200 transition-colors hover:text-gold-100">
                      {insight.actionLabel} <ArrowUpRight size={12} strokeWidth={1.4} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="No decisions pending" description="Nothing in your records currently contradicts itself or needs your word." />
            )}
          </Panel>

          <Panel>
            <PanelHeader label="Next arrival" title={data.nextTrip ? data.nextTrip.title : 'Nothing booked'} description={data.nextTrip ? `${data.nextTrip.originCity} → ${data.nextTrip.destinationCity}` : undefined} actions={<Link href="/travel" className="link-lux text-[11px] uppercase tracking-[0.2em] text-graphite-300 transition-colors hover:text-ivory-100">Travel →</Link>} />
            {data.nextTrip ? (
              <>
                <Divider className="my-5" />
                <KeyValue
                  items={[
                    { label: 'Departs', value: `${formatDate(data.nextTrip.startsAt, 'day', user.timezone)} · ${formatTime(data.nextTrip.startsAt, user.timezone)}` },
                    { label: 'Residence', value: data.nextTrip.propertyName ?? 'Not linked' },
                    ...data.nextTrip.legs.slice(0, 4).map((leg) => ({
                      label: humanise(leg.kind, STATUS_LABEL),
                      value: (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-[12.5px] text-graphite-200">{leg.label}</span>
                          <Badge tone={toneForStatus(leg.status)}>{humanise(leg.status, STATUS_LABEL)}</Badge>
                        </span>
                      ),
                    })),
                  ]}
                />
                {data.nextTrip.pendingLegs ? (
                  <p className="mt-4 text-[11.5px] leading-relaxed text-gold-200">
                    {data.nextTrip.pendingLegs} of {data.nextTrip.legCount} steps still need a counterparty’s confirmation.
                  </p>
                ) : (
                  <p className="mt-4 text-[11.5px] leading-relaxed text-state-ok">Every step is confirmed.</p>
                )}
              </>
            ) : (
              <p className="mt-4 text-[12.5px] leading-relaxed text-graphite-400">
                Raise a journey in Travel and the office will assemble the arrival plan — transfer, handling, house ready, dinner booked.
              </p>
            )}
          </Panel>

          <Panel>
            <PanelHeader label="On site now" title="Who is where" actions={<Link href="/people" className="link-lux text-[11px] uppercase tracking-[0.2em] text-graphite-300 transition-colors hover:text-ivory-100">Directory →</Link>} />
            <Divider className="my-5" />
            {data.staffOnSite.length ? (
              <ul className="space-y-2.5">
                {data.staffOnSite.slice(0, 5).map((person) => (
                  <li key={person.name} className="flex items-baseline justify-between gap-4 text-[12.5px]">
                    <span className="min-w-0 truncate text-ivory-100">{person.name}</span>
                    <span className="shrink-0 text-[11.5px] text-graphite-500">
                      {humanise(person.role, STATUS_LABEL)}
                      {person.city ? ` · ${person.city}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-graphite-400">No one is flagged as on site. Set availability in the directory.</p>
            )}
            <Divider className="my-5" />
            <SectionLabel>Status of the household</SectionLabel>
            <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2">
              {STAFF_STATUS.slice(0, 4).map((status) => (
                <LedgerRow key={status} label={humanise(status, STATUS_LABEL)} value={staff.filter((person) => person.status === status).length} tone="muted" />
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader label="Membership" title={humanise(membership.subscription?.status ?? 'none', STATUS_LABEL)} />
            <Divider className="my-5" />
            <KeyValue
              items={[
                { label: 'Tier', value: humanise(membership.subscription?.plan ?? 'none', STATUS_LABEL) },
                { label: 'Renews or ends', value: membership.subscription?.currentPeriodEnd ? formatDate(membership.subscription.currentPeriodEnd, 'medium', user.timezone) : '—' },
                { label: 'Open invoices', value: membership.openInvoices },
                { label: 'Last invoice', value: membership.invoices[0] ? relativeTime(membership.invoices[0].issuedAt) : '—' },
              ]}
            />
            <Button asLink href="/membership" variant="secondary" size="sm" className="mt-5 w-full">
              Manage membership
            </Button>
          </Panel>
        </div>
      </div>
    </div>
  );
}
