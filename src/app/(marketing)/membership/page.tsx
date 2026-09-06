import type { Metadata } from 'next';
import Link from 'next/link';
import { CircleDollarSign, Lock } from 'lucide-react';
import { Section } from '@/components/marketing/section';
import { Reveal } from '@/components/ui/reveal';
import { BillingControls, PlanMatrix } from '@/components/app/membership-actions';
import { getCurrentUser } from '@/lib/auth/session';
import { getMembership } from '@/lib/data/read';
import { getBillingStatus } from '@/lib/billing';
import { MEMBERSHIP_PLANS, formatDate, formatDateTime, formatMoney, getPlan, label as humanise, STATUS_LABEL } from '@/lib/utils/format';
import { getT } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Membership',
  description:
    'Three levels of attention — Private, Priority and Private Office. What each one covers, how the billing works here, and the state of your own membership.',
};

export const dynamic = 'force-dynamic';

const INCLUDED = [
  { title: 'Your own data, and nobody else’s', body: 'Every table is keyed to your account and every query is filtered by it. Two members of the same household see different ledgers unless they are the same person.' },
  { title: 'Records that stay readable', body: 'Documents, ledger entries and journeys are stored as rows you can export. Nothing is kept in a form only our interface can read.' },
  { title: 'A person behind the coordinator', body: 'The assistant prepares; the office commits. Anything that spends money, invites a person or touches a residence waits for a name against it.' },
  { title: 'No resale of anything', body: 'No advertising network, no analytics vendor, no training set. Model calls, where used, carry the minimum text required to answer.' },
];

const HOW_BILLING_WORKS = [
  { label: 'Where the money moves', value: 'Checkout and the customer portal belong to the payment provider. We store a subscription state and an invoice record — never a card number, never a CVC, never an expiration date.' },
  { label: 'When a change takes effect', value: 'Switching level is recorded immediately and prorated by the provider where one is connected. Ending at period close leaves every module open until the date passes.' },
  { label: 'What happens on a failed charge', value: 'The status moves to past due and the modules stay readable for fourteen days. Nothing is deleted on a bank error; a person from the office calls instead.' },
  { label: 'Invoices', value: 'Issued by the provider and mirrored here, so the ledger you see matches the receipt you can download. VAT is handled in the provider’s tax settings.' },
  { label: 'If no provider is connected', value: 'This deployment records the membership in its own database and says plainly that nothing was charged. That is the mode you are reading now unless Stripe keys are present.' },
];

