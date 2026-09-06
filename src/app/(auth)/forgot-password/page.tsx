import { Suspense } from 'react';
import { ForgotPasswordForm, ResetPasswordForm } from '@/components/auth/auth-forms';
import { getT } from '@/lib/i18n/server';

export const metadata = { title: 'Passphrase recovery' };

export default function ForgotPasswordPage({ searchParams }: { searchParams?: { token?: string; email?: string } }) {
  const T = getT();
  const token = searchParams?.token;

  return (
    <Suspense fallback={null}>
      {token ? (
        <>
          <header className="mb-9">
            <p className="label mb-4 text-gold-300/80">{T("Recovery")}</p>
            <h1 className="font-serif text-[2.25rem] font-light uppercase tracking-[0.06em] leading-[1.08] text-ivory-50">{T("Choose a new")}<br />
              passphrase
            </h1>
            <p className="mt-5 text-[13.5px] leading-relaxed text-graphite-300">{T("Completing this step signs every other device out of the account.")}</p>
          </header>
          <ResetPasswordForm token={token} />
        </>
      ) : (
        <>
          <header className="mb-9">
            <p className="label mb-4 text-gold-300/80">{T("Recovery")}</p>
            <h1 className="font-serif text-[2.25rem] font-light uppercase tracking-[0.06em] leading-[1.08] text-ivory-50">{T("Regain")}<br />
              access
            </h1>
            <p className="mt-5 text-[13.5px] leading-relaxed text-graphite-300">{T("Tell us the address on your account and we will send a single-use link, valid for thirty minutes.")}</p>
          </header>
          <ForgotPasswordForm />
        </>
      )}
    </Suspense>
  );
}
