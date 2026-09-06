import type { Metadata } from 'next';
import Link from 'next/link';
import { Download, FileLock2 } from 'lucide-react';
import { PageHeader, StatStrip, Notice } from '@/components/app/page-chrome';
import { DataTable, TitleCell, type Column } from '@/components/app/data-table';
import { FilterBar } from '@/components/app/filter-bar';
import { Badge, StatusDot, toneForStatus } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteButton, RecordForm, type FieldSpec } from '@/components/ui/record-form';
import { DocumentUpload } from '@/components/app/document-upload';
import { requireUser } from '@/lib/auth/session';
import { listDocuments, listProperties } from '@/lib/data/read';
import type { DocumentWithProperty } from '@/lib/data/read';
import { DOCUMENT_CATEGORIES, STATUS_LABEL, daysUntil, formatDate, label as humanise, relativeTime } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Documents' };
export const dynamic = 'force-dynamic';

type Row = DocumentWithProperty;

export default async function DocumentsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const user = await requireUser();
  const q = typeof searchParams?.q === 'string' ? searchParams.q : '';
  const category = typeof searchParams?.category === 'string' ? searchParams.category : 'all';
  const status = typeof searchParams?.status === 'string' ? searchParams.status : 'all';

  const library = listDocuments(user.id, { q, category, status });
  const all = library.rows;
  const withFile = all.filter((document) => document.storedPath);
  const properties = listProperties(user.id);

  const expiringSoon = all
    .map((document) => ({ document, days: daysUntil(document.expiresAt) }))
    .filter((entry) => entry.days !== null && entry.days <= 60)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));

  const fields: FieldSpec[] = [
    { key: 'name', label: 'What it is', type: 'text', required: true, span: 2, placeholder: 'Villa Azure — buildings insurance policy' },
    { key: 'category', label: 'Category', type: 'select', required: true, options: DOCUMENT_CATEGORIES.map((value) => ({ value, label: humanise(value, STATUS_LABEL) })) },
    { key: 'status', label: 'Status', type: 'select', required: true, options: ['valid', 'expiring', 'expired', 'draft'].map((value) => ({ value, label: humanise(value, STATUS_LABEL) })) },
    { key: 'propertyId', label: 'Residence', type: 'select', options: [{ value: '', label: 'Not tied to a residence' }, ...properties.map((property) => ({ value: property.id, label: property.name }))] },
    { key: 'expiresAt', label: 'Expires', type: 'date', hint: 'The office puts anything inside 60 days into your briefing.' },
    { key: 'owner', label: 'Held by', type: 'text', placeholder: 'Family office, Lausanne' },
    { key: 'fileType', label: 'Format', type: 'select', options: ['pdf', 'docx', 'xlsx', 'png', 'jpg', 'csv', 'other'].map((value) => ({ value, label: value.toUpperCase() })) },
    { key: 'sizeKb', label: 'Size (KB)', type: 'number', min: 0 },
    { key: 'visibility', label: 'Visibility', type: 'select', options: [
      { value: 'private', label: 'Private to you' },
      { value: 'household', label: 'Household staff' },
      { value: 'advisers', label: 'Advisers' },
    ] },
    { key: 'tags', label: 'Tags', type: 'tags', hint: 'Comma separated.' },
    { key: 'notes', label: 'Notes', type: 'textarea', rows: 3, max: 600, span: 2 },
  ];

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Document',
      width: '32%',
      cell: (row) => (
        <TitleCell
          title={
            <span className="flex items-center gap-2.5">
              <StatusDot status={row.status} />
              <span className="text-ivory-50">{row.name}</span>
            </span>
          }
          detail={`${humanise(row.category, STATUS_LABEL)} · v${row.version}${row.fileType ? ` · ${row.fileType.toUpperCase()}` : ''}${row.sizeKb ? ` · ${row.sizeKb} KB` : ''}`}
        />
      ),
    },
    { key: 'residence', header: 'Residence', hideBelow: 'md', cell: (row) => (row.propertyName ? <Link href={`/properties/${row.propertyId}`} className="link-lux text-graphite-200 hover:text-ivory-50">{row.propertyName}</Link> : <span className="text-graphite-600">General</span>) },
    { key: 'owner', header: 'Held by', hideBelow: 'lg', cell: (row) => <span className="text-graphite-300">{row.owner ?? '—'}</span> },
    {
      key: 'expiry',
      header: 'Expires',
      cell: (row) => {
        const days = daysUntil(row.expiresAt);
        if (row.expiresAt === null) return <span className="text-graphite-600">No expiry</span>;
        return (
          <span className={days !== null && days < 0 ? 'text-state-risk' : days !== null && days <= 60 ? 'text-gold-200' : 'text-graphite-300'}>
            {formatDate(row.expiresAt, 'medium', user.timezone)}
            {days !== null ? <span className="ml-2 text-[11px] text-graphite-600">{days < 0 ? `${Math.abs(days)}d past` : `in ${days}d`}</span> : null}
          </span>
        );
      },
    },
    { key: 'status', header: 'Status', cell: (row) => <Badge tone={toneForStatus(row.status)}>{humanise(row.status, STATUS_LABEL)}</Badge> },
    { key: 'uploaded', header: 'Filed', hideBelow: 'lg', cell: (row) => <span className="text-graphite-500">{relativeTime(row.uploadedAt)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '13rem',
      cell: (row) => (
        <span className="relative z-10 inline-flex items-center justify-end gap-2">
          {row.storedPath ? (
            <a
              href={`/api/documents/${row.id}/file`}
              className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.18em] text-gold-200 transition-colors hover:text-gold-100"
            >
              <Download size={12} strokeWidth={1.4} /> File
            </a>
          ) : (
            <span className="text-[10.5px] uppercase tracking-[0.18em] text-graphite-600">Record only</span>
          )}
          <RecordForm
            title="Edit record"
            eyebrow="Documents"
            path="/api/documents"
            id={row.id}
            fields={fields}
            initial={{
              name: row.name,
              category: row.category,
              status: row.status,
              propertyId: row.propertyId ?? '',
              expiresAt: row.expiresAt,
              owner: row.owner,
              fileType: row.fileType,
              sizeKb: row.sizeKb,
              visibility: row.visibility,
              tags: row.tags,
              notes: row.notes,
            }}
            trigger={<span className="cursor-pointer px-1 text-[10.5px] uppercase tracking-[0.18em] text-graphite-400 transition-colors hover:text-gold-200">Edit</span>}
          />
          <DeleteButton
            path={`/api/documents/${row.id}`}
            label="Remove"
            title={`Remove “${row.name}”?`}
            body={row.storedPath ? 'The record and the file stored on this machine are both deleted. This cannot be undone from the browser.' : 'The record is deleted. Nothing else is touched.'}
          />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Module 06 · Records"
        title="Documents & contracts"
        lede="Policies, mandates, supply contracts, inventories, identity papers. What is on file, who holds the original, and when it runs out."
        meta={
          <>
            <span>{all.length} records</span>
            <span>{withFile.length} with a stored file</span>
            <span>{expiringSoon.length} expiring within 60 days</span>
          </>
        }
        actions={
          <>
            <DocumentUpload properties={properties.map((property) => ({ id: property.id, name: property.name }))} />
            <RecordForm
              title="Record without a file"
              eyebrow="Documents"
              description="For papers kept elsewhere — a safe, a notary, an adviser. The record still drives the renewal reminder."
              path="/api/documents"
              fields={fields}
              defaults={{ category: 'contracts', status: 'valid', visibility: 'private', fileType: 'pdf' }}
              submitLabel="Record it"
              size="lg"
            />
          </>
        }
      />

      {expiringSoon.length ? (
        <Notice tone="attention" title={`${expiringSoon.length} document${expiringSoon.length === 1 ? '' : 's'} come up for renewal`}>
          {expiringSoon
            .slice(0, 3)
            .map((entry) => `${entry.document.name} (${entry.days! < 0 ? `${Math.abs(entry.days!)} days past` : `${entry.days} days`})`)
            .join(' · ')}
          {expiringSoon.length > 3 ? ` · and ${expiringSoon.length - 3} more` : ''}
        </Notice>
      ) : null}

      <StatStrip
        items={[
          { label: 'On file', value: all.length, detail: `${new Set(all.map((d) => d.category)).size} categories in use` },
          { label: 'Files stored here', value: withFile.length, tone: 'gold', detail: 'under data/uploads on this machine' },
          { label: 'Expiring soon', value: expiringSoon.length, detail: expiringSoon.length ? `next: ${expiringSoon[0].document.name}` : 'nothing inside 60 days', tone: expiringSoon.length ? 'attention' : 'ok' },
          { label: 'Shared with staff', value: all.filter((d) => d.visibility !== 'private').length, detail: 'visibility you set per document' },
        ]}
      />

      <FilterBar
        resultCount={`${all.length} shown`}
        filters={[
          { key: 'q', type: 'search', label: 'Search documents', placeholder: 'Name, holder, tag…' },
          { key: 'category', type: 'select', label: 'Category', options: [{ value: 'all', label: 'All' }, ...DOCUMENT_CATEGORIES.map((value) => ({ value, label: humanise(value, STATUS_LABEL) }))] },
          { key: 'status', type: 'select', label: 'Status', options: [{ value: 'all', label: 'All' }, ...['valid', 'expiring', 'expired', 'draft'].map((value) => ({ value, label: humanise(value, STATUS_LABEL) }))] },
        ]}
      />

      <DataTable
        rows={all}
        columns={columns}
        empty={
          <EmptyState
            compact
            title="Nothing filed yet"
            description="Upload a policy or a contract, or record one that lives in a notary’s drawer. Either way the renewal date starts working."
            icon={<FileLock2 size={18} strokeWidth={1.3} />}
          />
        }
      />

      <div className="rounded-[5px] border border-ivory-200/[0.07] bg-ink-950/60 px-6 py-5">
        <p className="label mb-3 text-graphite-400">Where files actually are</p>
        <p className="max-w-3xl text-[12.5px] leading-relaxed text-graphite-300">
          An uploaded file is written to <code className="text-ivory-100">data/uploads/&lt;your member id&gt;/</code> on this machine and served back only
          to you, as a download, with the original name. Nothing is passed to a third-party store, and no scan or OCR is performed — this build claims
          neither. To move it to object storage, replace <code className="text-ivory-100">src/lib/files.ts</code>; the database only ever holds a
          relative path.
        </p>
      </div>
    </div>
  );
}
