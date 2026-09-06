'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelectField, TextArea, TextField } from '@/components/ui/field';
import { apiRequest } from '@/lib/http/client';
import { COUNTRIES, PRIMARY_REQUIREMENTS } from '@/lib/utils/format';

type Submitted = { message: string; duplicate?: boolean };

export function AccessRequestForm() {
  const [values, setValues] = useState({
    firstName: '',
    lastName: '',
    email: '',
    country: '',
    residences: '2',
    primaryRequirement: '',
    message: '',
    website: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    try {
      const data = await apiRequest<Submitted>('/api/access-requests', {
        method: 'POST',
        body: {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim(),
          country: values.country,
          residences: Number(values.residences),
          primaryRequirement: values.primaryRequirement,
          message: values.message.trim() || null,
          website: values.website,
        },
      });
      setSubmitted({ message: data.message, duplicate: data.duplicate });
    } catch (caught) {
      const error = caught as { message?: string; fields?: Record<string, string> };
      setErrors(error.fields ?? {});
      if (!error.fields && error.message) setErrors({ form: error.message });
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        <div className="rounded-[6px] border border-ivory-200/[0.1] bg-ink-950 p-9 sm:p-10">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gold-400/40 text-gold-300">
            <Check size={16} strokeWidth={1.4} />
          </span>
          <p className="mt-7 font-serif text-[1.7rem] font-light leading-[1.3] text-ivory-50">{submitted.message}</p>
          <p className="mt-5 text-[13.5px] leading-relaxed text-graphite-300">
            {submitted.duplicate
              ? 'We already hold a request under that address. It has been refreshed rather than duplicated, and the private office reviews the queue each morning.'
              : 'A member of the private office will write to you personally within two working days. Nothing is sent to anyone else, and the details above are not used for marketing.'}
          </p>
          <ol className="mt-8 space-y-3.5 border-t border-ivory-200/[0.08] pt-7">
            {[
              'A short conversation about your residences and what currently takes too long.',
              'A scoped proposal: modules, staffing model, onboarding window, membership tier.',
              'Your office goes live with your data loaded — usually two to three weeks after agreement.',
            ].map((item, index) => (
              <li key={item} className="flex gap-4 text-[13px] leading-relaxed text-graphite-300">
                <span className="text-[10.5px] tracking-[0.2em] text-gold-300/80">{String(index + 1).padStart(2, '0')}</span>
                {item}
              </li>
            ))}
          </ol>
          <div className="mt-9 flex flex-wrap items-center gap-6">
            <Button asLink href="/login" variant="gold-outline" size="md" trailingIcon={<ArrowRight size={14} strokeWidth={1.4} />}>
              Open an evaluation account
            </Button>
            <Link href="/" className="text-[11px] uppercase tracking-[0.2em] text-graphite-400 transition-colors hover:text-ivory-100">
              Back to the introduction
            </Link>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <form onSubmit={submit} className="relative rounded-[6px] border border-ivory-200/[0.1] bg-ink-950 p-7 sm:p-9" noValidate>
      <p className="label mb-8 text-graphite-400">Private access request</p>

      <div className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <TextField
            label="First name"
            value={values.firstName}
            onChange={(e) => setValues({ ...values, firstName: e.target.value })}
            error={errors.firstName}
            autoComplete="given-name"
            required
          />
          <TextField
            label="Last name"
            value={values.lastName}
            onChange={(e) => setValues({ ...values, lastName: e.target.value })}
            error={errors.lastName}
            autoComplete="family-name"
            required
          />
        </div>

        <TextField
          label="Email address"
          type="email"
          value={values.email}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
          error={errors.email}
          hint="Used only to answer this request."
          autoComplete="email"
          required
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <SelectField
            label="Country of residence"
            value={values.country}
            onChange={(e) => setValues({ ...values, country: e.target.value })}
            error={errors.country}
            placeholder="Select"
            options={COUNTRIES.map((country) => ({ value: country, label: country }))}
            required
          />
          <TextField
            label="Residences to manage"
            type="number"
            value={values.residences}
            min={1}
            max={99}
            onChange={(e) => setValues({ ...values, residences: e.target.value })}
            error={errors.residences}
            required
          />
        </div>

        <SelectField
          label="What matters most today"
          value={values.primaryRequirement}
          onChange={(e) => setValues({ ...values, primaryRequirement: e.target.value })}
          error={errors.primaryRequirement}
          placeholder="Select"
          options={PRIMARY_REQUIREMENTS.map((item) => ({ value: item, label: item }))}
          required
        />

        <TextArea
          label="Anything we should know"
          value={values.message}
          onChange={(e) => setValues({ ...values, message: e.target.value })}
          error={errors.message}
          rows={5}
          max={1400}
          placeholder="Multiple countries, a new build, staffing gaps, an aviation requirement…"
        />

        {/* Honeypot: invisible to people, irresistible to bots. */}
        <div aria-hidden className="absolute h-0 w-0 overflow-hidden opacity-0">
          <label>
            Leave this field empty
            <input tabIndex={-1} autoComplete="off" name="website" value={values.website} onChange={(e) => setValues({ ...values, website: e.target.value })} />
          </label>
        </div>

        {errors.form ? (
          <p role="alert" className="rounded-[3px] border border-state-risk/35 bg-state-risk/[0.07] px-4 py-3 text-[12.5px] text-state-risk">
            {errors.form}
          </p>
        ) : null}

        <div className="pt-1">
          <Button type="submit" size="lg" className="w-full" loading={pending} trailingIcon={<ArrowRight size={14} strokeWidth={1.4} />}>
            Request Private Access
          </Button>
          <p className="mt-5 text-[11.5px] leading-relaxed text-graphite-500">
            No card details are requested at this stage. Your enquiry is read by the private office, not a queue manager.
          </p>
        </div>
      </div>
    </form>
  );
}

/** Look up the state of a request already made — a real, working check. */
export function RequestStatusLookup() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    if (!email.includes('@')) return setResult('Enter the address you used.');
    setPending(true);
    try {
      const data = await apiRequest<{ found: boolean; status: string | null }>(`/api/access-requests?email=${encodeURIComponent(email)}`);
      setResult(
        !data.found
          ? 'No request is held under that address.'
          : data.status === 'new'
            ? 'Your request is with the private office, awaiting review.'
            : data.status === 'in_review'
              ? 'Someone is reading your request now.'
              : data.status === 'invited'
                ? 'An invitation has been prepared for you — check your inbox.'
                : data.status === 'declined'
                  ? 'That request was not taken forward. Write to us if you believe this is an error.'
                  : 'No request is held under that address.',
      );
    } catch {
      setResult('The register could not be read just now.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={lookup} className="rounded-[6px] border border-ivory-200/[0.08] bg-ink-900/50 p-6">
      <p className="label mb-4 text-graphite-400">Already asked?</p>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <TextField label="Check your request" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@household.com" />
        </div>
        <Button type="submit" variant="secondary" loading={pending} icon={<Search size={13} strokeWidth={1.4} />}>
          Look up
        </Button>
      </div>
      {result ? <p className="mt-4 text-[12.5px] leading-relaxed text-graphite-300">{result}</p> : null}
    </form>
  );
}
