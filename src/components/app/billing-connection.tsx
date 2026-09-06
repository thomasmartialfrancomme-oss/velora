'use client';

/**
 * Connecting the operator's own Stripe account, from inside the console.
 *
 * The alternative is a nine-line environment recipe, which is fine once and
 * miserable every time something moves. Here one pasted secret key is enough: the
 * server verifies it against Stripe's `/v1/account`, creates or finds the products,
 * prices, portal configuration and webhook endpoint, and stores both keys encrypted.
 *
 * What this component will not do:
 *  • show a stored key back — only `sk_live_…4242` and the account it belongs to;
 *  • claim a rail works. A payment method Stripe has not approved on the account is
 *    reported as missing and links to the Dashboard, because the approval is a
 *    contract between that account and Stripe, not something a site can sign;
 *  • hide the difference between test and live. The mode is printed next to the key.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { ApiClientError, apiRequest } from '@/lib/http/client';
import { useApiForm } from '@/lib/hooks/use-api-form';
import { useT } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/format';

export interface ConnectionView {
  configured: boolean;
  mode: string;
  source: string;
  maskedKey: string;
  hasWebhookSecret: boolean;
  paymentMethods: string;
  transferDueDays: number;
  portalConfigurationId: string;
  webhookEndpointId: string;
  account: { id: string; name: string; country: string; connectedAt: string; chargesEnabled: boolean; detailsSubmitted: boolean };
  pricesConfigured: number;
}

export interface BillingView {
  stripeConfigured: boolean;
  mode: string;
  label: string;
  note: string;
  methodsSummary: string;
  monthlyAvailable: boolean;
  transferAvailable: boolean;
  transferDueDays: number;
  unknownMethods: string[];
  pricesConfigured: number;
  pricesComplete: boolean;
}

interface Outcome {
  accountId: string;
  accountName: string;
  country: string;
  mode: string;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  paymentMethods: string;
  railsApproved: string[];
  railsNotApproved: string[];
  pricesCreated: number;
  pricesReused: number;
  portalCreated: boolean;
  webhookCreated: boolean;
  webhookSecretKnown: boolean;
  warnings: string[];
}

export function BillingConnection({ connection, billing }: { connection: ConnectionView; billing: BillingView }) {
  const T = useT();
  const toast = useToast();
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [disconnecting, setDisconnecting] = useState(false);

  const form = useApiForm<{ secretKey: string; webhookSecret: string; paymentMethods: string }>({
    path: '/api/admin/billing-connection',
    method: 'POST',
    initialValues: { secretKey: '', webhookSecret: '', paymentMethods: '' },
    validate: (values) => {
      const errors: Record<string, string> = {};
      if (!/^sk_(test|live)_[A-Za-z0-9_]{4,}$/.test(values.secretKey.trim())) {
        errors.secretKey = T('A Stripe secret key starts with sk_test_ or sk_live_.');
      }
      if (values.webhookSecret.trim() && !/^whsec_[A-Za-z0-9_]{4,}$/.test(values.webhookSecret.trim())) {
        errors.webhookSecret = T('A webhook signing secret starts with whsec_.');
      }
      return errors;
    },
    prepare: (values) => ({
      secretKey: values.secretKey.trim(),
      ...(values.webhookSecret.trim() ? { webhookSecret: values.webhookSecret.trim() } : {}),
      ...(values.paymentMethods.trim() ? { paymentMethods: values.paymentMethods.trim() } : {}),
    }),
    success: { message: T('Stripe account connected'), description: T('Products, prices, the customer portal and the webhook were checked against your account.') },
    onDone: (data) => {
      setOutcome((data as { outcome?: Outcome })?.outcome ?? null);
      // The typed key must not survive on screen once the connection exists.
      form.reset();
    },
  });

  async function disconnect() {
    setDisconnecting(true);
    try {
      const result = await apiRequest<{ note: string }>('/api/admin/billing-connection', {
        method: 'DELETE',
        body: { confirm: 'DISCONNECT' },
      });
      toast.success(T('Disconnected'), result.note);
      setConfirmText('');
      setOutcome(null);
      router.refresh();
    } catch (error) {
      toast.error(T('Disconnection failed'), error instanceof ApiClientError ? error.message : T('Unexpected error.'));
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-[12px] leading-relaxed text-graphite-400">
        {T(
          'Paste the secret key of the Stripe account that should receive the money. The product verifies it, creates what is missing in that account and remembers it encrypted — no card data or bank details ever pass through here.',
        )}
      </p>

      {connection.configured ? (
        <div className="rounded-[5px] border border-ivory-200/[0.09] bg-ink-950/60 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="font-display text-[16px] text-ivory-50">{billing.label}</p>
            <span
              className={cn(
                'rounded-[2px] border px-2 py-0.5 text-[9.5px] uppercase tracking-[0.18em]',
                connection.mode === 'live' ? 'border-state-ok/40 text-state-ok' : 'border-ivory-200/15 text-graphite-300',
              )}
            >
              {connection.mode === 'live' ? T('live money') : connection.mode === 'test' ? T('test mode') : connection.mode}
            </span>
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-[12px] sm:grid-cols-2">
            {[
              [T('Account'), `${connection.account.name || '—'}${connection.account.country ? ` · ${connection.account.country}` : ''}`],
              [T('Key'), `${connection.maskedKey || '—'} · ${connection.source === 'env' ? T('from the environment') : T('from this console')}`],
              [T('Rails offered'), billing.methodsSummary],
              [T('Prices found'), `${billing.pricesConfigured}/6 ${billing.pricesComplete ? '' : T('— incomplete, a plan cannot be sold yet')}`],
              [T('Webhook trust'), connection.hasWebhookSecret ? T('signing secret known') : T('no signing secret — events would be rejected')],
              [T('Paid by transfer'), billing.transferAvailable ? `${T('yes')} · ${T('annual only')}` : T('not enabled')],
              [T('Monthly renewals'), billing.monthlyAvailable ? T('possible with the enabled rails') : T('impossible — no renewable rail is enabled')],
              [T('Connected'), connection.account.connectedAt ? new Date(connection.account.connectedAt).toLocaleString() : '—'],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-[10px] uppercase tracking-[0.16em] text-graphite-600">{label}</dt>
                <dd className="mt-0.5 text-graphite-200">{value}</dd>
              </div>
            ))}
          </dl>

          {!connection.account.chargesEnabled ? (
            <p className="mt-3 text-[11.5px] leading-relaxed text-state-risk">
              {T('Stripe says this account cannot charge yet — finish the activation in the Dashboard, or members will see a decline at checkout.')}{' '}
              <Link href="https://dashboard.stripe.com/settings" className="text-gold-200 underline-offset-4 hover:underline">
                {T('Open Stripe Dashboard')}
              </Link>
            </p>
          ) : null}

          {billing.unknownMethods.length ? (
            <p className="mt-3 text-[11.5px] leading-relaxed text-state-risk">
              {T('Rails this product does not know, so they were ignored')}: <code className="text-graphite-200">{billing.unknownMethods.join(', ')}</code>.
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ivory-200/[0.07] pt-4">
            <label className="flex flex-1 items-center gap-3 text-[11.5px] text-graphite-400">
              <span>{T('Type DISCONNECT to forget this account')}</span>
              <input
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                className="min-w-[9rem] flex-1 rounded-[3px] border border-ivory-200/12 bg-ink-900 px-2 py-1 text-[12px] text-ivory-50 outline-none focus:border-gold-400/60"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <Button variant="danger" size="sm" onClick={disconnect} disabled={confirmText !== 'DISCONNECT' || disconnecting}>
              {disconnecting ? T('Working…') : T('Disconnect')}
            </Button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.submit();
          }}
          className="space-y-4"
        >
          <TextField
            label={T('Stripe secret key')}
            type="password"
            value={form.values.secretKey}
            onChange={(event) => form.setField('secretKey', event.target.value)}
            placeholder="sk_live_…"
            autoComplete="off"
            spellCheck={false}
            error={form.errors.secretKey}
            hint={T('Developers → API keys. A test key stays in test mode; nothing is ever charged by mistake.')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={T('Webhook signing secret')}
              type="password"
              value={form.values.webhookSecret}
              onChange={(event) => form.setField('webhookSecret', event.target.value)}
              placeholder={T('optional — read from the endpoint this creates')}
              autoComplete="off"
              spellCheck={false}
              error={form.errors.webhookSecret}
            />
            <TextField
              label={T('Rails to offer')}
              value={form.values.paymentMethods}
              onChange={(event) => form.setField('paymentMethods', event.target.value)}
              placeholder="card, sepa_debit, bank_transfer"
              autoComplete="off"
              spellCheck={false}
              error={form.errors.paymentMethods}
              hint={T('optional — by default whatever Stripe says your account is approved for')}
            />
          </div>

          {form.formError ? <p className="text-[11.5px] leading-relaxed text-state-risk">{form.formError}</p> : null}

          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" size="sm" variant="primary" disabled={form.pending || !form.values.secretKey.trim()}>
              {form.pending ? T('Working…') : T('Connect this account')}
            </Button>
            <p className="text-[11px] leading-relaxed text-graphite-500">
              {T('Verified against Stripe before anything is stored. Nothing is charged by this action.')}
            </p>
          </div>
        </form>
      )}

      {outcome ? (
        <div className="rounded-[5px] border border-state-ok/25 bg-state-ok/[0.04] p-4 text-[12px] leading-relaxed text-graphite-200">
          <p>
            {outcome.accountName} · {outcome.mode} —{' '}
            {outcome.pricesCreated > 0
              ? T('prices created')
              : T('existing prices reused')}
            : {outcome.pricesCreated} {T('created')}, {outcome.pricesReused} {T('reused')}.{' '}
            {outcome.portalCreated ? T('Customer portal configured.') : T('Customer portal already existed, reused.')}{' '}
            {outcome.webhookCreated ? T('Webhook endpoint created, signing secret stored.') : T('Webhook endpoint already existed.')}
          </p>
          <p className="mt-2">
            {T('Rails approved on your account')}: {outcome.railsApproved.length ? outcome.railsApproved.join(', ') : T('none — only card will be offered')}
            {outcome.railsNotApproved.length ? (
              <>
                {' · '}
                <span className="text-graphite-400">
                  {T('not approved')}: {outcome.railsNotApproved.join(', ')} —{' '}
                  <Link href="https://dashboard.stripe.com/settings/payment_methods" className="text-gold-200 underline-offset-4 hover:underline">
                    {T('enable them in the Dashboard')}
                  </Link>
                </span>
              </>
            ) : null}
            .
          </p>
          {outcome.warnings.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[11.5px] text-gold-200">
              {outcome.warnings.map((warning) => (
                <li key={warning.slice(0, 24)}>{warning}</li>
              ))}
            </ul>
          ) : null}
          {!outcome.webhookSecretKnown ? (
            <p className="mt-2 text-[11.5px] text-state-risk">
              {T('Without a signing secret, paid confirmations from Stripe cannot be trusted, so a membership will stay pending. Paste the whsec_ value into the field above and connect again.')}
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="text-[11px] leading-relaxed text-graphite-600">
        {T(
          'The key is stored in this database encrypted with AUTH_SECRET and is never sent back to a page. Enabling a payment method is a contract between your account and Stripe: nothing here can sign it for you.',
        )}
      </p>
    </div>
  );
}
