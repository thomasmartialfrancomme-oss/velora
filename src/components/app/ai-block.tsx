import type { AIBlock } from '@/lib/ai/types';
import { cn } from '@/lib/utils/format';

/** Renders the structured shapes a coordinator answer may take. */
export function AiBlockView({ block }: { block: AIBlock }) {
  if (block.type === 'kv') {
    return (
      <div className="flex items-baseline justify-between gap-5 border-b border-ivory-200/[0.05] py-2 last:border-b-0">
        <span className="text-[11.5px] uppercase tracking-[0.14em] text-graphite-500">{block.label}</span>
        <span
          className={cn(
            'text-right text-[13px]',
            block.tone === 'attention' ? 'text-gold-200' : block.tone === 'ok' ? 'text-state-ok' : 'text-ivory-100',
          )}
        >
          {block.value}
        </span>
      </div>
    );
  }

  if (block.type === 'list') {
    return (
      <div>
        {block.label ? <p className="label mb-2.5 text-graphite-500">{block.label}</p> : null}
        <ul className="space-y-2">
          {block.items.map((item) => (
            <li key={item} className="flex gap-3 text-[13px] leading-relaxed text-graphite-200">
              <span className="mt-[8px] h-[3px] w-[3px] shrink-0 rounded-full bg-gold-400/70" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (block.type === 'checklist') {
    return (
      <div>
        {block.label ? <p className="label mb-2.5 text-graphite-500">{block.label}</p> : null}
        <ul className="space-y-1.5">
          {block.items.map((item) => (
            <li key={item.text} className="flex items-start gap-3 text-[13px] leading-relaxed">
              <span
                className={cn(
                  'mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[2px] border',
                  item.done ? 'border-state-ok/60 bg-state-ok/15 text-state-ok' : item.pending ? 'border-gold-400/60 text-gold-300' : 'border-ivory-200/20 text-transparent',
                )}
                aria-hidden
              >
                <svg viewBox="0 0 10 10" className="h-2 w-2" fill="none">
                  <path d="M1.5 5.2L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </span>
              <span className={item.done ? 'text-graphite-400 line-through decoration-graphite-600' : 'text-graphite-100'}>{item.text}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (block.type === 'table') {
    return (
      <div className="overflow-x-auto rounded-[4px] border border-ivory-200/[0.08]">
        <table className="w-full min-w-[360px] text-left">
          <thead>
            <tr className="border-b border-ivory-200/[0.08]">
              {block.columns.map((column) => (
                <th key={column} className="label px-3.5 py-2 font-normal text-graphite-500">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, index) => (
              <tr key={index} className="border-b border-ivory-200/[0.04] last:border-b-0">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className={cn('px-3.5 py-2 text-[12.5px]', cellIndex === 0 ? 'text-ivory-100' : 'text-graphite-300')}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.type === 'note') {
    return (
      <p
        className={cn(
          'rounded-[4px] border-l px-4 py-3 text-[12.5px] leading-relaxed',
          block.tone === 'attention' ? 'border-gold-400/50 bg-gold-400/[0.04] text-gold-100' : 'border-ivory-200/15 bg-ink-900/50 text-graphite-300',
        )}
      >
        {block.text}
      </p>
    );
  }

  // 'actions' is a layout marker: the console renders the action list itself.
  return block.label ? <p className="label mt-2 text-graphite-500">{block.label}</p> : null;
}
