import { redirect } from 'next/navigation';
import { LoginForm, type DemoAccount } from '@/components/auth/auth-forms';
import { getCurrentUser } from '@/lib/auth/session';
import { DEMO_CREDENTIALS } from '@db/demo-data.mjs';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  const production = process.env.NODE_ENV === 'production';
  const demoAccounts: DemoAccount[] = production
    ? []
    : [
        {
          label: 'Principal',
          detail: 'Alexander Reid · six residences',
          email: DEMO_CREDENTIALS.owner.email,
          password: DEMO_CREDENTIALS.owner.password,
        },
        {
          label: 'Private office',
          detail: 'Isabelle Fontaine · administrator',
          email: DEMO_CREDENTIALS.admin.email,
          password: DEMO_CREDENTIALS.admin.password,
        },
      ];

  return (
    <>
      <header className="mb-9">
        <p className="label mb-4 text-gold-300/80">Members</p>
        <h1 className="font-serif text-[2.25rem] font-light uppercase tracking-[0.06em] leading-[1.08] text-ivory-50">
          Welcome
          <br />
          back
        </h1>
        <p className="mt-5 text-[13.5px] leading-relaxed text-graphite-300">
          Sign in to reach your residences, people, travel and ledger. Sessions are held to this browser only.
        </p>
      </header>
      <LoginForm demoAccounts={demoAccounts} />
    </>
  );
}
