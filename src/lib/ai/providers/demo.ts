/**
 * Provider: the in-house coordinator. No network, no vendor, no tokens.
 * Deterministic on purpose — the same request on the same data always yields
 * the same plan, which is what makes it safe to put in front of a client.
 */
import { coordinate } from '@/lib/ai/analysis';
import type { AIProvider, AIProviderInfo, AIRequestInput, AIResult } from '@/lib/ai/types';

export const DEMO_PROVIDER_INFO: AIProviderInfo = {
  id: 'velora-demo',
  label: 'VELORA AI',
  external: false,
  model: 'velora-coordinator',
  note: 'In-house coordinator. Reads only this household’s records.',
};

export const demoProvider: AIProvider = {
  info: DEMO_PROVIDER_INFO,
  async respond(input: AIRequestInput): Promise<AIResult> {
    const plan = coordinate({ ...input, providerInfo: DEMO_PROVIDER_INFO });
    return plan.result;
  },
};
