import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Receipt } from 'lucide-react';
import { PageHeader, StatStrip, Notice, KeyValue } from '@/components/app/page-chrome';
import { DataTable, TitleCell, type Column } from '@/components/app/data-table';
import { FilterBar } from '@/components/app/filter-bar';
import { Badge, toneForStatus } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Divider, Panel, PanelHeader, SectionLabel } from '@/components/ui/panel';
import { CompositionBar, LineChart } from '@/components/ui/charts';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteButton, RecordForm, QuickAction, type FieldSpec } from '@/components/ui/record-form';
import { requireUser } from '@/lib/auth/session';
import { getFinanceSummary, listExpenses, listProperties } from '@/lib/data/read';
import type { ExpenseRow } from '@/lib/data/tables';
import { EXPENSE_CATEGORY_LABELS, STATUS_LABEL, formatDate, formatMoney, label as humanise, monthKey } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Finance' };
export const dynamic = 'force-dynamic';

const CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORY_LABELS);

function monthOptions(count = 12): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
    const key = monthKey(date);
    return { value: key, label: new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date) };
  });
}

export default async function FinancePage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const user = await requireUser();
  const months = monthOptions();
  const monthRaw = typeof searchParams?.month === 'string' ? searchParams.month : months[0].value;
  const month = /^\d{4}-\d{2}$/.test(monthRaw) ? monthRaw : months[0].value;
  const category = typeof searchParams?.category === 'string' ? searchParams.category : 'all';
  const propertyId = typeof searchParams?.propertyId === 'string' ? searchParams.propertyId : 'all';
  const q = typeof searchParams?.q === 'string' ? searchParams.q : '';

  const summary = getFinanceSummary(user.id, month);
  const properties = listProperties(user.id);
  const expenses = listExpenses(user.id, { month, category, propertyId, q });
  const budget = properties.reduce((total, property) => total + property.monthlyOpsCents, 0);
  const isCurrentMonth = month === months[0].value;

  const awaitingReview = summary.openItems.filter((item) => item.status === 'pending');

  const fields: FieldSpec[] = [
    { key: 'description', label: 'What it was for', type: 'text', required: true, span: 2, placeholder: 'Winter tyre change and balance' },
    { key: 'amount', label: 'Amount', type: 'money', required: true, hint: 'Enter the figure as it appears on the invoice.' },
    { key: 'spentOn', label: 'Date', type: 'date', required: true },
    { key: 'categoryKey', label: 'Category', type: 'select', required: true, options: CATEGORY_KEYS.map((key) => ({ value: key, label: EXPENSE_CATEGORY_LABELS[key] })) },
    { key: 'propertyId', label: 'Charged to', type: 'select', options: [{ value: '', label: 'Not a residence' }, ...properties.map((property) => ({ value: property.id, label: property.name }))] },
    { key: 'vendor', label: 'Paid to', type: 'text', placeholder: 'Monaco Garage' },
    { key: 'status', label: 'Status', type: 'select', options: ['recorded', 'pending', 'approved', 'disputed'].map((value) => ({ value, label: humanise(value, STATUS_LABEL) })) },
    { key: 'notes', label: 'Notes', type: 'textarea', rows: 2, max: 600, span: 2 },
  ];

  const columns: Column<ExpenseRow>[] = [
    {
      key: 'entry',
      header: 'Entry',
      width: '34%',
      cell: (row) => (
        <TitleCell
          title={<span className="text-ivory-50">{row.description}</span>}
          detail={EXPENSE_CATEGORY_LABELS[row.categoryKey] ?? humanise(row.categoryKey, STATUS_LABEL)}
        />
      ),
    },
    { key: 'date', header: 'Date', cell: (row) => <span className="text-graphite-200">{formatDate(row.spentOn, 'day', user.timezone)}</span> },
    { key: 'vendor', header: 'Paid to', hideBelow: 'md', cell: (row) => <span className="text-graphite-300">{row.vendor ?? '—'}</span> },
    {
      key: 'residence',
      header: 'Charged to',
      hideBelow: 'lg',
      cell: (row) => (row.propertyId ? <Link href={`/properties/${row.propertyId}`} className="link-lux text-graphite-200 hover:text-ivory-50">{properties.find((property) => property.id === row.propertyId)?.name ?? 'Residence'}</Link> : <span className="text-graphite-600">Household</span>),
    },
    { key: 'amount', header: 'Amount', align: 'right', cell: (row) => <span className="text-[13.5px] text-ivory-50">{formatMoney(row.amountCents, { currency: user.currency })}</span> },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <span className="inline-flex items-center gap-2">
          {row.requiresReview ? <span className="h-1 w-1 rounded-full bg-gold-400" /> : null}
          <Badge tone={toneForStatus(row.status)}>{humanise(row.status, STATUS_LABEL)}</Badge>
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '13rem',
      cell: (row) => (
        <span className="relative z-10 inline-flex items-center justify-end gap-1.5">
          {row.status !== 'approved' ? (
            <QuickAction path={`/api/expenses/${row.id}`} method="PATCH" body={{ decision: 'approved' }} label="Approve" icon={<Check size={12} strokeWidth={1.6} />} successMessage="Approved on the ledger." />
          ) : null}
          {row.status !== 'disputed' ? (
            <QuickAction path={`/api/expenses/${row.id}`} method="PATCH" body={{ decision: 'disputed' }} label="Dispute" size="sm" variant="ghost" successMessage="Marked disputed — the office will raise it with the vendor." />
          ) : null}
          <DeleteButton path={`/api/expenses/${row.id}`} label="Remove" title="Delete this entry?" body="Ledger entries are deleted outright; a corrected figure should be recorded as a new entry so the history stays readable." />
        </span>
      ),
    },
  ];

  const deltaPct = summary.previousTotalCents ? Math.round(((summary.totalCents - summary.previousTotalCents) / summary.previousTotalCents) * 100) : null;
  const budgetPct = budget ? Math.round((summary.totalCents / budget) * 100) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Module 07 · Finance"
        title="The ledger"
        lede="What has actually been recorded, by category and by residence. This is organisation, not advice: no bank feed, no forecast, no categorisation you did not make."
        meta={
          <>
            <span>{summary.month.label}</span>
            <span>{expenses.length} entries</span>
            <span>Currency {user.currency}</span>
          </>
        }
        actions={
          <>
            <Button asLink href="/documents" variant="ghost" size="md">
              Invoices on file
            </Button>
            <RecordForm
              title="Record an expense"
              eyebrow="Ledger"
              description="Recording a figure here does not pay anyone. It writes what was paid into your ledger so the residence and category totals stay true."
              path="/api/expenses"
              fields={fields}
              defaults={{ categoryKey: 'property_operations', status: 'recorded', spentOn: new Date().toISOString().slice(0, 10) }}
              submitLabel="Record an expense"
              size="lg"
            />
          </>
        }
      />

      {isCurrentMonth && budgetPct !== null && budgetPct > 100 ? (
        <Notice tone="attention" title={`Recorded spend is ${budgetPct}% of the monthly budget you set`}>
          The figure is what has been entered across your residences this month. Where a budget is exceeded, the office writes to you rather than
          adjusting it.
        </Notice>
      ) : null}

      <StatStrip
        items={[
          { label: summary.month.label, value: formatMoney(summary.totalCents, { currency: user.currency }), detail: `${expenses.length} entries recorded` },
          { label: 'Versus last month', value: deltaPct === null ? '—' : `${deltaPct >= 0 ? '+' : ''}${deltaPct}%`, detail: formatMoney(summary.previousTotalCents, { currency: user.currency }), tone: deltaPct !== null && deltaPct > 10 ? 'attention' : 'default' },
          { label: 'Against your budgets', value: budget ? `${budgetPct}%` : '—', detail: budget ? formatMoney(budget, { currency: user.currency }) : 'no budgets set on the residences', href: '/properties' },
          { label: 'Awaiting review', value: awaitingReview.length, detail: awaitingReview.length ? 'flagged by the office' : 'nothing flagged', tone: awaitingReview.length ? 'gold' : 'ok' },
        ]}
      />

      <FilterBar
        resultCount={`${expenses.length} entries`}
        filters={[
          { key: 'q', type: 'search', label: 'Search entries', placeholder: 'Description, vendor…' },
          { key: 'month', type: 'select', label: 'Month', options: months },
          { key: 'category', type: 'select', label: 'Category', options: [{ value: 'all', label: 'All' }, ...CATEGORY_KEYS.map((key) => ({ value: key, label: EXPENSE_CATEGORY_LABELS[key] }))] },
          { key: 'propertyId', type: 'select', label: 'Residence', options: [{ value: 'all', label: 'All' }, ...properties.map((property) => ({ value: property.id, label: property.name }))] },
        ]}
      />

      <DataTable
        rows={expenses}
        columns={columns}
        empty={
          <EmptyState
            compact
            title="Nothing recorded for that month"
            description="Add an entry, or choose another month. The ledger only ever shows what you or the office have written into it."
            icon={<Receipt size={18} strokeWidth={1.3} />}
          />
        }
        footer={
          expenses.length ? (
            <tr>
              <td className="px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-graphite-400" colSpan={4}>
                {isCurrentMonth ? 'Filtered total (this view)' : 'Month total (this view)'}
              </td>
              <td className="px-4 py-3 text-right text-[13.5px] text-ivory-50">{formatMoney(expenses.reduce((total, row) => total + row.amountCents, 0), { currency: user.currency })}</td>
              <td className="px-4 py-3 text-right text-[11px] uppercase tracking-[0.18em] text-graphite-600" colSpan={2}>
                {summary.month.label}
              </td>
            </tr>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <Panel>
          <PanelHeader label="Composition" title="Where the month went" description="Categories are yours — nothing here is auto-guessed." />
          <Divider className="my-5" />
          {summary.byCategory.some((entry) => entry.cents > 0) ? (
            <>
              <CompositionBar
                segments={summary.byCategory
                  .filter((entry) => entry.cents > 0)
                  .map((entry, index) => ({ label: entry.label, value: entry.cents, tone: ['gold', 'ivory', 'graphite', 'steel', 'sage'][index % 5] }))}
              />
              <div className="mt-6">
                <KeyValue
                  items={summary.byCategory.map((entry) => ({
                    label: entry.label,
                    value: (
                      <span className="flex items-baseline justify-end gap-3">
                        <span className="text-[11px] text-graphite-600">{entry.entries}</span>
                        <span className="text-ivory-100">{formatMoney(entry.cents, { currency: user.currency })}</span>
                        {entry.deltaPct !== null ? (
                          <span className={entry.deltaPct > 0 ? 'text-[11px] text-gold-200' : 'text-[11px] text-state-ok'}>
                            {entry.deltaPct > 0 ? '+' : ''}
                            {entry.deltaPct}%
                          </span>
                        ) : null}
                      </span>
                    ),
                  }))}
                />
              </div>
            </>
          ) : (
            <p className="text-[12.5px] leading-relaxed text-graphite-400">Nothing has been recorded in {summary.month.label}.</p>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel>
            <PanelHeader label="Trend" title="Twelve months" description="Recorded spend per month, oldest on the left." />
            <Divider className="my-5" />
            <LineChart
              points={summary.trend.map((entry) => entry.cents)}
              labels={summary.trend.map((entry) => entry.month.slice(5))}
              format={{ kind: 'money', currency: user.currency, compact: true }}
            />
          </Panel>

          <Panel>
            <PanelHeader label="By residence" title="Charge distribution" />
            <Divider className="my-5" />
            <ul className="space-y-3">
              {summary.byProperty.slice(0, 6).map((entry) => {
                const share = summary.totalCents ? Math.round((entry.cents / summary.totalCents) * 100) : 0;
                return (
                  <li key={entry.propertyId ?? 'household'}>
                    <div className="flex items-baseline justify-between gap-4 text-[12.5px]">
                      <span className="min-w-0 truncate text-graphite-200">{entry.name}</span>
                      <span className="shrink-0 tabular-nums text-ivory-100">
                        {formatMoney(entry.cents, { currency: user.currency })}
                        <span className="ml-2 text-[11px] text-graphite-600">{share}%</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-[2px] w-full bg-ivory-200/[0.07]">
                      <span className="block h-full bg-gold-400/70 transition-all duration-[900ms] ease-lux" style={{ width: `${Math.max(2, share)}%` }} />
                    </div>
                  </li>
                );
              })}
              {!summary.byProperty.length ? <li className="text-[12.5px] text-graphite-500">Nothing to distribute.</li> : null}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader label="Open items" title="Flagged for a person" />
            <Divider className="my-5" />
            {summary.openItems.length ? (
              <ul className="space-y-3">
                {summary.openItems.slice(0, 5).map((item) => (
                  <li key={item.id} className="flex items-baseline justify-between gap-4 border-b border-ivory-200/[0.05] pb-3 text-[12.5px] last:border-b-0">
                    <span className="min-w-0">
                      <span className="block truncate text-graphite-100">{item.description}</span>
                      <span className="mt-0.5 block text-[11px] text-graphite-500">
                        {item.vendor ?? 'Vendor not recorded'} · {formatDate(item.spentOn, 'day', user.timezone)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block tabular-nums text-ivory-50">{formatMoney(item.amountCents, { currency: user.currency })}</span>
                      <span className="mt-0.5 block text-[11px] text-gold-200">{humanise(item.status, STATUS_LABEL)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-graphite-400">
                Nothing is waiting on you. Entries become “pending” only when someone records them that way or the office cannot match them to a
                residence.
              </p>
            )}
            <SectionLabel className="mt-6">Largest entries this month</SectionLabel>
            <ul className="mt-3 space-y-2">
              {summary.largest.slice(0, 3).map((entry) => (
                <li key={`${entry.description}-${entry.amountCents}`} className="flex items-baseline justify-between gap-4 text-[12px]">
                  <span className="min-w-0 truncate text-graphite-400">
                    {entry.description}
                    {entry.propertyName ? ` · ${entry.propertyName}` : ''}
                  </span>
                  <span className="shrink-0 tabular-nums text-graphite-200">{formatMoney(entry.amountCents, { currency: user.currency })}</span>
                </li>
              ))}
              {!summary.largest.length ? <li className="text-[12px] text-graphite-600">—</li> : null}
            </ul>
          </Panel>
        </div>
      </div>

      <p className="text-[11.5px] leading-relaxed text-graphite-600">
        Amounts are stored in whole cents, so the arithmetic you see is the arithmetic that ran. Invoices and their PDFs belong in Documents — the ledger
        line and the paper reference each other by residence, not by a filename.
      </p>
    </div>
  );
}
