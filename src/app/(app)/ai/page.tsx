import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { BrainCircuit, Sparkles } from 'lucide-react';
import { PageHeader, StatStrip, Notice } from '@/components/app/page-chrome';
import { Panel, PanelHeader, Divider } from '@/components/ui/panel';
import { Badge, toneForStatus } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { QuickAction } from '@/components/ui/record-form';
import { AssistantConsole } from '@/components/app/assistant-console';
import { AiBlockView } from '@/components/app/ai-block';
import { requireUser } from '@/lib/auth/session';
import { getAiUsageToday, getConversation, getMembership, listConversations, pendingAiActions } from '@/lib/data/read';
import { activeProviderInfo } from '@/lib/ai/service';
import type { AIBlock } from '@/lib/ai/types';
import { STATUS_LABEL, formatMoney, getPlan, label as humanise, relativeTime } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'VELORA AI' };
export const dynamic = 'force-dynamic';

const SUGGESTIONS = [
  'Two nights at Villa Monte Carlo next Friday — dinner for four and a car from the airport',
  'What needs my decision today?',
  'Which vehicles are overdue for a service?',
  'Pull the spend for each residence this month and flag anything over budget',
];

export default async function AiPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const user = await requireUser();
  const conversations = listConversations(user.id);
  const selected = typeof searchParams?.c === 'string' ? searchParams.c : conversations[0]?.id ?? null;
  const thread = selected ? getConversation(user.id, selected) : undefined;
  const pending = pendingAiActions(user.id);
  const provider = activeProviderInfo();
  const membership = getMembership(user.id);
  const plan = getPlan(membership.subscription?.plan ?? 'private');
  const used = getAiUsageToday(user.id);

  const answer = thread ? [...thread.messages].reverse().find((message) => message.role === 'assistant') : undefined;
  const question = thread ? [...thread.messages].reverse().find((message) => message.role === 'user') : undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Module 08 · Intelligence"
        title="VELORA AI"
        lede="Say what you want to happen. The coordinator reads your own records, drafts the steps, opens the tasks it is allowed to open, and stops in front of anything that needs a person."
        meta={
          <>
            <span className="flex items-center gap-2">
              <Badge tone={provider.external ? 'info' : 'neutral'}>{provider.external ? 'External model' : 'On this machine'}</Badge>
              {provider.label}
            </span>
            <span>
              {used} / {plan.ai_requests_per_day === 'unlimited' ? 'unlimited' : plan.ai_requests_per_day} requests today
            </span>
            <span>{pending.length} actions awaiting you</span>
          </>
        }
      />

      {!provider.external ? (
        <Notice tone="info" title="No model provider is configured — the deterministic coordinator is answering">
          Set <code className="text-ivory-100">AI_PROVIDER_URL</code> and <code className="text-ivory-100">AI_API_KEY</code> to route this same
          interface through a language model. The plan is computed from your records either way, and the honesty guard is applied to both.
        </Notice>
      ) : null}

      <StatStrip
        items={[
          { label: 'Conversations', value: conversations.length, detail: conversations[0] ? `last ${relativeTime(conversations[0].updatedAt)}` : 'nothing asked yet' },
          { label: 'Actions proposed', value: pending.length, tone: pending.length ? 'gold' : 'default', detail: pending.length ? 'each one is a task, not a promise' : 'nothing waiting' },
          { label: 'Context it may read', value: 'your records only', detail: plan.residences_included === 99 ? 'every residence you keep' : `${plan.residences_included} residences on your plan`, href: '/properties' },
          { label: 'Membership', value: humanise(membership.subscription?.status ?? 'none', STATUS_LABEL), detail: membership.subscription ? formatMoney(membership.subscription.amountCents, { currency: user.currency }) : 'no subscription on this account', href: '/membership' },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Suspense fallback={null}>
            <AssistantConsole conversationId={thread?.conversation.id ?? null} suggestions={SUGGESTIONS} firstName={user.firstName} />
          </Suspense>

          {thread ? (
            <Panel>
              <PanelHeader
                label="The office answered"
                title={thread.conversation.title}
                description={question ? `You asked: “${question.content}”` : undefined}
                actions={
                  <span className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.16em] text-graphite-500">
                    {thread.conversation.provider}
                    <Sparkles size={12} className="text-gold-300/80" strokeWidth={1.4} />
                  </span>
                }
              />
              <Divider className="my-5" />

              {answer ? (
                <>
                  <p className="font-serif text-[1.28rem] font-light leading-[1.45] text-ivory-50">{answer.content}</p>

                  {answer.payload?.blocks?.length ? (
                    <div className="mt-6 space-y-5">
                      {answer.payload.blocks.map((block, index) => (
                        <AiBlockView key={index} block={block as AIBlock} />
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-7">
                    <p className="label mb-3 text-graphite-500">What the coordinator proposes</p>
                    {thread.actions.length ? (
                      <ul className="space-y-2.5">
                        {thread.actions.map((action) => (
                          <li key={action.id} className="rounded-[4px] border border-ivory-200/[0.08] bg-ink-950/50 p-4">
                            <div className="flex items-start justify-between gap-4">
                              <p className="text-[13px] leading-snug text-ivory-50">{action.label}</p>
                              <Badge tone={toneForStatus(action.status)}>{humanise(action.status, STATUS_LABEL)}</Badge>
                            </div>
                            <p className="mt-2 text-[11.5px] leading-relaxed text-graphite-500">
                              {humanise(action.module, STATUS_LABEL)}
                              {action.detail ? ` · ${action.detail}` : ''}
                              {action.requiresConfirmation ? ' · action requires confirmation' : ' · recorded in your ledger'}
                              {typeof action.confidence === 'number' ? ` · confidence ${Math.round(action.confidence * 100)}%` : ''}
                            </p>
                            {action.taskId ? (
                              <p className="mt-2 text-[11.5px] text-state-ok">
                                Opened as a task in your records.
                              </p>
                            ) : null}
                            {action.status === 'proposed' || action.status === 'requires_confirmation' ? (
                              <div className="mt-3.5 flex flex-wrap gap-2">
                                <QuickAction
                                  path="/api/ai/action"
                                  body={{ aiTaskId: action.id, decision: 'confirm' }}
                                  label="Approve"
                                  variant="gold-outline"
                                  size="sm"
                                  successMessage="Approved — the office has the task."
                                  confirm={{
                                    title: 'Approve this step?',
                                    body: 'A task is opened for the private office. No supplier is contacted and nothing is paid: a person executes it and reports back.',
                                    confirmLabel: 'Approve and open the task',
                                  }}
                                />
                                <QuickAction path="/api/ai/action" body={{ aiTaskId: action.id, decision: 'defer' }} label="Leave open" variant="ghost" size="sm" successMessage="Left in your queue." />
                                <QuickAction path="/api/ai/action" body={{ aiTaskId: action.id, decision: 'decline' }} label="Decline" variant="ghost" size="sm" successMessage="Declined and recorded." />
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[12.5px] leading-relaxed text-graphite-400">
                        This answer proposed no changes to your records — it was a question of fact, and the answer is above.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-[12.5px] leading-relaxed text-graphite-400">The conversation has your question but no answer was stored.</p>
              )}
            </Panel>
          ) : (
            <EmptyState
              title="Nothing asked yet"
              description="Every request is stored as a conversation, and every step it produces is written into the same ledger as your own tasks — so you can check the reasoning afterwards."
              icon={<BrainCircuit size={18} strokeWidth={1.3} />}
            />
          )}
        </div>

        <div className="space-y-6">
          <Panel>
            <PanelHeader label="Provider" title={provider.label} description={provider.note} />
            <Divider className="my-5" />
            <dl className="space-y-3">
              {[
                { label: 'Identifier', value: provider.id },
                { label: 'Model', value: provider.model },
                { label: 'External', value: provider.external ? 'Yes — a third-party endpoint' : 'No — computed locally' },
                { label: 'Daily allowance', value: plan.ai_requests_per_day === 'unlimited' ? 'Unlimited' : `${plan.ai_requests_per_day} requests` },
                { label: 'Used today', value: String(used) },
              ].map((entry) => (
                <div key={entry.label} className="flex items-baseline justify-between gap-4">
                  <dt className="text-[11.5px] uppercase tracking-[0.14em] text-graphite-500">{entry.label}</dt>
                  <dd className="text-right text-[12.5px] text-ivory-100">{entry.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-[11.5px] leading-relaxed text-graphite-500">
              Swapping the provider is one file: <code className="text-graphite-200">src/lib/ai/service.ts</code> resolves it from the environment, and
              no component ever talks to a model directly.
            </p>
          </Panel>

          <Panel>
            <PanelHeader label="Awaiting your word" title="Proposed actions" description="Approving opens a task for the office. It does not contact anyone." />
            <Divider className="my-5" />
            {pending.length ? (
              <ul className="space-y-3">
                {pending.slice(0, 8).map((action) => (
                  <li key={action.id} className="rounded-[4px] border border-ivory-200/[0.08] bg-ink-950/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[12.5px] leading-snug text-ivory-50">{action.label}</p>
                      <Badge tone={toneForStatus(action.status)}>{humanise(action.status, STATUS_LABEL)}</Badge>
                    </div>
                    <p className="mt-2 text-[11.5px] text-graphite-500">
                      {humanise(action.module, STATUS_LABEL)}
                      {action.requiresConfirmation ? ' · action requires confirmation' : ''}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <QuickAction
                        path="/api/ai/action"
                        body={{ aiTaskId: action.id, decision: 'confirm' }}
                        label="Approve"
                        size="sm"
                        variant="gold-outline"
                        successMessage="Approved — the office has the task."
                      />
                      <QuickAction path="/api/ai/action" body={{ aiTaskId: action.id, decision: 'decline' }} label="Decline" size="sm" variant="ghost" successMessage="Declined." />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="Nothing waiting" description="Ask a question and any step needing your consent appears here." />
            )}
          </Panel>

          <Panel>
            <PanelHeader label="History" title="Conversations" />
            <Divider className="my-5" />
            {conversations.length ? (
              <ul className="space-y-1">
                {conversations.slice(0, 8).map((conversation) => (
                  <li key={conversation.id}>
                    <Link
                      href={`/ai?c=${conversation.id}`}
                      className={`group flex items-baseline justify-between gap-3 rounded-[3px] px-2 py-2 transition-colors duration-300 hover:bg-ivory-100/[0.04] ${
                        selected === conversation.id ? 'bg-ivory-100/[0.05]' : ''
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] text-ivory-100">{conversation.title}</span>
                        <span className="mt-0.5 block text-[11px] text-graphite-500">
                          {conversation.messageCount} message{conversation.messageCount === 1 ? '' : 's'} · {relativeTime(conversation.updatedAt)} ·{' '}
                          {conversation.provider}
                        </span>
                      </span>
                      <span className="shrink-0 text-[10.5px] uppercase tracking-[0.16em] text-graphite-600 transition-colors group-hover:text-gold-200">Open</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-graphite-400">
                Nothing asked yet. A conversation is stored so the office can be held to what it said — including what it refused to promise.
              </p>
            )}
          </Panel>

          <Panel>
            <PanelHeader label="Method" title="What the coordinator may not do" />
            <Divider className="my-5" />
            <ul className="space-y-3">
              {[
                'It cannot read another member’s records — context is assembled under your user id.',
                'It will not claim a reservation, a payment or a delivery has happened.',
                'It will not silently change a budget, a staff contract or a document.',
                'Every action it proposes is stored, so you can hold it to the reasoning.',
              ].map((item) => (
                <li key={item} className="flex gap-3 text-[12.5px] leading-relaxed text-graphite-300">
                  <BrainCircuit size={12} strokeWidth={1.4} className="mt-[4px] shrink-0 text-gold-300/70" />
                  {item}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
