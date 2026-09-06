import type { Metadata } from 'next';
import { DocumentPage } from '@/components/marketing/document';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What VELORA PRIVATE stores about a household, why it is stored, who may read it, and how to take it away.',
};

export default function PrivacyPage() {
  return (
    <DocumentPage
      eyebrow="Privacy"
      title="What is held, and for whom"
      lede="This is the short version of what a member agreement says about data. It is written for a principal and their chief of staff, not for a regulator, and it is the same policy the platform enforces in code."
      updated="Version 1.2 · In force since the first household onboarded"
      sections={[
        {
          heading: 'What we store',
          blocks: [
            {
              type: 'para',
              text: 'Only what an estate office must know to act: identity and contact details of members; residences and their attributes; staff and their roles and documents; service contracts and insurance; vehicles and maintenance; trips and reservations; tasks and requests; expenditure lines and their categories; uploaded documents; the ledger of actions taken by the office.',
            },
            {
              type: 'list',
              items: [
                'Passphrases are never stored — only a bcrypt hash.',
                'Payment card data never reaches us. Billing is handled by the payment provider; we keep an invoice reference and a status.',
                'We do not embed third-party analytics, advertising pixels, or session replay on member screens.',
              ],
            },
          ],
        },
        {
          heading: 'Who may read it',
          blocks: [
            {
              type: 'para',
              text: 'You, and only you, under your account. The named private office assigned to your household, under an administrator scope that is logged on every access. No shared table of "all clients" is exposed in the product, and no member record is joined to another member\u2019s data in reporting.',
            },
            {
              type: 'para',
              text: 'Staff of our own company have no standing access to production member data. Support access requires a written request from you, is time-boxed, and appears in your audit trail afterwards.',
            },
          ],
        },
        {
          heading: 'Where it goes',
          blocks: [
            {
              type: 'para',
              text: 'Nowhere, unless a service you have asked us to use requires it. A flight or hotel enquiry is sent to the operator you name; a payment is sent to the payment provider; if an external AI provider is enabled for your office, the context required for that request is sent and its retention is contracted at zero days.',
            },
            {
              type: 'note',
              text: 'In the demonstration build no external service is contacted at all: billing is simulated, and the assistant is a deterministic local planner. Nothing leaves the machine it runs on.',
            },
          ],
        },
        {
          heading: 'Retention and removal',
          blocks: [
            {
              type: 'para',
              text: 'Active members keep their full history — a household record is worth having. Access requests that go nowhere are deleted after eighteen months. On closure we export your data for you in a machine-readable form, then delete everything but the accounting records the law requires us to keep, typically seven years for invoices.',
            },
            {
              type: 'list',
              items: [
                'Settings → Account → Export your data produces the complete record set as JSON, immediately.',
                'Settings → Account → Delete my account removes records within one working day and logs the deletion.',
                'Backups roll for fourteen days; a deletion request is applied to them on the same schedule.',
              ],
            },
          ],
        },
      ]}
      aside={{
        title: 'In one line',
        items: [
          { label: 'No sale, no sharing, no advertising use', note: 'Ever, including after a change of control.' },
          { label: 'No trackers on member screens' },
          { label: 'Export and delete are product features', note: 'Available to every member without asking us.' },
          { label: 'Questions', note: 'privacy@velora.private' },
        ],
      }}
    />
  );
}
