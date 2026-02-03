// Regression test: keep dark mode as a neutral near-black base (avoid drifting back to a navy/blue cast).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const extractDarkThemeBlock = (cssText: string): string => {
  const match = cssText.match(/:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\s*\}/);
  if (!match) return '';
  return match[1] ?? '';
};

describe('styles tokens', () => {
  test('dark theme uses a neutral near-black background', () => {
    // Read tokens module directly after splitting global styles. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203
    const cssText = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');
    const darkBlock = extractDarkThemeBlock(cssText);

    expect(darkBlock).toContain('--bg: #09090b;');
    expect(darkBlock).toContain('--hc-panel-bg: #18181b;');
    expect(darkBlock).toContain('--hc-control-bg: #18181b;');
    expect(darkBlock).toContain('color-scheme: dark;');
    expect(darkBlock).toContain('--hc-scrollbar-track: rgba(244, 244, 245, 0.08);');
    expect(darkBlock).not.toContain('#0b1020');
    expect(darkBlock).not.toContain('#0f172a');
  });
});
