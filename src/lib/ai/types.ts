/**
 * The AI contract. Everything the product knows about "the assistant" lives here.
 *
 * Two guarantees are encoded in the types:
 *  1. an action always declares `requiresConfirmation` — the UI cannot render a
 *     completed external action unless the provider says it is genuinely done
 *     by a system VELORA controls;
 *  2. `external: true` on a provider forces the human-in-the-loop copy, because
 *     nothing outside this database can be verified here.
 */

export type ModuleKey =
  | 'property'
  | 'housekeeping'
  | 'people'
  | 'travel'
  | 'vehicles'
  | 'lifestyle'
  | 'finance'
  | 'documents'
  | 'security'
  | 'intelligence';

export type ActionStatus = 'proposed' | 'confirmed' | 'requires_confirmation' | 'done' | 'declined';

export interface AIAction {
  label: string;
  module: ModuleKey;
  status: ActionStatus;
  /** true → VELORA records an intent; a human or an outside system must execute it */
  requiresConfirmation: boolean;
  detail?: string;
  /** set once the action has produced a real record in this database */
  record?: { kind: 'task' | 'trip' | 'document' | 'reservation' | 'expense'; id: string };
  /** where this came from, so the UI can show a trace */
  evidence?: { label: string; value: string }[];
}

export type AIBlock =
  | { type: 'kv'; label: string; value: string; tone?: 'default' | 'attention' | 'ok' }
  | { type: 'list'; label?: string; items: string[] }
  | { type: 'checklist'; label?: string; items: { text: string; done: boolean; pending?: boolean }[] }
  | { type: 'table'; label?: string; columns: string[]; rows: string[][] }
  | { type: 'note'; text: string; tone?: 'default' | 'attention' }
  | { type: 'actions'; label?: string };

export type AIResponseKind =
  | 'arrival_plan'
  | 'journey_plan'
  | 'task_list'
  | 'expense_summary'
  | 'staff_instruction'
  | 'briefing'
  | 'document_search'
  | 'vehicle_status'
  | 'reservation_request'
  | 'clarification'
  | 'unsupported';

export interface AIResult {
  kind: AIResponseKind;
  /** One sentence, in the voice of a private office. Never marketing copy. */
  headline: string;
  blocks: AIBlock[];
  actions: AIAction[];
  /** Plain-language caveats; e.g. what is still waiting on a human. */
  notes: string[];
  requiresHuman: boolean;
  confidence: number;
  provider: AIProviderInfo;
  /** Suggested follow-ups, shown as chips. */
  suggestions?: string[];
  /** Persisted conversation id once the request is stored. */
  conversationId?: string;
}

export interface AIProviderInfo {
  id: string;
  label: string;
  /** true when a third-party model gateway is in the loop */
  external: boolean;
  model: string;
  note: string;
}

/** What a provider is allowed to see: rows already scoped to the acting user. */
export interface ClientContext {
  userId: string;
  firstName: string;
  timezone: string;
  currency: string;
  generatedAt: string;
  properties: {
    id: string;
    name: string;
    city: string;
    country: string;
    status: string;
    isPrimary: boolean;
    staffOnSite: number;
    nextServiceAt: string | null;
    temperatureC: number | null;
    monthlyOpsCents: number;
  }[];
  staff: { id: string; name: string; role: string; status: string; propertyId: string | null; nextTask: string | null }[];
  openTasks: { id: string; title: string; status: string; propertyId: string | null; dueAt: string | null; priority: string }[];
  trips: { id: string; title: string; originCity: string; destinationCity: string; startsAt: string; status: string; pendingLegs: number }[];
  vehicles: { id: string; name: string; status: string; location: string | null; nextServiceAt: string | null; assignedDriver: string | null }[];
  reservations: { id: string; title: string; vendor: string | null; status: string; startsAt: string | null }[];
  monthTotals: { label: string; cents: number; entries: number }[];
  monthTotalCents: number;
  documents: { id: string; name: string; category: string; status: string; propertyName: string | null }[];
}

export interface AIRequestInput {
  text: string;
  context: ClientContext;
  /** filled in by the service so a provider can label its own output */
  providerInfo?: AIProviderInfo;
  conversationId?: string | null;
  priorMessages?: { role: 'user' | 'assistant'; content: string }[];
  /** true → persist ai_tasks/tasks; false → analysis only (used for previews) */
  persist?: boolean;
}

export interface AIProvider {
  readonly info: AIProviderInfo;
  /** Analyse a request and produce the structured plan. Must never claim an external effect. */
  respond(input: AIRequestInput): Promise<AIResult>;
  /** Optional: a provider that can act (book, buy, send) implements this. None do in this build. */
  execute?(action: AIAction, context: ClientContext): Promise<{ ok: boolean; message: string }>;
}

export const UNSAFE_CLAIM_PATTERNS: readonly RegExp[] = [
  /\b(booked|reserved|paid|purchased|shipped|delivered|confirmed by the (vendor|hotel))\b/i,
  /\breply (received|confirmed)\b/i,
  /\bwe (have )?(sent|confirmed|completed) (the )?(payment|reservation|booking)\b/i,
];

/**
 * Guardrail: strip or downgrade language that would imply an outside action
 * took place. Applied to *every* provider's output, including the demo one.
 */
export function enforceHonesty(text: string): { text: string; softened: boolean } {
  let softened = false;
  let out = text;
  for (const pattern of UNSAFE_CLAIM_PATTERNS) {
    if (pattern.test(out)) {
      softened = true;
      out = out.replace(pattern, 'recorded as requested');
    }
  }
  return { text: out, softened };
}

export function requiresHuman(result: AIResult): boolean {
  return result.actions.some((action) => action.requiresConfirmation || action.status === 'requires_confirmation');
}
