/**
 * Provider: an OpenAI-compatible chat-completions gateway.
 *
 * Contract, deliberately narrow: the model may ONLY return the JSON shape
 * below. It receives a digest of rows already filtered to this client, and its
 * answer is validated against the zod schema; anything that fails validation,
 * or that claims an external effect, is rejected and the deterministic
 * coordinator answers instead. A model never writes to the database directly.
 */
import { z } from 'zod';
import type { AIProvider, AIRequestInput, AIResult } from '@/lib/ai/types';
import { enforceHonesty } from '@/lib/ai/types';
import { env } from '@/lib/config';

const responseSchema = z.object({
  kind: z.enum([
    'arrival_plan',
    'journey_plan',
    'task_list',
    'expense_summary',
    'staff_instruction',
    'briefing',
    'document_search',
    'vehicle_status',
    'reservation_request',
    'clarification',
    'unsupported',
  ]),
  headline: z.string().max(240),
  blocks: z
    .array(
      z.discriminatedUnion('type', [
        z.object({ type: z.literal('kv'), label: z.string().max(40), value: z.string().max(240), tone: z.enum(['default', 'attention', 'ok']).optional() }),
        z.object({ type: z.literal('list'), label: z.string().max(60).optional(), items: z.array(z.string().max(300)).max(12) }),
        z.object({
          type: z.literal('checklist'),
          label: z.string().max(60).optional(),
          items: z.array(z.object({ text: z.string().max(300), done: z.boolean(), pending: z.boolean().optional() })).max(20),
        }),
        z.object({
          type: z.literal('table'),
          label: z.string().max(60).optional(),
          columns: z.array(z.string().max(40)).max(6),
          rows: z.array(z.array(z.string().max(80)).max(6)).max(12),
        }),
        z.object({ type: z.literal('note'), text: z.string().max(400), tone: z.enum(['default', 'attention']).optional() }),
      ]),
    )
    .max(8),
  actions: z
    .array(
      z.object({
        label: z.string().max(160),
        module: z.enum(['property', 'housekeeping', 'people', 'travel', 'vehicles', 'lifestyle', 'finance', 'documents', 'security', 'intelligence']),
        status: z.enum(['proposed', 'confirmed', 'requires_confirmation']),
        detail: z.string().max(400).optional(),
      }),
    )
    .max(12),
  notes: z.array(z.string().max(300)).max(6),
  suggestions: z.array(z.string().max(120)).max(4).optional(),
});

export const SYSTEM_PROMPT = `You are VELORA AI, the coordinator inside a private estate and lifestyle office for ultra-high-net-worth clients.

Voice: discreet, certain, unhurried. No marketing language, no exclamation marks, no emoji.
Facts: use ONLY the household records provided. Never invent a booking, an invoice, a payment, a price or a person.
External effects: you cannot contact suppliers, book tables, buy anything or move money. When a step needs an outside party or a human, return that action with status "requires_confirmation" and say so plainly.
Confidence: if the request is ambiguous, return kind "clarification" and ask one short question.
Output: ONLY the JSON object described by the schema. No prose before or after, no markdown fences.`;

export class HttpProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HttpProviderError';
  }
}

export const httpProvider: AIProvider = {
  info: {
    id: 'http-gateway',
    label: 'VELORA AI · model gateway',
    external: true,
    model: env.ai.model || 'unconfigured',
    note: 'Third-party model gateway. Responses are schema-validated and every external action still requires a human.',
  },

  async respond(input: AIRequestInput & { contextDigest?: string }): Promise<AIResult> {
    const { url, key, timeoutMs } = env.ai;
    if (!url || !key) throw new HttpProviderError('No AI gateway configured (AI_PROVIDER_URL / AI_API_KEY).');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1500, timeoutMs));
    try {
      const response = await fetch(`${url.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: env.ai.model || undefined,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Household records for this client:\n${input.contextDigest ?? ''}\n\nRequest: ${input.text}` },
          ],
        }),
      });
      if (!response.ok) throw new HttpProviderError(`Gateway responded ${response.status}`);
      const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = payload.choices?.[0]?.message?.content;
      if (!raw) throw new HttpProviderError('Gateway returned an empty completion');
      const parsed = responseSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) throw new HttpProviderError('Gateway output did not match the VELORA action schema');

      const guarded = enforceHonesty(parsed.data.headline);
      return {
        kind: parsed.data.kind,
        headline: guarded.text,
        blocks: parsed.data.blocks,
        actions: parsed.data.actions.map((a) => ({
          label: a.label,
          module: a.module,
          status: a.status,
          requiresConfirmation: a.status === 'requires_confirmation',
          detail: a.detail,
        })),
        notes: parsed.data.notes,
        suggestions: parsed.data.suggestions,
        requiresHuman: parsed.data.actions.some((a) => a.status === 'requires_confirmation') || guarded.softened,
        confidence: 0.8,
        provider: this.info,
      };
    } finally {
      clearTimeout(timer);
    }
  },
};
