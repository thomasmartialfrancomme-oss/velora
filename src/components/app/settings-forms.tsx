'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelectField, TextField, ToggleField } from '@/components/ui/field';
import { ConfirmDialog } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { ApiClientError, apiRequest } from '@/lib/http/client';
import { COUNTRIES } from '@/lib/utils/format';

const TIMEZONES = [
  'Europe/Monaco',
  'Europe/Paris',
  'Europe/London',
  'Europe/Zurich',
  'Europe/Rome',
  'Asia/Dubai',
  'Asia/Singapore',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const LOCALES = [
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'it-IT', label: 'Italiano' },
  { value: 'es-ES', label: 'Español' },
  { value: 'ar-AE', label: 'العربية (UAE)' },
  { value: 'ja-JP', label: '日本語' },
];

const CURRENCIES = [
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'USD', label: 'US dollar (USD)' },
  { value: 'GBP', label: 'Pound sterling (GBP)' },
  { value: 'CHF', label: 'Swiss franc (CHF)' },
  { value: 'AED', label: 'UAE dirham (AED)' },
];

type Errors = Record<string, string>;

function useFormError() {
  const [errors, setErrors] = useState<Errors>({});
  const read = (caught: unknown) => {
    if (caught instanceof ApiClientError) setErrors(caught.fields);
    else setErrors({ form: caught instanceof Error ? caught.message : 'That could not be saved.' });
  };
  return { errors, setErrors, read };
}

export function ProfileForm({
  profile,
}: {
  profile: { firstName: string; lastName: string; email: string; country: string | null; timezone: string; locale: string; currency: string; briefingTime: string };
}) {
  const router = useRouter();
  const toast = useToast();
  const { errors, setErrors, read } = useFormError();
  const [values, setValues] = useState(profile);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setErrors({});
    try {
      await apiRequest('/api/account', { method: 'PATCH', body: values });
      toast.success('Saved', 'Your details are updated.');
      router.refresh();
    } catch (caught) {
      read(caught);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="First name" value={values.firstName} onChange={(e) => setValues({ ...values, firstName: e.target.value })} error={errors.firstName} required />
        <TextField label="Last name" value={values.lastName} onChange={(e) => setValues({ ...values, lastName: e.target.value })} error={errors.lastName} required />
      </div>
      <TextField label="Email address" value={values.email} disabled hint="Changed by your coordinator, so an edited address can never silently move your account." />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField label="Country" value={values.country ?? ''} onChange={(e) => setValues({ ...values, country: e.target.value })} placeholder="Not stated" options={COUNTRIES.map((c) => ({ value: c, label: c }))} error={errors.country} />
        <SelectField label="Time zone" value={values.timezone} onChange={(e) => setValues({ ...values, timezone: e.target.value })} options={TIMEZONES.map((zone) => ({ value: zone, label: zone.replace('_', ' ') }))} error={errors.timezone} required />
        <SelectField label="Language" value={values.locale} onChange={(e) => setValues({ ...values, locale: e.target.value })} options={LOCALES} />
        <SelectField label="Currency" value={values.currency} onChange={(e) => setValues({ ...values, currency: e.target.value })} options={CURRENCIES} hint="Only how amounts are displayed and stored — no conversion is performed." />
      </div>
      <TextField label="Daily briefing at" type="time" value={values.briefingTime} onChange={(e) => setValues({ ...values, briefingTime: e.target.value })} error={errors.briefingTime} hint="Local to your time zone. The office will not send anything outside it without asking." required />
      {errors.form ? <p className="text-[12.5px] text-state-risk">{errors.form}</p> : null}
      <div className="flex justify-end">
        <Button onClick={save} loading={pending} size="md">
          Save changes
        </Button>
      </div>
    </div>
  );
}

