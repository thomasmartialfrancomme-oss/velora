import { RegisterForm } from '@/components/auth/auth-forms';
import { getT } from '@/lib/i18n/server';

export const metadata = { title: 'Open an account' };

export default function RegisterPage() {
  const T = getT();
  return (
    <>
      <header className="mb-9">
        <p className="label mb-4 text-gold-300/80">{T("New account")}</p>
        <h1 className="font-serif text-[2.25rem] font-light uppercase tracking-[0.06em] leading-[1.08] text-ivory-50">{T("Begin your")}<br />
          private office
        </h1>
        <p className="mt-5 text-[13.5px] leading-relaxed text-graphite-300">{T("Your account opens immediately with a starter residence so you can see how the office behaves. Full membership onboarding — staff, contracts, histories — is arranged after a conversation.")}</p>
      </header>
      <RegisterForm />
    </>
  );
}
