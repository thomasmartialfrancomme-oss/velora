import { cn } from '@/lib/utils/format';
import { Reveal } from '@/components/ui/reveal';
import { getT } from '@/lib/i18n/server';;

export function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
  className,
  tone = 'default',
  titleSize = 'lg',
  align = 'left',
  aside,
}: {
  id?: string;
  eyebrow?: string;
  title?: React.ReactNode;
  lede?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  tone?: 'default' | 'raised' | 'paper';
  titleSize?: 'md' | 'lg' | 'xl';
  align?: 'left' | 'center';
  aside?: React.ReactNode;
}) {
  const T = getT();
  const titleClass = { md: 'text-display-md', lg: 'text-display-lg', xl: 'text-display-xl' }[titleSize];
  // A title may be authored as one string carrying its own line break, which is
  // how the display copy keeps its rhythm in a language that needs more words.
  const renderedTitle =
    typeof title === 'string'
      ? T(title)
          .split('\n')
          .map((line, index) => (
            <span key={index} className={index ? 'block' : undefined}>
              {line}
            </span>
          ))
      : title;
  const paper = tone === 'paper';
  return (
    <section
      id={id}
      className={cn(
        'relative scroll-mt-24 py-20 sm:py-28 lg:py-32',
        paper ? 'bg-ivory-100 text-ink-900' : 'bg-transparent text-ivory-100',
        tone === 'raised' && 'bg-ink-950/60',
        className,
      )}
    >
      {!paper ? <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ivory-200/[0.07] to-transparent" /> : null}
      <div className="container">
        {title || eyebrow ? (
          <div className={cn('mb-12 flex flex-wrap items-end justify-between gap-8 lg:mb-16', align === 'center' && 'flex-col items-center text-center')}>
            <Reveal className="max-w-3xl">
              {eyebrow ? (
                <p className={cn('label mb-5 flex items-center gap-3', paper ? 'text-ink-900/45' : 'text-gold-300/80')}>
                  <span className={cn('h-px w-8', paper ? 'bg-ink-900/25' : 'bg-gold-400/45')} />
                  {typeof eyebrow === 'string' ? T(eyebrow) : eyebrow}
                </p>
              ) : null}
              <h2 className={cn('font-serif font-light uppercase leading-[1.05]', titleClass, paper ? 'text-ink-950' : 'text-ivory-50')}>{renderedTitle}</h2>
              {lede ? (
                <p className={cn('mt-6 max-w-xl text-[15px] leading-relaxed', paper ? 'text-ink-900/65' : 'text-graphite-200')}>
                  {typeof lede === 'string' ? T(lede) : lede}
                </p>
              ) : null}
            </Reveal>
            {aside ? <Reveal delay={0.12} className="shrink-0">{aside}</Reveal> : null}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}
