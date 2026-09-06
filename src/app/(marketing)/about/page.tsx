import type { Metadata } from 'next';
import { DocumentPage } from '@/components/marketing/document';

export const metadata: Metadata = {
  title: 'About the office',
  description: 'Why VELORA PRIVATE exists: what an estate office should have been, and what we refuse to build.',
};

export default function AboutPage() {
  return (
    <DocumentPage
      eyebrow="About"
      title="An office, not an app"
      lede="VELORA PRIVATE began as an internal tool for one family office that kept losing information between a spreadsheet, a group chat and three separate managers. The software is what remained after two years of asking why the obvious things were still hard."
      updated="Founded 2023 · Lausanne, Monaco, London"
      sections={[
        {
          heading: 'The problem we kept meeting',
          blocks: [
            {
              type: 'para',
              text: 'Households of a certain size are run with extraordinary care and extraordinary fragmentation. A villa in the south of France, an apartment above an office in Mayfair, a mountain house held through a trust, four estates with eleven contracts each — and the intelligence that ties them together lives in the head of one or two people.',
            },
            {
              type: 'para',
              text: 'When those people are on a flight or on holiday, the household slows down. Not because anyone is negligent, but because the record was never in one place, and the judgement was never written down.',
            },
            { type: 'note', text: 'The expensive part of a private office is not software. It is the hours spent reconstructing what is already known.' },
          ],
        },
        {
          heading: 'What we built instead',
          blocks: [
            {
              type: 'para',
              text: 'A single record set — residences, people, vehicles, travel, ledger, documents, requests — with an intelligence layer that reads it, notices what is about to go wrong, and drafts the coordination. The owner sees one briefing a day and a list of decisions that need a person. Everything else is closed quietly.',
            },
            {
              type: 'list',
              items: [
                'Ten modules, one data model: a maintenance job, an expense line and a document renewal refer to the same residence.',
                'An intelligence layer that never invents an outcome. If something requires a human confirmation, it says so.',
                'Per-member isolation. Your records are not joined to anyone else\u2019s, including ours.',
                'An administrator console for the office that serves you, so handovers are legible.',
              ],
            },
          ],
        },
        {
          heading: 'What we refuse to do',
          blocks: [
            {
              type: 'para',
              text: 'We do not sell data, advertise, or build social features. We do not put an assistant behind a chat bubble and call it intelligence. We do not onboard a household we cannot staff properly in the same quarter, and we do not accept a mandate where the principal cannot see exactly what the office did and why.',
            },
            {
              type: 'para',
              text: 'The interface is deliberately austere. A private office should feel like a ledger and a well-run desk, not a product trying to keep you on the page.',
            },
          ],
        },
        {
          heading: 'How it is run',
          blocks: [
            {
              type: 'para',
              text: 'VELORA is a small company: a dozen people, most of whom have worked inside family offices or private households before writing any software for them. Clients are taken in cohorts of no more than eight households per quarter, each with a named office lead, a deputy and an analyst.',
            },
            {
              type: 'para',
              text: 'The software is available as a membership, self-directed, or as an operated service where our office runs the platform on your behalf. Most households begin with the operated model for two quarters and keep the platform afterwards.',
            },
          ],
        },
      ]}
      aside={{
        title: 'Principles',
        items: [
          { label: 'One record per fact', note: 'Nothing is entered twice in a well-run household.' },
          { label: 'Write quietly, decide loudly', note: 'The office acts on routine items, and never on judgement items.' },
          { label: 'Say what is unknown', note: 'An honest gap beats a confident fiction, every time.' },
          { label: 'Leave with your data', note: 'Export is a button, not a negotiation.' },
        ],
      }}
    />
  );
}