export function PreferencesForm({
  preferences,
}: {
  preferences: { daily_briefing: boolean; property_alerts: boolean; travel_updates: boolean; expense_review: boolean; staff_requests: boolean; channel: string };
}) {
  const router = useRouter();
  const toast = useToast();
  const { errors, setErrors, read } = useFormError();
  const [values, setValues] = useState(preferences);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setErrors({});
    try {
      await apiRequest('/api/account/preferences', { method: 'PATCH', body: values });
      toast.success('Saved', 'Notification preferences updated.');
      router.refresh();
    } catch (caught) {
      read(caught);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-1">
      {(
        [
          ['daily_briefing', 'Daily briefing', 'One message at your chosen hour, whatever the module.'],
          ['property_alerts', 'Residence alerts', 'Condition, service windows and anything a house manager flags.'],
          ['travel_updates', 'Travel updates', 'Changes to a journey or one of its steps.'],
          ['expense_review', 'Expense review', 'Entries the office cannot match to a residence or a contract.'],
          ['staff_requests', 'Staff requests', 'Time off, availability and requests routed to you.'],
        ] as const
      ).map(([key, label, description]) => (
        <ToggleField
          key={key}
          label={label}
          description={description}
          checked={Boolean(values[key])}
          onChange={(next) => setValues({ ...values, [key]: next })}
        />
      ))}

      <div className="pt-5">
        <SelectField
          label="Delivery"
          value={values.channel}
          onChange={(e) => setValues({ ...values, channel: e.target.value })}
          options={[
            { value: 'in_app', label: 'In the platform only' },
            { value: 'in_app_and_email', label: 'In the platform and by email' },
            { value: 'email', label: 'Email only' },
          ]}
          hint={values.channel.includes('email') ? 'Email needs an SMTP relay to be configured on this deployment; until then nothing is sent.' : 'Nothing leaves this platform.'}
        />
      </div>

      {errors.form ? <p className="pt-2 text-[12.5px] text-state-risk">{errors.form}</p> : null}
      <div className="flex justify-end pt-4">
        <Button onClick={save} loading={pending} size="md">
          Save preferences
        </Button>
      </div>
    </div>
  );
}

export function PasswordForm() {
  const router = useRouter();
  const toast = useToast();
  const { errors, setErrors, read } = useFormError();
  const [values, setValues] = useState({ current: '', next: '', confirm: '' });
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setErrors({});
    try {
      await apiRequest('/api/account/password', { method: 'POST', body: values });
      toast.success('Passphrase changed', 'Every other session has been signed out.');
      setValues({ current: '', next: '', confirm: '' });
      router.refresh();
    } catch (caught) {
      read(caught);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="space-y-5"
      noValidate
    >
      <TextField label="Current passphrase" type="password" autoComplete="current-password" value={values.current} onChange={(e) => setValues({ ...values, current: e.target.value })} error={errors.current} required />
      <TextField label="New passphrase" type="password" autoComplete="new-password" value={values.next} onChange={(e) => setValues({ ...values, next: e.target.value })} error={errors.next} hint="Twelve characters or more, with a capital, a number and a symbol." required />
      <TextField label="Repeat new passphrase" type="password" autoComplete="new-password" value={values.confirm} onChange={(e) => setValues({ ...values, confirm: e.target.value })} error={errors.confirm} required />
      {errors.form ? <p className="text-[12.5px] text-state-risk">{errors.form}</p> : null}
      <div className="flex items-center justify-between gap-4">
        <p className="text-[11.5px] leading-relaxed text-graphite-500">Changing it signs out every other device immediately.</p>
        <Button type="submit" loading={pending} size="md">
          Change passphrase
        </Button>
      </div>
    </form>
  );
}

export function DataPanel({ email }: { email: string }) {
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function destroy() {
    setPending(true);
    setError(null);
    try {
      await apiRequest('/api/account/delete', { method: 'POST', body: { password, confirm: 'DELETE MY ACCOUNT' } });
      toast.success('Deleted', 'Your records were removed and the session closed.');
      window.location.assign('/?closed=1');
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Nothing was deleted.');
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[4px] border border-ivory-200/[0.08] bg-ink-950/60 px-5 py-4">
        <div>
          <p className="text-[13px] text-ivory-50">Export everything</p>
          <p className="mt-1 max-w-md text-[12px] leading-relaxed text-graphite-400">
            One JSON file with every row held against {email} — residences, people, ledger, documents index, conversations, invoices. No request, no
            waiting.
          </p>
        </div>
        <Button asLink href="/api/account/export" variant="secondary" size="sm" icon={<Download size={13} strokeWidth={1.4} />}>
          Download
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[4px] border border-state-risk/25 bg-state-risk/[0.04] px-5 py-4">
        <div>
          <p className="text-[13px] text-ivory-50">Close the account and delete its records</p>
          <p className="mt-1 max-w-md text-[12px] leading-relaxed text-graphite-400">
            Removes your data from this deployment. Your passphrase is required again, and the action cannot be undone from the browser.
          </p>
        </div>
        <Button variant="danger" size="sm" icon={<Trash2 size={13} strokeWidth={1.4} />} onClick={() => setConfirmOpen(true)}>
          Delete my account
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete your account and every record in it?"
        tone="danger"
        busy={pending}
        confirmLabel="Delete permanently"
        word="DELETE MY ACCOUNT"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={destroy}
        body={
          <div className="space-y-4">
            <p>
              This removes residences, people, vehicles, journeys, tasks, ledger entries, document records, conversations, invoices and notifications for{' '}
              <span className="text-ivory-50">{email}</span>. Nothing is archived by us.
            </p>
            <TextField label="Your passphrase" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            {error ? <p className="text-[12.5px] text-state-risk">{error}</p> : null}
          </div>
        }
      />
    </div>
  );
}
