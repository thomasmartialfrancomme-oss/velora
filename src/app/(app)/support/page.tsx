import type { Metadata } from 'next';
import { PageHeader, KeyValue, Notice } from '@/components/app/page-chrome';
import { Panel, PanelHeader, Divider, SectionLabel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { RecordForm, type FieldSpec } from '@/components/ui/record-form';
import { requireUser } from '@/lib/auth/session';
import { getMembership, listMyTickets } from '@/lib/data/read';
import { formatDateTime, getPlan, relativeTime } from '@/lib/utils/format';
import { getT } from '@/lib/i18n/server';

export const metadata: Metadata = { title: 'The office' };
export const dynamic = 'force-dynamic';

const fields: FieldSpec[] = [
  { key: 'subject', label: 'Subject', required: true, hint: 'Keep it to a line. The detail goes below.', placeholder: 'A chef for Saturday, and a table for after' },
  {
    key: 'body',
    label: 'Detail',
    type: 'textarea',
    span: 2,
    rows: 6,
    max: 1600,
    placeholder: 'Who, where, when, and any standing preference the office should apply without asking.',
    hint: 'One paragraph is enough. The office will ask for anything missing.',
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'select',
    options: [
      { value: 'low', label: 'Low — whenever is convenient' },
      { value: 'normal', label: 'Normal — inside the window' },
      { value: 'high', label: 'High — today' },
      { value: 'urgent', label: 'Urgent — interrupt someone' },
    ],
  },
];

const PRIORITY_TONE: Record<string, 'neutral' | 'info' | 'gold' | 'risk'> = { low: 'neutral', normal: 'info', high: 'gold', urgent: 'risk' };
const STATUS_TONE: Record<string, 'neutral' | 'info' | 'gold' | 'ok'> = { open: 'gold', in_review: 'info', answered: 'ok', closed: 'neutral' };
const STATUS_LABELS: Record<string, string> = { open: 'With the office', in_review: 'Being prepared', answered: 'Answered', closed: 'Closed' };

export default async function SupportPage() {
  const T = getT();
  const user = await requireUser();
  const tickets = listMyTickets(user.id);
  const membership = getMembership(user.id);
  const plan = getPlan(membership.subscription?.plan ?? 'private');
  const open = tickets.filter((ticket) => ticket.status !== 'closed' && ticket.status !== 'answered').length;
  const answered = tickets.filter((ticket) => ticket.reply);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Correspondence"
        title="The office"
        lede="Everything that needs a person goes here. It enters the ledger of your account, someone signs it, and the answer arrives as a message — never as a form you have to chase."
        meta={
          <>
            <span>{plan.name}</span>
            <span>{plan.response_sla}</span>
            <span>{open ? `${open} open` : 'Nothing outstanding'}</span>
            <span>{tickets.length} written</span>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <Panel>
            <PanelHeader label="Write" title="What do you need?" description="One paragraph is enough. The office will ask for anything missing." />
            <Divider className="my-5" />
            <RecordForm
              title="Write to the office"
              path="/api/tickets"
              fields={fields}
              defaults={{ priority: 'normal' }}
              submitLabel="Send to the office"
              inline
            />
          </Panel>

          <Panel>
            <PanelHeader label="Your window" title="How quickly we answer" />
            <Divider className="my-5" />
            <KeyValue
              items={[
                { label: 'Membership', value: plan.name },
                { label: 'Response', value: plan.response_sla },
                { label: 'Concierge', value: plan.human_concierge },
                { label: 'Coordinator requests', value: plan.ai_requests_per_day === 'unlimited' ? 'Unlimited' : `${plan.ai_requests_per_day} per day` },
              ]}
            />
            <p className="mt-5 text-[11.5px] leading-relaxed text-graphite-500">
              {answered.length
                ? `${answered.length} of your ${tickets.length} written requests carry an answer.`
                : 'No answer has been recorded yet. The desk opens at 07:00 and closes at 01:00, your time.'}
            </p>
          </Panel>

          <Panel>
            <PanelHeader label="By voice" title="The desk number" />
            <Divider className="my-5" />
            <p className="font-serif text-[1.35rem] tracking-[0.03em] text-ivory-50 tabular-nums">+377 93 00 00 00</p>
            <p className="mt-2 text-[12px] leading-relaxed text-graphite-400">
              Monaco · 07:00 to 01:00 CET. This is the demonstration number — it is not answered by a person. Until the telephony line is provisioned,
              write above; the queue is the same one either way.
            </p>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <PanelHeader
              label="Correspondence"
              title="What you have asked"
              description="Open, in review, answered, closed — the state is kept by whoever signs the work, not by you."
              actions={
                <span className="text-[11px] uppercase tracking-[0.18em] text-graphite-500">
                  {open} open
                </span>
              }
            />
            <Divider className="my-5" />
            {tickets.length ? (
              <ol className="space-y-4">
                {tickets.map((ticket) => (
                  <li key={ticket.id} className="rounded-[4px] border border-ivory-200/[0.07] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[13.5px] leading-snug text-ivory-50">{ticket.subject}</p>
                        <p className="mt-1.5 text-[11px] uppercase tracking-[0.16em] text-graphite-600">
                          {relativeTime(ticket.createdAt)} · priority {ticket.priority}
                          {ticket.assignee ? ` · ${ticket.assignee}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <Badge tone={STATUS_TONE[ticket.status] ?? 'neutral'}>{STATUS_LABELS[ticket.status] ?? ticket.status}</Badge>
                        <Badge tone={PRIORITY_TONE[ticket.priority] ?? 'neutral'} dot={ticket.priority === 'urgent'}>
                          {ticket.priority}
                        </Badge>
                      </div>
                    </div>

                    {ticket.body ? (
                      <p className="mt-3 border-l border-ivory-200/10 pl-3 text-[12.5px] leading-relaxed text-graphite-300">{ticket.body}</p>
                    ) : null}

                    {ticket.reply ? (
                      <div className="mt-3.5 rounded-[3px] border-l border-gold-400/50 bg-gold-400/[0.04] py-3 pl-4 pr-3.5">
                        <SectionLabel className="mb-1.5 text-gold-300/90">{T("Answer from the office")}</SectionLabel>
                        <p className="text-[12.5px] leading-relaxed text-graphite-100">{ticket.reply}</p>
                        <p className="mt-2 text-[10.5px] uppercase tracking-[0.16em] text-graphite-600">
                          {ticket.assignee ?? 'The office'} · {formatDateTime(ticket.updatedAt, user.timezone)}
                        </p>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState
                title="You have never needed us"
                description="That is the intended condition of a well-run household. The first request, whenever it comes, will appear here with the name of whoever takes it."
              />
            )}
          </Panel>

          <Notice tone="info" title="What happens when you send">{T("The request is stored against your account with a timestamp, an office member is assigned within your response window, the answer returns here in the same thread, and anything the answer commits to opens as a task in the ledger. Nothing is sent to a third party from this screen.")}</Notice>
        </div>
      </div>
    </div>
  );
}
