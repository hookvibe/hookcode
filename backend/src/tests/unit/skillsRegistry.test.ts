// Unit coverage for skills registry parsing + prompt prefix composition. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225

import path from 'path';
import os from 'os';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import {
  __test__buildSkillPromptPrefix,
  __test__buildSkillKey,
  __test__normalizeSkillTags,
  __test__normalizeSkillSelectionKeys,
  __test__parseSkillFrontmatter,
  __test__resolveSelectionKeys,
  __test__resolveSkillBundleLayout,
  __test__resolveSkillVariantDir
} from '../../modules/skills/skills.service';
import type { SkillSummary } from '../../types/skill';

describe('skills registry helpers', () => {
  test('parses skill frontmatter with prompt text flags', () => {
    const raw = [
      '---',
      'name: Example Skill',
      'description: Example description',
      'version: "1.2.3"',
      'promptEnabled: true',
      'tags: [frontend, preview]',
      'promptText: |',
      '  Always run safety checks.',
      '  Keep logs brief.',
      '---',
      '# Example Skill',
      ''
    ].join('\n');

    const parsed = __test__parseSkillFrontmatter(raw);

    expect(parsed.name).toBe('Example Skill');
    expect(parsed.description).toBe('Example description');
    expect(parsed.version).toBe('1.2.3');
    expect(parsed.promptEnabled).toBe(true);
    expect(parsed.promptText).toContain('Always run safety checks.');
    expect(parsed.tags).toEqual(['frontend', 'preview']);
  });

  test('normalizes skill tags from strings and arrays', () => {
    // Ensure tag normalization supports UI filters and de-duping. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const fromString = __test__normalizeSkillTags('alpha, beta, alpha');
    const fromArray = __test__normalizeSkillTags(['Ops', 'ops', ' UI ']);

    expect(fromString).toEqual(['alpha', 'beta']);
    expect(fromArray).toEqual(['Ops', 'ops', 'UI']);
  });

  test('builds and resolves skill selection keys', () => {
    // Validate skill selection key formats and filtering. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const skills: SkillSummary[] = [
      {
        id: 'builtin-alpha',
        slug: 'builtin-alpha',
        name: 'Alpha',
        description: null,
        version: null,
        source: 'built_in',
        enabled: true,
        promptEnabled: false,
        promptText: null,
        tags: []
      },
      {
        id: 'extra-beta',
        slug: 'extra-beta',
        name: 'Beta',
        description: null,
        version: null,
        source: 'extra',
        enabled: true,
        promptEnabled: false,
        promptText: null,
        tags: []
      }
    ];

    const keyAlpha = __test__buildSkillKey(skills[0]);
    const keyBeta = __test__buildSkillKey(skills[1]);
    const normalized = __test__normalizeSkillSelectionKeys(`${keyAlpha},${keyBeta}`);
    const resolved = __test__resolveSelectionKeys(skills, [...normalized, 'extra:missing']);

    expect(keyAlpha).toBe('built_in:builtin-alpha');
    expect(keyBeta).toBe('extra:extra-beta');
    expect(resolved).toEqual([keyAlpha, keyBeta]);
  });

  test('builds prompt prefixes only from enabled prompt entries', () => {
    const skills: SkillSummary[] = [
      {
        id: 'builtin-a',
        slug: 'builtin-a',
        name: 'Alpha',
        description: null,
        version: null,
        source: 'built_in',
        enabled: true,
        promptEnabled: true,
        promptText: 'Alpha directive',
        tags: []
      },
      {
        id: 'extra-b',
        slug: 'extra-b',
        name: 'Beta',
        description: null,
        version: null,
        source: 'extra',
        enabled: true,
        promptEnabled: true,
        promptText: 'Beta directive',
        tags: []
      },
      {
        id: 'extra-c',
        slug: 'extra-c',
        name: 'Gamma',
        description: null,
        version: null,
        source: 'extra',
        enabled: false,
        promptEnabled: true,
        promptText: 'Disabled directive',
        tags: []
      }
    ];

    const prefix = __test__buildSkillPromptPrefix(skills);

    expect(prefix).toContain('# Skill Directives');
    expect(prefix).toContain('Alpha directive');
    expect(prefix).toContain('Beta directive');
    expect(prefix).not.toContain('Disabled directive');
    expect(prefix.indexOf('Alpha')).toBeLessThan(prefix.indexOf('Beta'));
  });

  test('returns empty prefix when nothing is enabled', () => {
    const prefix = __test__buildSkillPromptPrefix([
      {
        id: 'extra-off',
        slug: 'extra-off',
        name: 'Off',
        description: null,
        version: null,
        source: 'extra',
        enabled: false,
        promptEnabled: true,
        promptText: 'Should not render',
        tags: []
      }
    ]);

    expect(prefix).toBe('');
  });

  test('prefers provider-specific skill folders when present', async () => {
    // Ensure provider overrides are resolved before base skill folders. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hookcode-skill-variant-'));
    try {
      await mkdir(path.join(tempDir, 'demo-skill'), { recursive: true });
      await mkdir(path.join(tempDir, '.codex', 'demo-skill'), { recursive: true });

      const providerPath = await __test__resolveSkillVariantDir({
        rootDir: tempDir,
        skillName: 'demo-skill',
        providerDir: '.codex'
      });
      const fallbackPath = await __test__resolveSkillVariantDir({
        rootDir: tempDir,
        skillName: 'demo-skill',
        providerDir: '.claude'
      });

      expect(providerPath).toBe(path.join(tempDir, '.codex', 'demo-skill'));
      expect(fallbackPath).toBe(path.join(tempDir, 'demo-skill'));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('validates skill bundle layout with base and overrides', async () => {
    // Validate uploaded bundle layouts match the required folder rules. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hookcode-skill-layout-'));
    try {
      await mkdir(path.join(tempDir, 'bundle-skill'), { recursive: true });
      await writeFile(path.join(tempDir, 'bundle-skill', 'SKILL.md'), '---\nname: Bundle Skill\n---\n', 'utf8');
      await mkdir(path.join(tempDir, '.claude', 'bundle-skill'), { recursive: true });

      const layout = await __test__resolveSkillBundleLayout(tempDir);
      expect(layout?.skillName).toBe('bundle-skill');
      expect(layout?.baseDir).toBe(path.join(tempDir, 'bundle-skill'));
      expect(layout?.providerDirs['.claude']).toBe(path.join(tempDir, '.claude', 'bundle-skill'));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
