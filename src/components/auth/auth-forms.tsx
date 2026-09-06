'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { ApiClientError, apiRequest } from '@/lib/http/client';
import { COUNTRIES, cn } from '@/lib/utils/format';

/* --------------------------------------------------------------- login */

export type DemoAccount = { label: string; detail: string; email: string; password: string };

export function LoginForm({ demoAccounts = [] }: { demoAccounts?: DemoAccount[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = params.get('next') || '';

  useEffect(() => {
    if (params.get('signedOut')) toast.push({ title: 'You have been signed out.', tone: 'default' });
    if (params.get('expired')) toast.push({ title: 'Your session ended. Please sign in again.', tone: 'attention' });
  }, [params, toast]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const data = await apiRequest<{ redirect?: string }>('/api/auth/login', { method: 'POST', body: { email, password } });
      toast.success('Welcome back.');
      router.replace(next || data?.redirect || '/dashboard');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Sign in is unavailable right now.');
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <TextField
        label="Email address"
        type="email"
        name="email"
        autoComplete="username"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@household.com"
      />
      <TextField
        label="Passphrase"
        type="password"
        name="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="••••••••••••"
      />

      {error ? (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="rounded-[3px] border border-state-risk/35 bg-state-risk/[0.07] px-4 py-3 text-[12.5px] leading-relaxed text-state-risk"
        >
          {error}
        </motion.p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" loading={pending} trailingIcon={<ArrowRight size={14} strokeWidth={1.4} />}>
        Enter the platform
      </Button>

      <div className="flex items-center justify-between pt-1 text-[11.5px]">
        <Link href="/forgot-password" className="text-graphite-400 transition-colors hover:text-ivory-100">
          Forgotten your passphrase?
        </Link>
        <Link href="/access/request" className="text-gold-200 transition-colors hover:text-gold-100">
          Request access
        </Link>
      </div>

      <DemoAccess accounts={demoAccounts} onPick={(values) => { setEmail(values.email); setPassword(values.password); setError(null); }} />
    </form>
  );
}

/**
 * The demonstration accounts exist so the product can be evaluated. They are
 * only rendered outside production, and their credentials live in the seed
 * file — the same one a developer would delete for a real deployment.
 */
function DemoAccess({ accounts, onPick }: { accounts: DemoAccount[]; onPick: (values: { email: string; password: string }) => void }) {
  const [open, setOpen] = useState(false);
  if (!accounts.length) return null;

  return (
    <div className="mt-2 rounded-[4px] border border-ivory-200/[0.09] bg-ink-950/60">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2.5 text-[11px] uppercase tracking-[0.2em] text-graphite-300">
          <ShieldCheck size={13} className="text-gold-300/80" strokeWidth={1.4} />
          Demonstration accounts
        </span>
        <span className={cn('text-graphite-500 transition-transform duration-300', open && 'rotate-90')}>
          <ArrowRight size={13} />
        </span>
      </button>
      {open ? (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
          <div className="space-y-2 border-t border-ivory-200/[0.07] p-4">
            <p className="text-[12px] leading-relaxed text-graphite-400">
              Fictional data, generated locally in <code className="text-graphite-200">data/velora.db</code>. No email, no payment and no external
              service is contacted.
            </p>
            {accounts.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => onPick({ email: account.email, password: account.password })}
                className="group flex w-full items-center justify-between gap-4 rounded-[3px] border border-ivory-200/[0.08] bg-ink-900/60 px-3.5 py-3 text-left transition-all duration-300 hover:border-gold-400/40 hover:bg-ink-850"
              >
                <span>
                  <span className="block text-[12.5px] text-ivory-100">{account.label}</span>
                  <span className="mt-0.5 block text-[11px] text-graphite-500">{account.detail}</span>
                </span>
                <span className="text-right">
                  <span className="block text-[11px] text-graphite-300">{account.email}</span>
                  <span className="mt-0.5 block text-[10.5px] text-graphite-500">{account.password}</span>
                </span>
              </button>
            ))}
            <p className="pt-1 text-[10.5px] uppercase tracking-[0.18em] text-graphite-500">Selecting fills the form — nothing is sent yet</p>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ register */

export function RegisterForm() {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState({ firstName: '', lastName: '', email: '', password: '', country: '', accept: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [general, setGeneral] = useState<string | null>(null);

  const strength = (() => {
    const value = values.password;
    const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter((re) => re.test(value)).length;
    const length = value.length >= 16 ? 2 : value.length >= 12 ? 1 : 0;
    return Math.max(0, Math.min(4, classes - 1 + length));
  })();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const localErrors: Record<string, string> = {};
    if (values.firstName.trim().length < 2) localErrors.firstName = 'Please provide a first name.';
    if (values.lastName.trim().length < 2) localErrors.lastName = 'Please provide a last name.';
    if (!/^\S+@\S+\.\S+$/.test(values.email)) localErrors.email = 'Enter a valid email address.';
    if (values.password.length < 12) localErrors.password = 'Use at least 12 characters.';
    if (!values.accept) localErrors.accept = 'Please confirm to continue.';
    setErrors(localErrors);
    if (Object.keys(localErrors).length) return;

    setPending(true);
    setGeneral(null);
    try {
      await apiRequest('/api/auth/register', {
        method: 'POST',
        body: {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim(),
          password: values.password,
          country: values.country || undefined,
          acceptTerms: true,
        },
      });
      toast.success('Your private office is open', 'A starter residence has been created for you.');
      router.replace('/dashboard');
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setErrors(caught.fields);
        setGeneral(Object.keys(caught.fields).length ? null : caught.message);
      } else {
        setGeneral('Registration is unavailable right now.');
      }
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="First name" value={values.firstName} onChange={(e) => setValues({ ...values, firstName: e.target.value })} error={errors.firstName} autoComplete="given-name" required />
        <TextField label="Last name" value={values.lastName} onChange={(e) => setValues({ ...values, lastName: e.target.value })} error={errors.lastName} autoComplete="family-name" required />
      </div>
      <TextField
        label="Email address"
        type="email"
        value={values.email}
        onChange={(e) => setValues({ ...values, email: e.target.value })}
        error={errors.email}
        autoComplete="username"
        required
      />
      <div>
        <TextField
          label="Choose a passphrase"
          type="password"
          value={values.password}
          onChange={(e) => setValues({ ...values, password: e.target.value })}
          error={errors.password}
          autoComplete="new-password"
          hint="Twelve characters or more, with a number and a capital."
          required
        />
        {values.password ? (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex flex-1 gap-1.5">
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={cn(
                    'h-[3px] flex-1 rounded-full transition-all duration-500',
                    index < strength ? (strength >= 3 ? 'bg-state-ok' : strength === 2 ? 'bg-gold-400' : 'bg-graphite-400') : 'bg-ivory-200/10',
                  )}
                />
              ))}
            </div>
            <span className="text-[10.5px] uppercase tracking-[0.18em] text-graphite-500">
              {strength >= 4 ? 'Strong' : strength === 3 ? 'Good' : strength === 2 ? 'Fair' : 'Weak'}
            </span>
          </div>
        ) : null}
      </div>
      <SelectField
        label="Country of residence"
        value={values.country}
        onChange={(e) => setValues({ ...values, country: e.target.value })}
        placeholder="Select"
        options={COUNTRIES.map((country) => ({ value: country, label: country }))}
      />
      <label className="flex cursor-pointer items-start gap-3 pt-1">
        <input
          type="checkbox"
          checked={values.accept}
          onChange={(e) => setValues({ ...values, accept: e.target.checked })}
          className="mt-[3px] h-3.5 w-3.5 shrink-0 appearance-none rounded-[2px] border border-ivory-200/25 bg-ink-950 transition-colors checked:border-gold-400 checked:bg-gold-400/80"
        />
        <span className="text-[12.5px] leading-relaxed text-graphite-300">
          I understand VELORA records and coordinates, and does not provide legal, tax or financial advice.
          {errors.accept ? <span className="mt-1 block text-state-risk">{errors.accept}</span> : null}
        </span>
      </label>

      {general ? (
        <p role="alert" className="rounded-[3px] border border-state-risk/35 bg-state-risk/[0.07] px-4 py-3 text-[12.5px] text-state-risk">
          {general}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Open my account
      </Button>

      <p className="text-center text-[12px] text-graphite-400">
        Already a member?{' '}
        <Link href="/login" className="text-gold-200 transition-colors hover:text-gold-100">
          Sign in
        </Link>
      </p>
    </form>
  );
}

/* --------------------------------------------------- forgot + reset */

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<{ message: string; devLink?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const data = await apiRequest<{ message: string; devLink?: string }>('/api/auth/forgot-password', { method: 'POST', body: { email } });
      setSent({ message: data.message, devLink: data.devLink });
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'That request could not be completed.');
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-6">
        <div className="rounded-[4px] border border-state-ok/30 bg-state-ok/[0.05] px-5 py-5">
          <p className="font-serif text-[1.15rem] text-ivory-50">Instruction sent</p>
          <p className="mt-2 text-[13px] leading-relaxed text-graphite-300">{sent.message}</p>
        </div>
        {sent.devLink ? (
          <div className="rounded-[4px] border border-gold-400/25 bg-gold-400/[0.04] px-5 py-4">
            <p className="label mb-2.5 text-gold-300/80">Local build · no mail transport</p>
            <p className="text-[12.5px] leading-relaxed text-graphite-300">
              SMTP is not configured in this environment, so the reset link is shown here instead of emailed.
            </p>
            <a href={sent.devLink} className="mt-3 inline-block break-all text-[12.5px] text-gold-200 underline decoration-gold-400/40 underline-offset-4 transition-colors hover:text-gold-100">
              Continue with the reset link →
            </a>
          </div>
        ) : null}
        <Link href="/login" className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-graphite-300 transition-colors hover:text-ivory-100">
          <ArrowLeft size={12} /> Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <TextField
        label="Email address on your account"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error ?? undefined}
        autoComplete="username"
        required
      />
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Send reset instruction
      </Button>
      <p className="text-[12px] leading-relaxed text-graphite-500">
        For your protection, we answer the same way whether or not the address is known to us. Reset links expire in thirty minutes and can be used
        once.
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 12) return setError('Use at least 12 characters.');
    if (password !== confirm) return setError('The two entries do not match.');
    setPending(true);
    setError(null);
    try {
      await apiRequest('/api/auth/reset', { method: 'POST', body: { token, password } });
      toast.success('Passphrase updated', 'You may sign in on this device again.');
      router.replace('/login');
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'That reset link is not valid.');
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <TextField label="New passphrase" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required hint="Minimum twelve characters." />
      <TextField label="Repeat new passphrase" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required error={error ?? undefined} />
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Update passphrase
      </Button>
    </form>
  );
}
