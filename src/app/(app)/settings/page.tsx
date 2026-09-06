import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, KeyValue, Notice } from '@/components/app/page-chrome';
import { Panel, PanelHeader, Divider } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/tabs';
import { DataPanel, PasswordForm, PreferencesForm, ProfileForm } from '@/components/app/settings-forms';
import { requireUser } from '@/lib/auth/session';
import { getMembership, listAuditForUser } from '@/lib/data/read';
import { formatDate, formatDateTime, getPlan, label as humanise, relativeTime, STATUS_LABEL } from '@/lib/utils/format';
import { getT } from '@/lib/i18n/server';
import { LocaleSwitcher } from '@/components/ui/locale-switcher';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

const TABS = [
  { value: 'profile', label: 'Profile' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'security', label: 'Security' },
  { value: 'data', label: 'Your data' },
  { value: 'office', label: 'The office' },
];

export default async function SettingsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const T = getT();
  const user = await requireUser();
  const tabRaw = typeof searchParams?.tab === 'string' ? searchParams.tab : 'profile';
  const tab = TABS.some((entry) => entry.value === tabRaw) ? tabRaw : 'profile';
  const membership = getMembership(user.id);
  const plan = getPlan(membership.subscription?.plan ?? 'private');
  const activity = listAuditForUser(user.id, 8);
  const sessionDays = Math.min(Number(process.env.AUTH_TOKEN_TTL_DAYS ?? 7), 30);

  const preferences = {
    daily_briefing: user.notifications.daily_briefing !== false,
    property_alerts: user.notifications.property_alerts !== false,
    travel_updates: user.notifications.travel_updates !== false,
    expense_review: user.notifications.expense_review !== false,
    staff_requests: user.notifications.staff_requests !== false,
    channel: typeof user.notifications.channel === 'string' ? user.notifications.channel : 'in_app',
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        lede="Your identity in the platform, what the office may send you, and the two things that end a session: a passphrase change or your own instruction."
        meta={
          <>
            <span>Member since {formatDate(user.createdAt, 'long', user.timezone)}</span>
            <span>{plan.name}</span>
            <span>{user.role === 'admin' ? 'Private office account' : 'Principal account'}</span>
          </>
        }
      />

      <Tabs tabs={TABS} value={tab} />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {tab === 'profile' ? (
            <Panel>
              <PanelHeader label="Identity" title="How you are addressed" description="Names, place and the hour your briefing is written for." />
              <Divider className="my-5" />
              <ProfileForm
                profile={{
                  firstName: user.firstName,
                  lastName: user.lastName,
                  email: user.email,
                  country: user.country,
                  timezone: user.timezone,
                  locale: user.locale,
                  currency: user.currency,
                  briefingTime: user.briefingTime,
                }}
              />
              <Divider />
              <div className="flex flex-wrap items-center justify-between gap-5 px-7 py-6">
                <div className="max-w-md">
                  <p className="text-[13px] leading-relaxed text-graphite-300">
                    {T('This changes the words around your data, never the data. Anything not yet translated in your language shows in English rather than being guessed at.')}
                  </p>
                </div>
                <LocaleSwitcher compact />
              </div>
            </Panel>
          ) : null}

          {tab === 'notifications' ? (
            <Panel>
              <PanelHeader label="Delivery" title="What the office may send you" description="Anything switched off is still recorded in your ledger; it simply does not arrive as a message." />
              <Divider className="my-5" />
              <PreferencesForm preferences={preferences} />
            </Panel>
          ) : null}

          {tab === 'security' ? (
            <>
              <Panel>
                <PanelHeader label="Passphrase" title="Change it" description="Twelve characters or more. Changing it revokes every other session immediately." />
                <Divider className="my-5" />
                <PasswordForm />
              </Panel>
              <Notice tone="info" title="Two-factor with a hardware key is designed, not yet shipped">{T("Sessions are bound to a signed HttpOnly cookie, state-changing requests are origin-checked, and authentication endpoints are rate limited. Security keys arrive with the platform’s next release — see the security document for what is and is not in place today.")}</Notice>
            </>
          ) : null}

          {tab === 'data' ? (
            <Panel>
              <PanelHeader label="Portability" title="Take it or leave it" description="Both directions are a button, not a conversation." />
              <Divider className="my-5" />
              <DataPanel email={user.email} />
            </Panel>
          ) : null}

          {tab === 'office' ? (
            <Panel>
              <PanelHeader label="Your private office" title="Who holds the pen" description="Membership tiers decide the response window; the people beside it do not change with the price." />
              <Divider className="my-5" />
              <KeyValue
                items={[
                  { label: 'Office lead', value: 'Isabelle Fontaine' },
                  { label: 'Deputy', value: 'Marco Reinholt' },
                  { label: 'Analyst', value: 'Sofia Almeida' },
                  { label: 'Response window', value: plan.response_sla },
                  { label: 'Human concierge', value: plan.human_concierge },
                  { label: 'Line', value: '+377 93 00 00 00' },
                ]}
              />
              <p className="mt-5 text-[11.5px] leading-relaxed text-graphite-500">{T("These names belong to the demonstration office. In a real membership they are the three people assigned to your household, and the number reaches their duty rota.")}</p>
              <Link href="/support" className="mt-5 inline-block text-[11px] uppercase tracking-[0.2em] text-gold-200 transition-colors hover:text-gold-100">{T("Write to the office →")}</Link>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-6">
          <Panel>
            <PanelHeader label="Account" title="What is held about you" />
            <Divider className="my-5" />
            <KeyValue
              items={[
                { label: 'Reference', value: <code className="text-[11.5px] text-graphite-300">{user.id}</code> },
                { label: 'Role', value: <Badge tone={user.role === 'admin' ? 'gold' : 'neutral'}>{humanise(user.role, STATUS_LABEL)}</Badge> },
                { label: 'Status', value: humanise(user.status, STATUS_LABEL) },
                { label: 'Language', value: user.locale },
                { label: 'Currency', value: user.currency },
                { label: 'Time zone', value: user.timezone },
                { label: 'Briefing hour', value: user.briefingTime },
                { label: 'Last sign-in', value: user.lastLoginAt ? formatDateTime(user.lastLoginAt, user.timezone) : 'This session is the first' },
              ]}
            />
          </Panel>

          <Panel>
            <PanelHeader label="Trail" title="What the platform recorded" description="Your own recent actions. The full audit ledger is kept for two years and is included in the export." />
            <Divider className="my-5" />
            {activity.length ? (
              <ul className="space-y-3">
                {activity.map((entry) => (
                  <li key={entry.id} className="flex items-baseline justify-between gap-4 border-b border-ivory-200/[0.05] pb-2.5 text-[12px] last:border-b-0">
                    <span className="min-w-0 truncate text-graphite-200">{humanise(entry.event.replace(/\./g, ' '), STATUS_LABEL)}</span>
                    <span className="shrink-0 text-[11px] text-graphite-600">{relativeTime(entry.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-graphite-400">{T("Nothing recorded yet in this account.")}</p>
            )}
          </Panel>

          <Panel>
            <PanelHeader label="Sessions" title="Where you are signed in" />
            <Divider className="my-5" />
            <p className="text-[12.5px] leading-relaxed text-graphite-300">
              This browser holds one session: a signed, HttpOnly cookie valid for {sessionDays} day{sessionDays === 1 ? '' : 's'} (AUTH_TOKEN_TTL_DAYS,
              capped at 30). It is revoked server-side the moment you change your passphrase, and every token issued before that instant stops working —
              the check runs against {user.timezone}. A device list with per-device revocation is on the roadmap and is not faked here.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
