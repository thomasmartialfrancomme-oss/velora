import { Section } from '@/components/marketing/section';
import { Reveal } from '@/components/ui/reveal';

const PILLARS = [
  {
    title: 'Your data, and only your data',
    body: 'Every record is scoped to your account at the query layer. No analyst, no model and no other household can read across — the isolation is enforced in code, not in a policy document.',
    ref: 'Row-level tenancy · assertOwned()',
  },
  {
    title: 'Nothing is claimed that has not happened',
    body: 'VELORA writes requests, tasks and records. Where a supplier, a venue or a payment must act, the platform says so plainly and waits for a person.',
    ref: 'requiresConfirmation · human-in-the-loop',
  },
  {
    title: 'No training on your household',
    body: 'The in-house coordinator runs on your rows alone. If a model gateway is connected, the prompt carries a digest of your records for that request and is not retained by VELORA.',
    ref: 'Context per request · zero retention',
  },
  {
    title: 'Leaving is a download, not a negotiation',
    body: 'Your residences, staff, journeys, ledger, documents index and AI history export as JSON at any time, in one click, from your settings.',
    ref: '/settings · export your data',
  },
];

export function Discretion() {
  return (
    <Section
      id="discretion"
      eyebrow="Confidentiality"
      title={
        <>
          Discretion is not a
          <br />
          feature you switch on.
        </>
      }
      tone="raised"
      lede="A private office is judged on what it never says. These four commitments are implemented, reviewable and testable — the rest is marketing."
    >
      <div className="grid gap-px overflow-hidden rounded-[6px] border border-ivory-200/[0.07] bg-ivory-200/[0.06] md:grid-cols-2">
        {PILLARS.map((pillar, index) => (
          <Reveal key={pillar.title} delay={index * 0.07} className="h-full">
            <article className="group h-full bg-ink-950 p-8 transition-colors duration-500 ease-lux hover:bg-ink-900/70 sm:p-10">
              <span className="font-serif text-[11px] tracking-[0.2em] text-gold-300/70">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="mt-5 font-serif text-[1.35rem] leading-snug text-ivory-50">{pillar.title}</h3>
              <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-graphite-300">{pillar.body}</p>
              <p className="mt-7 text-[10.5px] uppercase tracking-[0.22em] text-graphite-500 transition-colors duration-500 group-hover:text-gold-300/70">{pillar.ref}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