export default async function MembershipPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const T = getT();
  const user = await getCurrentUser();
  const requested = typeof searchParams?.plan === 'string' ? searchParams.plan : undefined;

  const state = user ? getMembership(user.id) : null;
  const billing = getBillingStatus();
  const subscription = state?.subscription ?? null;
  const plan = subscription ? getPlan(subscription.plan) : null;

  return (
    <div className="pb-4">
      <Section
        eyebrow="Membership"
        title={
          <>
            Three levels of
            <br />
            attention.
          </>
        }
        lede="Membership is a service relationship, priced accordingly. The difference between the levels is how many residences are carried, how quickly we answer, and how much of the work a person reviews before it is done."
        aside={
          <div className="flex flex-col items-start gap-3 text-[11px] uppercase tracking-[0.18em] text-graphite-500">
            <span className={billing.stripeConfigured ? 'text-state-ok' : 'text-gold-200'}>{billing.label}</span>
            {user ? (
              <Link href="/dashboard" className="text-gold-200 transition-colors hover:text-gold-100">{T("Return to the dashboard →")}</Link>
            ) : (
              <Link href="/login" className="text-gold-200 transition-colors hover:text-gold-100">{T("Sign in to change your membership →")}</Link>
            )}
          </div>
        }
      >
        <Reveal>
          <p className="mb-8 max-w-3xl rounded-[4px] border border-ivory-200/[0.09] bg-ink-950/70 px-5 py-4 text-[12.5px] leading-relaxed text-graphite-300">
            {billing.note}
          </p>
        </Reveal>

        <PlanMatrix signedIn={Boolean(user)} currentPlan={subscription?.plan ?? null} stripeConfigured={billing.stripeConfigured} billing={billing} initialPlan={requested} />
      </Section>

      {user && subscription ? (
        <Section
          eyebrow="Your account"
          title="The membership you hold"
          lede="This is not a marketing view — these are the rows on your account, and the buttons below change them."
          tone="raised"
          titleSize="md"
        >
          <div className="grid gap-px overflow-hidden rounded-[6px] border border-ivory-200/[0.07] bg-ivory-200/[0.06] lg:grid-cols-[1.3fr_1fr]">
            <div className="bg-ink-950 p-8 sm:p-9">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <p className="font-serif text-[1.7rem] uppercase tracking-[0.06em] text-ivory-50">{plan?.name ?? humanise(subscription.plan, STATUS_LABEL)}</p>
                <p className="text-[11px] uppercase tracking-[0.2em] text-graphite-500">
                  {humanise(subscription.status, STATUS_LABEL)} · {subscription.billingCycle}
                </p>
              </div>

              <dl className="mt-8 divide-y divide-ivory-200/[0.06] text-[13px]">
                {[
                  { label: 'Amount', value: formatMoney(subscription.amountCents, { currency: subscription.currency }) },
                  { label: 'Provider', value: subscription.provider === 'stripe' ? 'Stripe' : 'Recorded in this platform' },
                  { label: 'Current period ends', value: subscription.currentPeriodEnd ? formatDateTime(subscription.currentPeriodEnd, user.timezone) : 'Not dated' },
                  { label: 'Cancellation', value: subscription.cancelAtPeriodEnd ? 'Scheduled at period close' : 'None on file' },
                  { label: 'Started', value: formatDate(subscription.startedAt, 'long', user.timezone) },
                  { label: 'Open invoices', value: state?.openInvoices ? `${state.openInvoices} awaiting settlement` : 'None' },
                ].map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-6 py-3">
                    <dt className="text-graphite-500">{row.label}</dt>
                    <dd className="text-right text-graphite-100">{row.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-9 border-t border-ivory-200/[0.07] pt-7">
                <BillingControls
                  hasSubscription
                  cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
                  stripeConfigured={billing.stripeConfigured}
                  status={subscription.status}
                />
              </div>
            </div>

            <div className="flex flex-col bg-ink-950 p-8 sm:p-9">
              <p className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] text-graphite-500">
                <CircleDollarSign size={12} strokeWidth={1.4} className="text-gold-300/80" /> Invoices on file
              </p>
              {state?.invoices.length ? (
                <ul className="mt-5 divide-y divide-ivory-200/[0.06]">
                  {state.invoices.map((invoice) => (
                    <li key={invoice.id} className="py-3.5">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="min-w-0 truncate text-[13px] text-ivory-100">{invoice.number}</span>
                        <span className="shrink-0 text-[12.5px] tabular-nums text-graphite-100">{formatMoney(invoice.amountCents, { currency: invoice.currency })}</span>
                      </div>
                      <p className="mt-1.5 text-[11.5px] leading-relaxed text-graphite-500">{invoice.description}</p>
                      <p className="mt-1 text-[10.5px] uppercase tracking-[0.16em] text-graphite-600">
                        {humanise(invoice.status, STATUS_LABEL)} · {formatDate(invoice.issuedAt, 'medium', user.timezone)}
                        {invoice.paidAt ? ' · settled' : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-5 text-[12.5px] leading-relaxed text-graphite-400">{T("No invoice has been raised against this account. The first follows the checkout confirmation, not the click.")}</p>
              )}

              <p className="mt-auto pt-8 text-[11.5px] leading-relaxed text-graphite-500">
                <Lock size={11} strokeWidth={1.5} className="mr-1.5 inline align-[-1px] text-gold-300/70" />
                Prices are a single list in <code className="text-graphite-300">src/lib/utils/format.ts</code>{T(". Changing the number there changes this page, the API, the admin console and the checkout amount — no migration, no second place to remember.")}</p>
            </div>
          </div>
        </Section>
      ) : (
        <Section
          eyebrow={user ? 'Your account' : 'Getting in'}
          title={user ? 'No membership on this account yet' : 'Membership begins with a conversation'}
          lede={
            user
              ? 'Choose a level above and it is attached to this account. Everything below that line — residences, people, ledger, documents — opens at once, and nothing is charged where no provider is connected.'
              : 'We do not sell a self-serve licence to households with staff on payroll. Tell us what you run and the office confirms the level, the response window and the names assigned before anything is billed.'
          }
          tone="raised"
          titleSize="md"
        >
          <div className="flex flex-wrap gap-3">
            {user ? null : (
              <>
                <ButtonLink href="/access/request">{T("Request access")}</ButtonLink>
                <ButtonLink href="/login" quiet>{T("I already have an account")}</ButtonLink>
              </>
            )}
            <ButtonLink href="/security" quiet>{T("How data is held")}</ButtonLink>
            <ButtonLink href="/terms" quiet>
              Terms & pricing
            </ButtonLink>
          </div>
        </Section>
      )}

      <Section eyebrow="Every level includes" title="What you are entitled to whatever you pay" titleSize="md">
        <div className="grid gap-px overflow-hidden rounded-[6px] border border-ivory-200/[0.07] bg-ivory-200/[0.06] sm:grid-cols-2">
          {INCLUDED.map((item, index) => (
            <Reveal key={item.title} delay={index * 0.06} className="h-full">
              <div className="flex h-full flex-col bg-ink-950 p-8">
                <p className="font-serif text-[1.15rem] leading-snug text-ivory-50">{item.title}</p>
                <p className="mt-3 text-[13px] leading-relaxed text-graphite-300">{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section eyebrow="Billing" title="How payment is handled here" lede="Written as it is implemented, including what is not switched on in this deployment." tone="raised" titleSize="md">
        <dl className="divide-y divide-ivory-200/[0.06] border-y border-ivory-200/[0.06]">
          {HOW_BILLING_WORKS.map((row) => (
            <div key={row.label} className="grid gap-2 py-5 sm:grid-cols-[220px_1fr] sm:gap-8">
              <dt className="text-[11px] uppercase tracking-[0.2em] text-gold-300/80">{row.label}</dt>
              <dd className="max-w-2xl text-[13.5px] leading-relaxed text-graphite-200">{row.value}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-8 text-[12px] leading-relaxed text-graphite-500">
          Current list, monthly: {MEMBERSHIP_PLANS.map((entry) => `${entry.name} ${entry.price_label}`).join(' · ')}.{' '}
          Annual billing is priced per plan ({MEMBERSHIP_PLANS.map((entry) => (entry.annual_discount_pct ? `${entry.name} −${entry.annual_discount_pct}%` : `${entry.name} no discount`)).join(', ')}) —
          those percentages live in the same list as the prices, so the page, the API and the checkout can never disagree.
        </p>
      </Section>
    </div>
  );
}

function ButtonLink({ href, children, quiet }: { href: string; children: React.ReactNode; quiet?: boolean }) {
  const T = getT();
  return (
    <Link
      href={href}
      className={
        quiet
          ? 'inline-flex h-11 items-center rounded-[3px] border border-ivory-200/12 px-6 text-[11px] uppercase tracking-[0.2em] text-graphite-200 transition-all duration-300 hover:border-ivory-200/30 hover:text-ivory-50'
          : 'inline-flex h-11 items-center rounded-[3px] border border-gold-400/45 bg-gold-400/[0.06] px-7 text-[11px] uppercase tracking-[0.22em] text-gold-100 transition-all duration-300 hover:border-gold-300 hover:bg-gold-400/[0.12]'
      }
    >
      {children}
    </Link>
  );
}
