import type { Metadata } from 'next';
import Link from 'next/link';
import { BellOff } from 'lucide-react';
import { PageHeader } from '@/components/app/page-chrome';
import { Panel, PanelHeader, Divider, SectionLabel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { QuickAction } from '@/components/ui/record-form';
import { requireUser } from '@/lib/auth/session';
import { buildBriefing } from '@/lib/data/analytics';
import { listTasks, unreadCount } from '@/lib/data/read';
import { formatTime } from '@/lib/utils/format';
import { getT } from '@/lib/i18n/server';

export const metadata: Metadata = { title: 'Daily briefing' };
export const dynamic = 'force-dynamic';

export default async function BriefingPage() {
  const T = getT();
  const user = await requireUser();
  const briefing = buildBriefing({ id: user.id, firstName: user.firstName, timezone: user.timezone, briefingTime: user.briefingTime });
  const unread = unreadCount(user.id);
  const overdue = listTasks(user.id, { overdueOnly: true, limit: 20 });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={briefing.dateLabel}
        title={briefing.greeting}
        lede={briefing.headline}
        meta={
          <>
            <span>Written at {formatTime(briefing.generatedAt, user.timezone)} · {user.timezone}</span>
            <span>{briefing.counts.appointments} appointments</span>
            <span>{briefing.counts.propertyTasks} property tasks</span>
            <span>{briefing.counts.travelMovements} movements</span>
            <span>{briefing.counts.pendingRequests} requests</span>
          </>
        }
        actions={
          <>
            <Button asLink href="/settings?tab=notifications" variant="ghost" size="md">{T("Adjust the hour")}</Button>
            {unread ? (
              <QuickAction path="/api/notifications" body={{ all: true }} label={`Mark ${unread} read`} variant="secondary" size="md" successMessage="Your message list is clear." />
            ) : (
              <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-graphite-500">
                <BellOff size={13} strokeWidth={1.4} /> Nothing unread
              </span>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <article className="relative overflow-hidden rounded-[6px] border border-ivory-200/[0.1] bg-ink-950 px-7 py-8 sm:px-12 sm:py-12">
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/40 to-transparent" aria-hidden />

          <header className="flex items-baseline justify-between gap-6 border-b border-ivory-200/[0.08] pb-6">
            <div>
              <p className="label text-gold-300/80">{T("VELORA PRIVATE · Daily briefing")}</p>
              <h2 className="mt-4 font-serif text-[1.9rem] font-light uppercase leading-[1.12] tracking-[0.04em] text-ivory-50">{briefing.greeting}</h2>
            </div>
            <p className="shrink-0 text-right text-[11px] uppercase tracking-[0.18em] text-graphite-500">
              {briefing.dateLabel}
              <br />
              <span className="text-graphite-600">{user.timezone}</span>
            </p>
          </header>

          <p className="mt-7 max-w-2xl text-[14.5px] leading-[1.8] text-graphite-200">{briefing.headline}</p>

          {briefing.priority ? (
            <section className="mt-9 rounded-[4px] border-l border-gold-400/50 bg-gold-400/[0.04] py-5 pl-6 pr-5">
              <p className="label mb-2.5 text-gold-300/90">{T("Needs your word")}</p>
              <p className="text-[14px] leading-snug text-ivory-50">{briefing.priority.title}</p>
              <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-graphite-300">{briefing.priority.detail}</p>
              <Link href={briefing.priority.actionHref} className="mt-4 inline-block text-[11px] uppercase tracking-[0.2em] text-gold-200 transition-colors hover:text-gold-100">
                {briefing.priority.actionLabel} →
              </Link>
            </section>
          ) : null}

          <div className="mt-10 space-y-9">
            {briefing.sections.map((section) => (
              <section key={section.key}>
                <SectionLabel className="mb-3 text-graphite-400">{section.title}</SectionLabel>
                {section.items.length ? (
                  <ul>
                    {section.items.map((item) => (
                      <li key={`${section.key}-${item.label}`} className="flex items-baseline justify-between gap-6 border-b border-ivory-200/[0.05] py-2.5 last:border-b-0">
                        <span className="min-w-0">
                          <span className="block text-[13.5px] text-ivory-100">{item.label}</span>
                          {item.note ? <span className="mt-0.5 block text-[11.5px] leading-relaxed text-graphite-500">{item.note}</span> : null}
                        </span>
                        <span
                          className={
                            item.tone === 'attention'
                              ? 'shrink-0 text-right text-[12.5px] text-gold-200'
                              : item.tone === 'ok'
                                ? 'shrink-0 text-right text-[12.5px] text-state-ok'
                                : 'shrink-0 text-right text-[12.5px] tabular-nums text-graphite-200'
                          }
                        >
                          {item.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12.5px] leading-relaxed text-graphite-600">{T("Nothing to report.")}</p>
                )}
              </section>
            ))}
          </div>

          <footer className="mt-11 border-t border-ivory-200/[0.08] pt-6">
            <p className="font-serif text-[1.05rem] italic text-ivory-200">{briefing.signature}</p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-graphite-600">
              Prepared from your own records · {overdue.length ? `${overdue.length} item${overdue.length === 1 ? '' : 's'} past due` : 'nothing past due'}
            </p>
          </footer>
        </article>

        <div className="space-y-6">
          <Panel>
            <PanelHeader label="How this is made" title="Not a summary generator" description="Each line below is a query against your records, taken in a fixed order. Nothing is written by a model, so nothing can be invented." />
            <Divider className="my-5" />
            <ul className="space-y-3">
              {[
                'Arrivals and departures inside the next 72 hours, with the status of every step.',
                'Residence items past due, or waiting on a confirmation from you.',
                'Ledger entries that cannot be matched to a residence or a contract.',
                'Documents expiring inside 60 days, and services inside 21.',
                'Anything a person has told the office that changes today.',
              ].map((item) => (
                <li key={item} className="flex gap-3 text-[12.5px] leading-relaxed text-graphite-300">
                  <span className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-gold-400/80" />
                  {item}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader label="Past due" title={overdue.length ? `${overdue.length} open and late` : 'Nothing is late'} />
            <Divider className="my-5" />
            {overdue.length ? (
              <ul className="space-y-3">
                {overdue.slice(0, 6).map((task) => (
                  <li key={task.id} className="flex items-baseline justify-between gap-4 text-[12.5px]">
                    <span className="min-w-0 truncate text-graphite-100">{task.title}</span>
                    <Link href="/dashboard#open-items" className="shrink-0 text-[10.5px] uppercase tracking-[0.16em] text-gold-200 hover:text-gold-100">{T("Review")}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-graphite-400">{T("Every open item is inside its own date. The office will tell you the moment that stops being true.")}</p>
            )}
          </Panel>

          <Panel>
            <PanelHeader label="Next" title="Where to go from here" />
            <Divider className="my-5" />
            <div className="space-y-2.5">
              {[
                { href: '/travel', label: 'Journeys and their steps' },
                { href: '/finance', label: 'The ledger for this month' },
                { href: '/ai', label: 'Ask the coordinator' },
                { href: '/support', label: 'Write to the office' },
              ].map((entry) => (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className="flex items-baseline justify-between gap-4 rounded-[3px] border border-ivory-200/[0.07] px-4 py-3 text-[12.5px] text-graphite-200 transition-all duration-300 hover:border-gold-400/35 hover:text-ivory-50"
                >
                  {entry.label}
                  <span className="text-graphite-600">→</span>
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
