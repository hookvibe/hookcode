// Regression test: keep dark mode as a neutral near-black base (avoid drifting back to a navy/blue cast). docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const extractDarkThemeBlock = (cssText: string): string => {
  const match = cssText.match(/:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\s*\}/);
  if (!match) return '';
  return match[1] ?? '';
};

describe('styles.css theme tokens', () => {
  test('dark theme uses a neutral near-black background', () => {
    const cssText = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const darkBlock = extractDarkThemeBlock(cssText);

    expect(darkBlock).toContain('--bg: #0b0b0c;');
    expect(darkBlock).toContain('--hc-panel-bg: #18181b;');
    expect(darkBlock).toContain('--hc-control-bg: #1a1a1d;');
    expect(darkBlock).toContain('color-scheme: dark;');
    expect(darkBlock).toContain('--hc-scrollbar-track: rgba(244, 244, 245, 0.08);');
    expect(darkBlock).not.toContain('#0b1020');
    expect(darkBlock).not.toContain('#0f172a');
  });
});
