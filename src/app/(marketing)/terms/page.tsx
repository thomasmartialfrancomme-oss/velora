import type { Metadata } from 'next';
import { DocumentPage } from '@/components/marketing/document';
import { MEMBERSHIP_PLANS } from '@/lib/utils/format';

export const metadata: Metadata = {
  title: 'Membership terms',
  description: 'The terms on which a household holds a VELORA PRIVATE membership: tiers, billing, notice, and the limits of what the office does.',
};

const planLines = MEMBERSHIP_PLANS.map((plan) => `${plan.name} — ${plan.price_label} per month. ${plan.positioning}`);

export default function TermsPage() {
  return (
    <DocumentPage
      eyebrow="Terms"
      title="Membership terms"
      lede="A plain statement of what you buy, what we owe you, and where our authority stops. The demonstration build is governed by the same clauses, with the commercial ones dormant."
      updated="Version 1.2"
      sections={[
        {
          heading: 'Membership tiers',
          blocks: [
            {
              type: 'para',
              text: 'Memberships are billed monthly in advance and may be raised or lowered at any cycle boundary. Current published tiers:',
            },
            { type: 'list', items: planLines },
            {
              type: 'para',
              text: 'Households with more than eight residences, or a requirement for a dedicated office, are quoted individually. Prices are published in the platform\u2019s configuration and may be changed with one edit; members are given thirty days of notice before a change takes effect.',
            },
          ],
        },
        {
          heading: 'What the office does — and does not do',
          blocks: [
            {
              type: 'para',
              text: 'VELORA records, coordinates, drafts, chases and reports. Where an action requires a contract, a payment above your stated limit, or a judgement, the platform stops and asks. Anything you see marked as pending genuinely is: the platform never represents a reservation, a transfer or an approval as complete without confirmation from the counterparty.',
            },
            {
              type: 'list',
              items: [
                'We are not your lawyers, accountants, tax advisers or estate agents, and nothing in the platform is advice.',
                'We do not hold client money. Payments move between your accounts and your counterparties.',
                'Where an assistant drafts a message or a plan, a person approves it before it becomes an instruction.',
              ],
            },
          ],
        },
        {
          heading: 'Billing, suspension, cancellation',
          blocks: [
            {
              type: 'para',
              text: 'Card memberships may be cancelled at any time and run to the end of the paid period; no cancellation fee is charged. Annual memberships are refunded pro rata if cancelled within thirty days. A membership suspended for non-payment keeps its data for ninety days, then follows the deletion schedule in the privacy document.',
            },
          ],
        },
        {
          heading: 'Availability',
          blocks: [
            {
              type: 'para',
              text: 'We aim for 99.9% in a calendar month for the operated service, with no charge for the hours lost beyond that. The self-directed software is provided as-is: it is deliberately simple to run, and the documentation is written so that your own technical team can operate it without us.',
            },
          ],
        },
        {
          heading: 'The demonstration build',
          blocks: [
            {
              type: 'para',
              text: 'Accounts opened in this environment are provided for evaluation. Reservations, payments and outbound requests are simulated and never sent to a real counterparty. No card details are collected, and evaluation data may be removed at any time.',
            },
            { type: 'note', text: 'Anything the platform marks “Action requires confirmation” is exactly that: a step a person must take, not a step that has happened.' },
          ],
        },
      ]}
      aside={{
        title: 'At a glance',
        items: [
          { label: 'Monthly or annual', note: 'Raise or lower at any cycle boundary.' },
          { label: 'Cancel in the platform', note: 'No phone call, no retention desk.' },
          { label: 'Thirty days\u2019 notice on price changes' },
          { label: 'Governing law', note: 'Switzerland, canton de Vaud — for the operated service.' },
        ],
      }}
    />
  );
}
