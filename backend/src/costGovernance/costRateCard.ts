import type { RoutedProviderKey } from '../providerRouting/providerRouting.types';
import { safeTrim } from './types';

export interface CostRateCardEntry {
  inputMicroUsdPer1kTokens: number;
  outputMicroUsdPer1kTokens: number;
}

const DEFAULT_RATE_CARD: Record<RoutedProviderKey, CostRateCardEntry> = {
  codex: {
    inputMicroUsdPer1kTokens: 1_250,
    outputMicroUsdPer1kTokens: 5_000
  },
  claude_code: {
    inputMicroUsdPer1kTokens: 3_000,
    outputMicroUsdPer1kTokens: 15_000
  },
  gemini_cli: {
    inputMicroUsdPer1kTokens: 1_250,
    outputMicroUsdPer1kTokens: 5_000
  }
};

const CHEAP_RATE_CARD: Record<RoutedProviderKey, CostRateCardEntry> = {
  codex: {
    inputMicroUsdPer1kTokens: 250,
    outputMicroUsdPer1kTokens: 1_000
  },
  claude_code: {
    inputMicroUsdPer1kTokens: 3_000,
    outputMicroUsdPer1kTokens: 15_000
  },
  gemini_cli: {
    inputMicroUsdPer1kTokens: 300,
    outputMicroUsdPer1kTokens: 1_200
  }
};

const PREMIUM_RATE_CARD: Record<RoutedProviderKey, CostRateCardEntry> = {
  codex: {
    inputMicroUsdPer1kTokens: 2_000,
    outputMicroUsdPer1kTokens: 8_000
  },
  claude_code: {
    inputMicroUsdPer1kTokens: 15_000,
    outputMicroUsdPer1kTokens: 75_000
  },
  gemini_cli: {
    inputMicroUsdPer1kTokens: 1_250,
    outputMicroUsdPer1kTokens: 5_000
  }
};

export const getDefaultModelForProvider = (provider: RoutedProviderKey): string => {
  if (provider === 'codex') return 'gpt-5.1-codex-max';
  if (provider === 'claude_code') return 'claude-sonnet-4-5-20250929';
  return 'gemini-2.5-pro';
};

export const getCheapModelForProvider = (provider: RoutedProviderKey): string => {
  if (provider === 'codex') return 'gpt-5.1-codex-mini';
  if (provider === 'claude_code') return 'claude-sonnet-4-5-20250929';
  return 'gemini-2.5-flash';
};

export const resolveCostRateCard = (provider: RoutedProviderKey, model?: string): CostRateCardEntry => {
  const normalizedModel = safeTrim(model).toLowerCase();

  if (!normalizedModel) return DEFAULT_RATE_CARD[provider];

  if (provider === 'codex') {
    if (normalizedModel.includes('mini')) return CHEAP_RATE_CARD.codex;
    if (normalizedModel.includes('max')) return PREMIUM_RATE_CARD.codex;
    return DEFAULT_RATE_CARD.codex;
  }

  if (provider === 'claude_code') {
    if (normalizedModel.includes('opus')) return PREMIUM_RATE_CARD.claude_code;
    return DEFAULT_RATE_CARD.claude_code;
  }

  if (normalizedModel.includes('flash')) return CHEAP_RATE_CARD.gemini_cli;
  if (normalizedModel.includes('pro')) return DEFAULT_RATE_CARD.gemini_cli;
  return DEFAULT_RATE_CARD.gemini_cli;
};

export const estimateCostMicroUsd = (params: {
  provider: RoutedProviderKey;
  model?: string;
  inputTokens: number;
  outputTokens: number;
}): bigint => {
  const inputTokens = Number.isFinite(params.inputTokens) ? Math.max(0, Math.floor(params.inputTokens)) : 0;
  const outputTokens = Number.isFinite(params.outputTokens) ? Math.max(0, Math.floor(params.outputTokens)) : 0;
  const rate = resolveCostRateCard(params.provider, params.model);

  const inputCost = BigInt(Math.round((inputTokens * rate.inputMicroUsdPer1kTokens) / 1_000));
  const outputCost = BigInt(Math.round((outputTokens * rate.outputMicroUsdPer1kTokens) / 1_000));
  return inputCost + outputCost;
};
