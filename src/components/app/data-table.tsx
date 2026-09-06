import Link from 'next/link';
import { cn } from '@/lib/utils/format';

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  /** css width hint, e.g. '8rem' or 'auto' */
  width?: string;
  className?: string;
  cell: (row: T) => React.ReactNode;
  /** collapse the column on narrow screens */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
}

const HIDE: Record<string, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

/**
 * The ledger. One table component for every list in the product: hairlines
 * instead of card soup, numbers aligned right, and the whole row clickable
 * when a destination is given.
 */
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  hrefFor,
  empty,
  dense = false,
  footer,
  id,
}: {
  rows: T[];
  columns: Column<T>[];
  /** makes the row clickable; actions inside cells must set `relative z-10` */
  hrefFor?: (row: T) => string | undefined;
  empty?: React.ReactNode;
  dense?: boolean;
  footer?: React.ReactNode;
  id?: string;
}) {
  if (!rows.length) {
    return (
      <div className="rounded-[6px] border border-dashed border-ivory-200/[0.1] px-6 py-14 text-center">
        {empty ?? <p className="text-[13px] text-graphite-400">Nothing recorded yet.</p>}
      </div>
    );
  }

  return (
    <div id={id} className="overflow-x-auto rounded-[6px] border border-ivory-200/[0.08]">
      <table className="w-full min-w-[620px] border-collapse text-left">
        <thead>
          <tr className="border-b border-ivory-200/[0.08] bg-ink-950/60">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={cn(
                  'label px-4 py-3 font-normal text-graphite-500',
                  column.align === 'right' && 'text-right',
                  column.hideBelow && HIDE[column.hideBelow],
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={cn(
                'group relative border-b border-ivory-200/[0.05] transition-colors duration-300 ease-lux last:border-b-0 hover:bg-ivory-100/[0.025]',
                hrefFor && 'cursor-default',
              )}
            >
              {columns.map((column, columnIndex) => {
                const href = hrefFor ? hrefFor(row) : undefined;
                return (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 align-middle text-[13px] text-graphite-200',
                      dense ? 'py-2.5' : 'py-4',
                      column.align === 'right' && 'text-right tabular-nums',
                      column.hideBelow && HIDE[column.hideBelow],
                      column.className,
                    )}
                  >
                    {columnIndex === 0 && href ? (
                      <span className="relative block">
                        {column.cell(row)}
                        <Link href={href} className="absolute inset-0 z-0" aria-label="Open record">
                          <span className="sr-only">Open</span>
                        </Link>
                      </span>
                    ) : (
                      column.cell(row)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {footer ? <tfoot className="border-t border-ivory-200/[0.09] bg-ink-950/50">{footer}</tfoot> : null}
      </table>
    </div>
  );
}

/** A primary cell: title with a quiet second line. */
export function TitleCell({ title, detail, tone }: { title: React.ReactNode; detail?: React.ReactNode; tone?: 'muted' | 'default' }) {
  return (
    <span className="block min-w-0">
      <span className={cn('block truncate text-[13.5px]', tone === 'muted' ? 'text-graphite-300' : 'text-ivory-50')}>{title}</span>
      {detail ? <span className="mt-1 block truncate text-[11.5px] text-graphite-500">{detail}</span> : null}
    </span>
  );
}
