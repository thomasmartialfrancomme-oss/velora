import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/ui/reveal';
import { getT } from '@/lib/i18n/server';

export function ClosingCta() {
  const T = getT();
  return (
    <section className="relative overflow-hidden border-t border-ivory-200/[0.07] py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_80%_at_50%_120%,rgba(201,169,106,0.09),transparent_60%)]" />
      <div className="container relative">
        <Reveal className="mx-auto max-w-4xl text-center">
          <p className="label mb-8 text-gold-300/80">{T("By application")}</p>
          <h2 className="display text-display-lg uppercase">{T("Designed for a life")}<br />
            without unnecessary friction.
          </h2>
          <p className="mx-auto mt-8 max-w-xl text-[15px] leading-relaxed text-graphite-200">{T("Tell us where your residences are and what a good week looks like. We will show you the office that runs them.")}</p>
          <div className="mt-11 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" asLink href="/access/request" trailingIcon={<ArrowUpRight size={14} strokeWidth={1.4} />}>{T("Request private access")}</Button>
            <Button size="lg" variant="secondary" asLink href="/login">{T("Enter the platform")}</Button>
          </div>
          <p className="mt-8 text-[11.5px] uppercase tracking-[0.2em] text-graphite-500">{T("No card details requested · reviewed personally · reply within two business days")}</p>
        </Reveal>
      </div>
    </section>
  );
}
