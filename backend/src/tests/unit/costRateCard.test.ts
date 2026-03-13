import { estimateCostMicroUsd, getCheapModelForProvider, getDefaultModelForProvider, resolveCostRateCard } from '../../costGovernance/costRateCard';

describe('costRateCard', () => {
  test('returns provider defaults', () => {
    expect(getDefaultModelForProvider('codex')).toBe('gpt-5.1-codex-max');
    expect(getDefaultModelForProvider('claude_code')).toContain('claude-sonnet');
    expect(getDefaultModelForProvider('gemini_cli')).toBe('gemini-2.5-pro');
  });

  test('returns cheaper downgrade targets', () => {
    expect(getCheapModelForProvider('codex')).toContain('mini');
    expect(getCheapModelForProvider('gemini_cli')).toContain('flash');
  });

  test('uses cheaper rate cards for mini and flash models', () => {
    const codexDefault = resolveCostRateCard('codex', 'gpt-5.1-codex-max');
    const codexMini = resolveCostRateCard('codex', 'gpt-5.1-codex-mini');
    const geminiPro = resolveCostRateCard('gemini_cli', 'gemini-2.5-pro');
    const geminiFlash = resolveCostRateCard('gemini_cli', 'gemini-2.5-flash');

    expect(codexMini.inputMicroUsdPer1kTokens).toBeLessThan(codexDefault.inputMicroUsdPer1kTokens);
    expect(geminiFlash.outputMicroUsdPer1kTokens).toBeLessThan(geminiPro.outputMicroUsdPer1kTokens);
  });

  test('estimates higher cost for premium models', () => {
    const sonnetCost = estimateCostMicroUsd({
      provider: 'claude_code',
      model: 'claude-sonnet-4-5-20250929',
      inputTokens: 2_000,
      outputTokens: 1_000
    });
    const opusCost = estimateCostMicroUsd({
      provider: 'claude_code',
      model: 'claude-opus-4-20250929',
      inputTokens: 2_000,
      outputTokens: 1_000
    });

    expect(opusCost).toBeGreaterThan(sonnetCost);
  });
});
