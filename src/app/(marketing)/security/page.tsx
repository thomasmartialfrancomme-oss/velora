import type { Metadata } from 'next';
import { DocumentPage } from '@/components/marketing/document';
import { env } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Security & discretion',
  description: 'How VELORA PRIVATE protects member data: isolation, authentication, transport, retention and what is honestly not yet in place.',
};

export const dynamic = 'force-dynamic';

export default function SecurityPage() {
  const { stripeConfigured, aiProviderConfigured, smtpConfigured } = env.capabilities;

  return (
    <DocumentPage
      eyebrow="Security"
      title="Discretion, engineered"
      lede="A private household is a target for a narrow set of people: the curious, the disgruntled and the fraudulent. This page states what is in place, what is partial, and what is not yet built — in the same terms we would use with a client's security counsel."
      updated={`Assessed against our own baseline · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`}
      sections={[
        {
          heading: 'Isolation of records',
          blocks: [
            {
              type: 'para',
              text: 'Every table that holds member data carries a user identifier, and every read and write in the application goes through one gateway that injects that identifier into the query. There is no code path by which a member supplies their own tenant scope, and the identifier cannot be set through the API body — it is taken from the verified session.',
            },
            {
              type: 'list',
              items: [
                'Row-level scoping enforced in the data layer, not in the UI.',
                'Direct queries outside the scoped gateway fail type checking, by construction.',
                'Administrator access is a separate, audited scope with its own routes and its own rate limits.',
              ],
            },
          ],
        },
        {
          heading: 'Authentication and sessions',
          blocks: [
            {
              type: 'para',
              text: 'Passphrases are hashed with bcrypt at a cost of twelve and never stored, logged or returned in any form. Sessions are signed JWTs carried in an HttpOnly, SameSite=Lax cookie, rotated on privilege change, and revoked server-side when you sign out everywhere or change your passphrase.',
            },
            {
              type: 'list',
              items: [
                'Twelve-character minimum, checked against a length and class heuristic before submission.',
                'Login and recovery are rate limited per address and per account, with backoff.',
                'Password reset tokens are stored hashed, expire in thirty minutes, and are single use.',
                'Requests that change state are checked for a same-origin header in addition to the cookie policy.',
              ],
            },
            { type: 'note', text: 'Hardware-key MFA is designed and specified, not yet shipped. Until it is, a strong unique passphrase is the control that matters most.' },
          ],
        },
        {
          heading: 'The intelligence layer',
          blocks: [
            {
              type: 'para',
              text: 'The assistant is a thin, provider-swappable client. Nothing is stored about a model response that is not explicitly written to a task or conversation row. Where no provider is configured, the platform runs its deterministic planning layer instead — the same outputs, produced locally, labelled as such.',
            },
            {
              type: 'list',
              items: [
                'Provider endpoints and keys are read from server environment variables only.',
                'No model provider is called from the browser at any point.',
                'Model output is treated as untrusted input: it cannot execute, and it cannot confirm an action by itself.',
              ],
            },
          ],
        },
        {
          heading: 'What we do not claim',
          blocks: [
            {
              type: 'para',
              text: 'This build runs on a single node with an encrypted-at-rest volume. It is not yet a hardened multi-region service: there is no external key management for database-level field encryption, no published penetration test, and no SOC 2 or ISO 27001 certificate. We would rather say so here than have a client discover it in diligence.',
            },
            {
              type: 'para',
              text: 'Enterprise deployments are hosted in the client\u2019s own cloud account, where those controls are contracted and evidenced. Two-factor hardware keys, field-level encryption and an annual third-party penetration test are scheduled for the platform itself.',
            },
          ],
        },
      ]}
      aside={{
        title: 'This build',
        items: [
          { label: 'Tenant isolation', note: 'Enforced in the data gateway', state: 'live' },
          { label: 'bcrypt passphrases', note: 'Cost factor 12, no plaintext anywhere', state: 'live' },
          { label: 'Rate limiting', note: 'Auth and write paths per IP and account', state: 'live' },
          { label: 'Audit trail', note: 'Actor, action, target, timestamp', state: 'live' },
          { label: 'Hardware-key MFA', note: 'Specified, not yet shipped', state: 'planned' },
          { label: 'Card payments', note: stripeConfigured ? 'Stripe keys detected' : 'No Stripe keys set — demo billing only', state: stripeConfigured ? 'live' : 'partial' },
          { label: 'External AI provider', note: aiProviderConfigured ? 'Endpoint configured' : 'Not configured — deterministic planner in use', state: aiProviderConfigured ? 'live' : 'partial' },
          { label: 'Outbound email', note: smtpConfigured ? 'SMTP relay configured' : 'No transport — links shown in console', state: smtpConfigured ? 'live' : 'planned' },
        ],
      }}
    />
  );
}
