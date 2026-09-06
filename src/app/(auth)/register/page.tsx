import { RegisterForm } from '@/components/auth/auth-forms';

export const metadata = { title: 'Open an account' };

export default function RegisterPage() {
  return (
    <>
      <header className="mb-9">
        <p className="label mb-4 text-gold-300/80">New account</p>
        <h1 className="font-serif text-[2.25rem] font-light uppercase tracking-[0.06em] leading-[1.08] text-ivory-50">
          Begin your
          <br />
          private office
        </h1>
        <p className="mt-5 text-[13.5px] leading-relaxed text-graphite-300">
          Your account opens immediately with a starter residence so you can see how the office behaves. Full membership onboarding — staff,
          contracts, histories — is arranged after a conversation.
        </p>
      </header>
      <RegisterForm />
    </>
  );
}
