'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { ApiClientError, apiRequest } from '@/lib/http/client';
import { MEMBERSHIP_PLANS, cn, formatMoney } from '@/lib/utils/format';
import type { PlanKey } from '@/lib/utils/format';

type Cycle = 'monthly' | 'annual';

interface Intent {
  provider?: 'demo' | 'stripe';
  simulated?: boolean;
  redirect?: string | null;
  message?: string;
}

function messageFor(caught: unknown): string {
  if (caught instanceof ApiClientError) return caught.message;
  if (caught instanceof Error) return caught.message;
  return 'The office could not reach the billing provider. Nothing was changed.';
}

/* ============================================================ plan matrix */

export function PlanMatrix({
  signedIn,
  currentPlan,
  stripeConfigured,
  initialPlan,
}: {
  signedIn: boolean;
  currentPlan: string | null;
  stripeConfigured: boolean;
  initialPlan?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'attention'; text: string } | null>(null);

  function priceFor(plan: (typeof MEMBERSHIP_PLANS)[number]): number {
    if (cycle === 'monthly') return plan.price_cents_monthly;
    return Math.round(plan.price_cents_monthly * 12 * (1 - plan.annual_discount_pct / 100));
  }

  async function choose(key: PlanKey) {
    setBusy(key);
    setNotice(null);
    try {
      const data = await apiRequest<Intent>('/api/membership/subscribe', { method: 'POST', body: { plan: key, billingCycle: cycle } });
      if (data?.redirect && /^https?:\/\//.test(data.redirect)) {
        window.location.assign(data.redirect);
        return;
      }
      setNotice({ tone: data?.simulated ? 'attention' : 'ok', text: data?.message ?? 'Your membership has been updated.' });
      toast.success('Membership updated', data?.simulated ? 'Recorded in the platform. No payment was taken.' : 'The billing provider has the instruction.');
      router.refresh();
    } catch (caught) {
      setNotice({ tone: 'attention', text: messageFor(caught) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="inline-flex items-center gap-1 rounded-[4px] border border-ivory-200/[0.09] bg-ink-950/60 p-1" role="group" aria-label="Billing cycle">
          {(['monthly', 'annual'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={cycle === option}
              onClick={() => setCycle(option)}
              className={cn(
                'h-8 rounded-[3px] px-4 text-[10.5px] uppercase tracking-[0.2em] transition-all duration-300 ease-lux',
                cycle === option ? 'bg-ivory-100 text-ink-1000' : 'text-graphite-300 hover:text-ivory-100',
              )}
            >
              {option === 'monthly' ? 'Monthly' : 'Annual'}
            </button>
          ))}
        </div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-graphite-500">
          {stripeConfigured ? 'Stripe keys detected · real checkout' : 'No payment provider connected · no card, no charge'}
        </p>
        <p className="text-[11.5px] text-graphite-500">
          Annual billing is priced per plan: {MEMBERSHIP_PLANS.filter((entry) => entry.annual_discount_pct > 0).map((entry) => `${entry.name} ${entry.annual_discount_pct}%`).join(' · ')}
          {MEMBERSHIP_PLANS.some((entry) => entry.annual_discount_pct === 0) ? ' · invoiced once, no discount' : ''}.
        </p>
      </div>

      {notice ? (
        <p
          className={cn(
            'rounded-[4px] border px-5 py-3.5 text-[12.5px] leading-relaxed',
            notice.tone === 'ok' ? 'border-state-ok/30 bg-state-ok/[0.05] text-ivory-100' : 'border-gold-400/30 bg-gold-400/[0.05] text-gold-100',
          )}
          role="status"
        >
          {notice.text}
        </p>
      ) : null}

      <div className="grid gap-px overflow-hidden rounded-[6px] border border-ivory-200/[0.07] bg-ivory-200/[0.06] lg:grid-cols-3">
        {MEMBERSHIP_PLANS.map((plan) => {
          const isCurrent = plan.key === currentPlan;
          const highlighted = plan.key === initialPlan;
          const amount = priceFor(plan);
          return (
            <div key={plan.key} className={cn('relative flex flex-col bg-ink-950 p-8 sm:p-9', (plan.featured || highlighted) && 'bg-ink-900')}>
              {plan.featured || highlighted ? <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/70 to-transparent" aria-hidden /> : null}

              <div className="flex items-baseline justify-between gap-4">
                <p className="font-serif text-[1.3rem] uppercase tracking-[0.16em] text-ivory-50">{plan.name}</p>
                {isCurrent ? <Badge>Current</Badge> : plan.featured ? <span className="text-[9.5px] uppercase tracking-[0.24em] text-gold-300">Most chosen</span> : null}
              </div>

              <p className="mt-4 text-[13px] leading-relaxed text-graphite-300">{plan.positioning}</p>

              <p className="mt-8 flex items-baseline gap-3">
                <span className="font-serif text-[2.4rem] leading-none text-ivory-50 tabular-nums">{formatMoney(amount, { currency: 'EUR' })}</span>
                <span className="text-[10.5px] uppercase tracking-[0.2em] text-graphite-400">
                  {cycle === 'annual' ? (plan.annual_discount_pct ? `per year · ${plan.annual_discount_pct}% off` : 'per year · one invoice') : 'per month'}
                </span>
              </p>

              <dl className="mt-8 space-y-2.5 border-t border-ivory-200/[0.07] pt-6 text-[12.5px]">
                {[
                  ['Residences', plan.residences_included === 99 ? 'Unlimited' : String(plan.residences_included)],
                  ['People in the directory', plan.staff_directory_limit === null ? 'No ceiling' : String(plan.staff_directory_limit)],
                  ['Coordinator', plan.ai_requests_per_day === 'unlimited' ? 'Unlimited requests' : `${plan.ai_requests_per_day} requests a day`],
                  ['Human concierge', plan.human_concierge],
                  ['Response', plan.response_sla],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-4">
                    <dt className="text-graphite-500">{label}</dt>
                    <dd className="text-right text-graphite-100">{value}</dd>
                  </div>
                ))}
              </dl>

              <ul className="mt-6 space-y-2.5 border-t border-ivory-200/[0.07] pt-6 text-[12.5px] text-graphite-200">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3">
                    <span className="mt-[7px] h-px w-3 shrink-0 bg-gold-400/50" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-9 flex items-center justify-end gap-3 border-t border-ivory-200/[0.07] pt-6">
                {signedIn ? (
                  <Button
                    variant={isCurrent ? 'secondary' : highlighted || plan.featured ? 'primary' : 'gold-outline'}
                    size="md"
                    className="flex-1"
                    disabled={isCurrent}
                    loading={busy === plan.key}
                    onClick={() => void choose(plan.key)}
                  >
                    {isCurrent ? 'Current membership' : busy === plan.key ? 'One moment' : `Switch to ${plan.name.toLowerCase() === 'private office' ? 'Private Office' : plan.name.toLowerCase() === 'private' ? 'Private' : 'Priority'}`}
                  </Button>
                ) : (
                  <Button asLink href={`/register?plan=${plan.key}`} variant="gold-outline" size="md" className="flex-1" trailingIcon={<ArrowUpRight size={13} className="transition-transform duration-300 group-hover:translate-x-0.5" />}>
                    Request this
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11.5px] leading-relaxed text-graphite-500">
        {signedIn
          ? 'Switching takes effect on this account immediately. Where a payment provider is connected you are sent to its checkout and nothing is marked paid until it tells us so; where one is not, the membership is recorded here and no money moves.'
          : 'Membership begins by request. Tell us the households and residences involved, and the office confirms the level before anything is billed.'}
      </p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[3px] border border-gold-400/40 px-2 py-[3px] text-[9.5px] uppercase tracking-[0.2em] text-gold-200">
      <ShieldCheck size={10} strokeWidth={1.5} /> {children}
    </span>
  );
}

/* ============================================================ billing controls */

export function BillingControls({
  hasSubscription,
  cancelAtPeriodEnd,
  stripeConfigured,
  status,
}: {
  hasSubscription: boolean;
  cancelAtPeriodEnd: boolean;
  stripeConfigured: boolean;
  status: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | 'period' | 'now'>(null);

  async function call(path: string, body?: unknown) {
    setPending(path);
    setNotice(null);
    try {
      const data = await apiRequest<Intent>(path, { method: 'POST', body });
      if (data?.redirect && /^https?:\/\//.test(data.redirect)) {
        window.location.assign(data.redirect);
        return;
      }
      setNotice(data?.message ?? 'Done.');
      toast.success('Recorded', data?.simulated ? 'Handled inside the platform — no external call was made.' : data?.message ?? 'The billing provider has the instruction.');
      router.refresh();
    } catch (caught) {
      setNotice(messageFor(caught));
      setDialog(null);
    } finally {
      setPending(null);
    }
  }

  if (!hasSubscription) {
    return (
      <p className="text-[12.5px] leading-relaxed text-graphite-400">
        There is no subscription attached to this account yet. Choose a level above and it is created the moment you confirm — no trial clock, no card on
        file beforehand.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Button variant="secondary" size="sm" loading={pending === '/api/membership/portal'} onClick={() => void call('/api/membership/portal')}>
          {stripeConfigured ? 'Payment portal' : 'Portal needs Stripe'}
        </Button>
        {cancelAtPeriodEnd ? (
          <Button variant="gold-outline" size="sm" loading={pending === '/api/membership/resume'} onClick={() => void call('/api/membership/resume')}>
            Keep the membership
          </Button>
        ) : status !== 'cancelled' ? (
          <Button variant="danger" size="sm" onClick={() => setDialog('period')}>
            End at period close
          </Button>
        ) : null}
        {!cancelAtPeriodEnd && status !== 'cancelled' ? (
          <Button variant="ghost" size="sm" onClick={() => setDialog('now')}>
            End immediately
          </Button>
        ) : null}
      </div>

      <p className="text-[11.5px] leading-relaxed text-graphite-500">
        {stripeConfigured
          ? 'The portal is Stripe’s own screen: cards, invoices and address live there, not with us.'
          : 'Without a payment provider there is no portal to open — the membership state is kept in this platform’s own database, and ending it is a local record change.'}
      </p>

      {notice ? (
        <p role="status" className="rounded-[4px] border border-ivory-200/[0.09] bg-ink-950/60 px-4 py-3 text-[12.5px] leading-relaxed text-graphite-100">
          {notice}
        </p>
      ) : null}

      <ConfirmDialog
        open={dialog === 'period'}
        title="End the membership at the close of the period?"
        confirmLabel="Schedule the end"
        busy={pending !== null}
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          void call('/api/membership/cancel', { immediate: false });
        }}
        body={
          <p>
            Nothing is cut off today. Your residences, ledger, documents and coordinator history stay readable until{' '}
            <span className="text-ivory-50">the current period closes</span>, and the decision can be withdrawn in this same panel until then.
          </p>
        }
      />

      <ConfirmDialog
        open={dialog === 'now'}
        title="End the membership immediately?"
        confirmLabel="End it now"
        tone="danger"
        word="END MEMBERSHIP"
        busy={pending !== null}
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          void call('/api/membership/cancel', { immediate: true });
        }}
        body={
          <div className="space-y-3">
            <p>Access to the modules is withdrawn at once and any open invoice is voided. Your records are retained for thirty days in case you return; after that they are erased on request or on schedule.</p>
            <p className="text-[12px] text-graphite-400">Type the phrase to confirm.</p>
          </div>
        }
      />
    </div>
  );
}

