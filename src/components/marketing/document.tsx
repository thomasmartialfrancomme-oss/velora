import Link from 'next/link';
import { Reveal } from '@/components/ui/reveal';
import { getT, localeMeta } from '@/lib/i18n/server';
import { Section } from '@/components/marketing/section';

export type DocumentBlock =
  | { type: 'para'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'note'; text: string };

export type DocumentSection = { heading: string; blocks: DocumentBlock[] };

/**
 * A single layout for the plain-language documents (privacy, terms, security,
 * about). Deliberately typographic rather than decorative: these pages are
 * read, not skimmed.
 */
export function DocumentPage({
  eyebrow,
  title,
  lede,
  updated,
  sections,
  aside,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  updated?: string;
  sections: DocumentSection[];
  aside?: { title: string; items: { label: string; href?: string; note?: string; state?: 'live' | 'partial' | 'planned' }[] };
}) {
  const T = getT();
  const { locale } = localeMeta();
  return (
    <>
      <header className="relative border-b border-ivory-200/[0.07] bg-ink-1000 pb-16 pt-16 sm:pb-20 sm:pt-20">
        <div className="container">
          <Reveal>
            <p className="label mb-6 text-gold-300/80">{T(eyebrow)}</p>
            <h1 className="max-w-3xl font-serif text-[clamp(2.3rem,5vw,3.8rem)] font-light uppercase leading-[1.06] tracking-[0.03em] text-ivory-50">
              {T(title)}
            </h1>
            <p className="mt-8 max-w-2xl text-[15px] leading-[1.75] text-graphite-300">{T(lede)}</p>
            {updated ? <p className="label mt-8 text-graphite-600">{updated}</p> : null}
            {locale === 'en' ? null : (
              /* A translated legal page is a courtesy. Saying so, on the page, is
                 the honest part: the governing text stays the English one until a
                 reviewed translation of it exists. */
              <p className="mt-6 max-w-2xl border-l border-gold-400/40 pl-4 text-[12.5px] leading-relaxed text-graphite-500">
                {T('This page is offered in your language as a courtesy. Where the two versions differ, the English text is the one that governs.')}
              </p>
            )}
          </Reveal>
        </div>
      </header>

      <Section className="pb-24 pt-16 sm:pb-32 sm:pt-20">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_290px]">
          <div className="max-w-[68ch]">
            {sections.map((section, index) => (
              <section key={section.heading} className={index === 0 ? '' : 'mt-14'}>
                <h2 className="flex items-baseline gap-4 font-serif text-[1.55rem] font-normal text-ivory-50">
                  <span className="font-sans text-[10.5px] tracking-[0.2em] text-graphite-600">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {T(section.heading)}
                </h2>
                <div className="mt-5 space-y-5">
                  {section.blocks.map((block, blockIndex) => {
                    if (block.type === 'list') {
                      return (
                        <ul key={blockIndex} className="space-y-2.5 pt-1">
                          {block.items.map((item) => (
                            <li key={item} className="flex gap-3.5 text-[14px] leading-[1.8] text-graphite-300">
                              <span className="mt-[9px] h-[3px] w-[3px] shrink-0 rounded-full bg-gold-400/70" />
                              <span>{T(item)}</span>
                            </li>
                          ))}
                        </ul>
                      );
                    }
                    if (block.type === 'note') {
                      return (
                        <p
                          key={blockIndex}
                          className="rounded-[4px] border-l border-gold-400/45 bg-ink-900/60 py-4 pl-5 pr-5 text-[13px] leading-relaxed text-graphite-200"
                        >
                          {T(block.text)}
                        </p>
                      );
                    }
                    return (
                      <p key={blockIndex} className="text-[14px] leading-[1.85] text-graphite-300">
                        {T(block.text)}
                      </p>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            {aside ? (
              <div className="rounded-[6px] border border-ivory-200/[0.08] bg-ink-950/80 p-7">
                <p className="label mb-6 text-graphite-400">{T(aside.title)}</p>
                <ul className="space-y-4">
                  {aside.items.map((item) => (
                    <li key={item.label} className="flex items-start gap-3">
                      <span
                        className={
                          item.state === 'live'
                            ? 'mt-[6px] h-[5px] w-[5px] shrink-0 rounded-full bg-state-ok'
                            : item.state === 'partial'
                              ? 'mt-[6px] h-[5px] w-[5px] shrink-0 rounded-full bg-gold-400'
                              : item.state === 'planned'
                                ? 'mt-[6px] h-[5px] w-[5px] shrink-0 rounded-full border border-graphite-500'
                                : 'mt-[9px] h-[3px] w-[3px] shrink-0 rounded-full bg-graphite-500'
                        }
                      />
                      <span>
                        <span className="block text-[12.5px] text-ivory-100">
                          {item.href ? (
                            <Link href={item.href} className="link-lux">
                              {item.label}
                            </Link>
                          ) : (
                            item.label
                          )}
                        </span>
                        {item.note ? <span className="mt-1 block text-[11.5px] leading-relaxed text-graphite-500">{item.note}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-6 rounded-[6px] border border-ivory-200/[0.08] bg-ink-900/40 p-7">
              <p className="text-[12.5px] leading-relaxed text-graphite-300">
                Questions about any of this are answered by a person. Write to{' '}
                <span className="text-ivory-100">office@velora.private</span> and we will reply within two working days.
              </p>
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
