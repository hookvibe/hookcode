import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import os from 'os';
import { existsSync } from 'fs';
import { cp, mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from 'fs/promises';
import path from 'path';
import AdmZip from 'adm-zip';
import tar, { type ReadEntry } from 'tar';
import { parse } from 'yaml';
import { Prisma } from '@prisma/client';
import { db } from '../../db';
import type { SkillListResponse, SkillPatchInput, SkillSelectionKey, SkillSelectionMode, SkillSelectionState, SkillSummary } from '../../types/skill';
import { resolveAgentExampleSkillsRoot } from '../../utils/agentTemplatePaths';
import { encodeNameCursor, type NameCursor } from '../../utils/pagination';

const BUILTIN_SKILLS_ENV_KEY = 'HOOKCODE_SKILLS_BUILTIN_ROOT';
const SKILL_DOC_FILENAME = 'SKILL.md';
// Enumerate provider override directories for skill bundle resolution. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
const SKILL_PROVIDER_DIRS = ['.codex', '.claude', '.gemini'] as const;

type SkillProviderDir = (typeof SKILL_PROVIDER_DIRS)[number];

type SkillBundleLayout = {
  rootDir: string;
  skillName: string;
  baseDir: string;
  providerDirs: Partial<Record<SkillProviderDir, string>>;
};

// Provide structured errors for archive uploads and validation. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
class SkillArchiveError extends Error {
  code: 'unsupported_archive' | 'invalid_bundle' | 'conflict' | 'missing_skill_doc';

  constructor(code: SkillArchiveError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

type SkillFrontmatter = {
  name?: string;
  description?: string;
  version?: string;
  promptText?: string;
  promptEnabled?: boolean;
  tags?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  // Guard YAML parsing output before accessing frontmatter fields. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const resolveBackendRootDir = (): string =>
  // Resolve the backend root for skill bundle storage and built-in roots. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  path.resolve(__dirname, '..', '..', '..');

const resolveBuiltinSkillsRoot = (): string | null => {
  // Allow overrides for built-in skill scanning in tests or custom deployments. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  const override = String(process.env[BUILTIN_SKILLS_ENV_KEY] ?? '').trim();
  if (override) return path.isAbsolute(override) ? override : path.join(process.cwd(), override);
  const backendRoot = resolveBackendRootDir();
  const candidates = [
    path.join(backendRoot, 'skills'),
    path.join(backendRoot, 'src', 'skills'),
    path.join(process.cwd(), 'backend', 'skills'),
    resolveAgentExampleSkillsRoot()
  ].filter(Boolean) as string[];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
};

const resolveExtraSkillsStorageRoot = (): string => {
  // Store uploaded extra skill bundles under a backend-owned storage directory. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  return path.join(resolveBackendRootDir(), 'storage', 'skills');
};

const parseSkillFrontmatter = (contents: string): SkillFrontmatter => {
  // Parse YAML frontmatter for built-in skills while tolerating missing/invalid headers. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  const lines = contents.split(/\r?\n/);
  if (!lines.length || lines[0].trim() !== '---') return {};
  const endIndex = lines.findIndex((line, idx) => idx > 0 && line.trim() === '---');
  if (endIndex === -1) return {};
  const rawFrontmatter = lines.slice(1, endIndex).join('\n');
  try {
    const parsed = parse(rawFrontmatter);
    return isRecord(parsed) ? (parsed as SkillFrontmatter) : {};
  } catch {
    return {};
  }
};

const normalizeText = (value: unknown): string | null => {
  // Normalize frontmatter strings while preserving multi-line prompt text. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeSkillTags = (value: unknown): string[] => {
  // Normalize tags from frontmatter/DB into a de-duped, trimmed array. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  if (!value) return [];
  const rawList = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const normalized = rawList
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
  return Array.from(new Set(normalized));
};

const isDirectory = async (target: string): Promise<boolean> => {
  // Verify a filesystem path is a directory before copying skill assets. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  try {
    const stats = await stat(target);
    return stats.isDirectory();
  } catch {
    return false;
  }
};

const resolveSkillVariantDir = async (params: {
  rootDir: string;
  skillName: string;
  providerDir: SkillProviderDir;
}): Promise<string | null> => {
  // Prefer provider-specific skill overrides and fall back to the base folder. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  const providerCandidate = path.join(params.rootDir, params.providerDir, params.skillName);
  if (await isDirectory(providerCandidate)) return providerCandidate;
  const baseCandidate = path.join(params.rootDir, params.skillName);
  if (await isDirectory(baseCandidate)) return baseCandidate;
  if (path.basename(params.rootDir) === params.skillName && await isDirectory(params.rootDir)) {
    return params.rootDir;
  }
  return null;
};

const resolveSkillBundleLayout = async (rootDir: string): Promise<SkillBundleLayout | null> => {
  // Validate uploaded skill bundles for base + optional provider overrides. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  let dirents: Array<{ name: string; isDirectory: boolean }> = [];
  try {
    dirents = (await readdir(rootDir, { withFileTypes: true })).map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory()
    }));
  } catch {
    return null;
  }

  const directories = dirents.filter((entry) => entry.isDirectory).map((entry) => entry.name);
  const isIgnoredDir = (name: string) => name.startsWith('.') || name === '__MACOSX';
  const baseCandidates = directories.filter((name) => !isIgnoredDir(name));
  if (baseCandidates.length !== 1) return null;
  const skillName = baseCandidates[0];
  const baseDir = path.join(rootDir, skillName);
  if (!(await isDirectory(baseDir))) return null;

  const providerDirs: Partial<Record<SkillProviderDir, string>> = {};
  for (const providerDir of SKILL_PROVIDER_DIRS) {
    const providerRoot = path.join(rootDir, providerDir);
    if (!(await isDirectory(providerRoot))) continue;
    const providerEntries = await readdir(providerRoot, { withFileTypes: true });
    const providerFolders = providerEntries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => name !== '__MACOSX' && !name.startsWith('.'));
    if (providerFolders.some((name) => name !== skillName)) return null;
    const providerSkillDir = path.join(providerRoot, skillName);
    if (!(await isDirectory(providerSkillDir))) return null;
    providerDirs[providerDir] = providerSkillDir;
  }

  return { rootDir, skillName, baseDir, providerDirs };
};

const resolveSkillBundleRoot = async (rootDir: string): Promise<SkillBundleLayout | null> => {
  // Support archive wrappers by checking the extracted root or its single child. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  const direct = await resolveSkillBundleLayout(rootDir);
  if (direct) return direct;
  let dirents: Array<{ name: string; isDirectory: boolean }> = [];
  try {
    dirents = (await readdir(rootDir, { withFileTypes: true })).map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory()
    }));
  } catch {
    return null;
  }
  const directories = dirents.filter((entry) => entry.isDirectory && !entry.name.startsWith('.') && entry.name !== '__MACOSX');
  if (directories.length !== 1) return null;
  const nestedRoot = path.join(rootDir, directories[0].name);
  return resolveSkillBundleLayout(nestedRoot);
};

const isSafeArchiveEntry = (rootDir: string, entryPath: string): boolean => {
  // Prevent zip-slip paths from escaping the extraction root. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  const normalized = entryPath.replace(/\\/g, '/');
  if (normalized.startsWith('/')) return false;
  const resolved = path.resolve(rootDir, normalized);
  return resolved.startsWith(`${rootDir}${path.sep}`);
};

const inferArchiveType = (filename: string): 'zip' | 'tar' | null => {
  // Detect supported archive formats for extra skill uploads. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  const lower = filename.toLowerCase();
  if (lower.endsWith('.zip')) return 'zip';
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz') || lower.endsWith('.tar')) return 'tar';
  return null;
};

const extractZipArchive = async (archivePath: string, outputDir: string): Promise<void> => {
  // Extract zip archives safely into a staging directory. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  const zip = new AdmZip(archivePath);
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const entryName = entry.entryName;
    if (!isSafeArchiveEntry(outputDir, entryName)) {
      throw new SkillArchiveError('invalid_bundle', `Archive entry escapes root: ${entryName}`);
    }
    const destPath = path.resolve(outputDir, entryName);
    await mkdir(path.dirname(destPath), { recursive: true });
    await writeFile(destPath, entry.getData());
  }
};

const extractTarArchive = async (archivePath: string, outputDir: string): Promise<void> => {
  // Extract tar archives safely into a staging directory. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  await tar.x({
    file: archivePath,
    cwd: outputDir,
    strict: true,
    onentry: (entry: ReadEntry) => {
      if (!isSafeArchiveEntry(outputDir, entry.path)) {
        // Abort extraction if the tar entry escapes the output root when supported by the runtime. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
        const abort = (entry as { abort?: () => void }).abort;
        if (abort) abort();
        throw new SkillArchiveError('invalid_bundle', `Archive entry escapes root: ${entry.path}`);
      }
    }
  });
};

const moveDirectory = async (from: string, to: string): Promise<void> => {
  // Move extracted skill bundles into persistent storage with a copy fallback. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  try {
    await rename(from, to);
  } catch {
    await cp(from, to, { recursive: true });
    await rm(from, { recursive: true, force: true });
  }
};

const buildSkillKey = (skill: SkillSummary): SkillSelectionKey =>
  // Build stable selection keys for skill filtering. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  `${skill.source}:${skill.id}`;

const normalizeSkillSelectionKeys = (value: unknown): SkillSelectionKey[] => {
  // Normalize stored skill selections while preserving source:id formatting. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const cleaned = raw
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
  return Array.from(new Set(cleaned));
};

const normalizeOptionalSelection = (value: unknown): SkillSelectionKey[] | null => {
  // Preserve null selections to represent inherited/default skill sets. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  if (value === null || value === undefined) return null;
  return normalizeSkillSelectionKeys(value);
};

const resolveSelectionKeys = (skills: SkillSummary[], selection: SkillSelectionKey[] | null): SkillSelectionKey[] => {
  // Drop unknown skill keys so stored selections stay valid. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  const known = new Set(skills.map((skill) => buildSkillKey(skill)));
  if (!selection) return [];
  return selection.filter((key) => known.has(key));
};

const filterSkillsBySelection = (skills: SkillSummary[], selection: SkillSelectionKey[] | null): SkillSummary[] => {
  // Apply explicit selection keys to the skill catalog. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  if (selection === null) return skills;
  const selected = new Set(selection);
  return skills.filter((skill) => selected.has(buildSkillKey(skill)));
};

const buildSkillPromptPrefix = (skills: SkillSummary[]): string => {
  // Prepend enabled skill prompt text to the main prompt using deterministic ordering. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  const entries = skills
    .filter((skill) => skill.enabled && skill.promptEnabled && typeof skill.promptText === 'string' && skill.promptText.trim())
    .sort((a, b) => {
      if (a.source !== b.source) return a.source === 'built_in' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  if (!entries.length) return '';
  const blocks = entries.map((skill) => `## ${skill.name}\n${String(skill.promptText).trim()}`);
  return ['# Skill Directives', ...blocks, ''].join('\n\n');
};

const clampSkillListLimit = (value: number | undefined, fallback: number): number => {
  // Cap skill pagination page sizes to keep registry loads consistent. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  const num = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
  if (num <= 0) return fallback;
  return Math.min(num, 50);
};

const paginateSkillsByName = (
  skills: SkillSummary[],
  limit: number,
  cursor?: NameCursor | null
): { skills: SkillSummary[]; nextCursor?: string } => {
  // Paginate skill lists with name + id keyset ordering. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  const take = clampSkillListLimit(limit, 24);
  const applyCursor = Boolean(cursor?.name && cursor?.id);
  const filtered = applyCursor
    ? skills.filter((skill) => skill.name > cursor!.name || (skill.name === cursor!.name && skill.id > cursor!.id))
    : skills;
  const page = filtered.slice(0, take);
  const last = page[page.length - 1];
  const nextCursor = last && page.length === take ? encodeNameCursor({ id: last.id, name: last.name }) : undefined;
  return { skills: page, nextCursor };
};

export const __test__parseSkillFrontmatter = parseSkillFrontmatter;
export const __test__buildSkillPromptPrefix = buildSkillPromptPrefix;
export const __test__normalizeSkillTags = normalizeSkillTags;
export const __test__buildSkillKey = buildSkillKey;
export const __test__normalizeSkillSelectionKeys = normalizeSkillSelectionKeys;
export const __test__resolveSelectionKeys = resolveSelectionKeys;
export const __test__resolveSkillVariantDir = resolveSkillVariantDir;
export const __test__resolveSkillBundleLayout = resolveSkillBundleLayout;
export { SkillArchiveError };

@Injectable()
export class SkillsService {
  async listSkills(): Promise<SkillListResponse> {
    // Fetch built-in and extra skills concurrently for the registry response. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const [builtIn, extra] = await Promise.all([this.listBuiltInSkills(), this.listExtraSkills()]);
    return { builtIn, extra };
  }

  async listBuiltInSkillsPage(params: { limit: number; cursor?: NameCursor | null }): Promise<{ skills: SkillSummary[]; nextCursor?: string }> {
    // Paginate built-in skills by name for the registry UI. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
    const skills = await this.listBuiltInSkills();
    return paginateSkillsByName(skills, params.limit, params.cursor);
  }

  async listExtraSkillsPage(params: { limit: number; cursor?: NameCursor | null }): Promise<{ skills: SkillSummary[]; nextCursor?: string }> {
    // Paginate extra skills with name + id keyset ordering for the registry UI. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
    const take = clampSkillListLimit(params.limit, 24);
    const cursor = params.cursor ?? null;
    const cursorName = cursor?.name ?? null;
    const cursorId = cursor?.id ?? null;
    const applyCursor = Boolean(cursorName && cursorId);
    const where: Prisma.ExtraSkillWhereInput = {};
    if (applyCursor) {
      where.OR = [
        { displayName: { gt: cursorName! } },
        { displayName: cursorName!, id: { gt: cursorId! } }
      ];
    }

    const rows = await db.extraSkill.findMany({
      where,
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      take
    });
    // Keep extra-skill pagination results typed to the SkillSummary shape. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
    const skills: SkillSummary[] = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.displayName,
      description: row.description ?? null,
      version: row.version ?? null,
      source: 'extra',
      enabled: row.enabled,
      promptText: row.promptText ?? null,
      promptEnabled: row.promptEnabled,
      tags: normalizeSkillTags(row.tags)
    }));
    const last = skills[skills.length - 1];
    const nextCursor = last && skills.length === take ? encodeNameCursor({ id: last.id, name: last.name }) : undefined;
    return { skills, nextCursor };
  }

  private async listAllSkills(): Promise<SkillSummary[]> {
    // Combine built-in and extra skill lists for selection resolution. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const { builtIn, extra } = await this.listSkills();
    return [...builtIn, ...extra];
  }

  async listBuiltInSkills(): Promise<SkillSummary[]> {
    // Scan bundled skill folders to expose built-in skill metadata. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const root = resolveBuiltinSkillsRoot();
    if (!root) return [];
    let entries: Array<{ name: string; path: string }> = [];
    try {
      const dirents = await readdir(root, { withFileTypes: true });
      entries = dirents
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => ({ name: entry.name, path: path.join(root, entry.name) }));
    } catch {
      return [];
    }

    const results: SkillSummary[] = [];
    for (const entry of entries) {
      const slug = entry.name;
      let raw = '';
      try {
        raw = await readFile(path.join(entry.path, SKILL_DOC_FILENAME), 'utf8');
      } catch {
        raw = '';
        for (const providerDir of SKILL_PROVIDER_DIRS) {
          const providerDoc = path.join(root, providerDir, slug, SKILL_DOC_FILENAME);
          if (!existsSync(providerDoc)) continue;
          try {
            raw = await readFile(providerDoc, 'utf8');
            break;
          } catch {
            raw = '';
          }
        }
      }
      const frontmatter = raw ? parseSkillFrontmatter(raw) : {};
      const name = normalizeText(frontmatter.name) ?? slug;
      const description = normalizeText(frontmatter.description);
      const version = normalizeText(frontmatter.version);
      const promptText = normalizeText(frontmatter.promptText);
      const promptEnabled = typeof frontmatter.promptEnabled === 'boolean' ? frontmatter.promptEnabled : false;
      const tags = normalizeSkillTags(frontmatter.tags);

      results.push({
        id: slug,
        slug,
        name,
        description,
        version,
        source: 'built_in',
        enabled: true,
        promptText,
        promptEnabled,
        tags
      });
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  async listExtraSkills(): Promise<SkillSummary[]> {
    // Load global extra skill metadata from the database. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const rows = await db.extraSkill.findMany({ orderBy: { displayName: 'asc' } });
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.displayName,
      description: row.description ?? null,
      version: row.version ?? null,
      source: 'extra',
      enabled: row.enabled,
      promptText: row.promptText ?? null,
      promptEnabled: row.promptEnabled,
      tags: normalizeSkillTags(row.tags)
    }));
  }

  async updateExtraSkill(id: string, patch: SkillPatchInput): Promise<SkillSummary | null> {
    // Update extra skill toggles (enabled + promptEnabled) in a single request. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const data: { enabled?: boolean; promptEnabled?: boolean; tags?: string[]; updatedAt: Date } = { updatedAt: new Date() };
    if (typeof patch.enabled === 'boolean') data.enabled = patch.enabled;
    if (typeof patch.promptEnabled === 'boolean') data.promptEnabled = patch.promptEnabled;
    // Accept tag updates to support skill classification filters. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    if (patch.tags !== undefined) data.tags = normalizeSkillTags(patch.tags);
    if (data.enabled === undefined && data.promptEnabled === undefined && data.tags === undefined) return null;

    const updated = await db.extraSkill.update({
      where: { id },
      data
    });

    return {
      id: updated.id,
      slug: updated.slug,
      name: updated.displayName,
      description: updated.description ?? null,
      version: updated.version ?? null,
      source: 'extra',
      enabled: updated.enabled,
      promptText: updated.promptText ?? null,
      promptEnabled: updated.promptEnabled,
      tags: normalizeSkillTags(updated.tags)
    };
  }

  async createExtraSkillFromArchive(params: { filename: string; buffer: Buffer }): Promise<SkillSummary> {
    // Parse and persist uploaded extra skills with bundle validation. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const archiveType = inferArchiveType(params.filename);
    if (!archiveType) {
      throw new SkillArchiveError('unsupported_archive', 'Unsupported archive type (zip, tar, tgz).');
    }

    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'hookcode-skill-upload-'));
    const archivePath = path.join(tempRoot, params.filename || 'skill-upload');
    const extractRoot = path.join(tempRoot, 'extract');
    await mkdir(extractRoot, { recursive: true });

    try {
      await writeFile(archivePath, params.buffer);
      if (archiveType === 'zip') {
        await extractZipArchive(archivePath, extractRoot);
      } else {
        await extractTarArchive(archivePath, extractRoot);
      }

      const bundle = await resolveSkillBundleRoot(extractRoot);
      if (!bundle) {
        throw new SkillArchiveError('invalid_bundle', 'Archive does not match the required skill folder structure.');
      }

      const skillSlug = bundle.skillName.trim();
      if (!skillSlug || /[^a-zA-Z0-9._-]/.test(skillSlug)) {
        throw new SkillArchiveError('invalid_bundle', 'Skill folder names may only include letters, numbers, ".", "_" or "-".');
      }

      const skillDocPath = path.join(bundle.baseDir, SKILL_DOC_FILENAME);
      if (!existsSync(skillDocPath)) {
        throw new SkillArchiveError('missing_skill_doc', 'Base skill folder must include SKILL.md.');
      }

      const existing = await db.extraSkill.findUnique({ where: { slug: skillSlug }, select: { id: true } });
      if (existing) {
        throw new SkillArchiveError('conflict', `Skill slug "${skillSlug}" already exists.`);
      }

      const storageRoot = resolveExtraSkillsStorageRoot();
      await mkdir(storageRoot, { recursive: true });
      const storagePath = path.join(storageRoot, skillSlug);
      if (existsSync(storagePath)) {
        throw new SkillArchiveError('conflict', `Storage path already exists for "${skillSlug}".`);
      }

      await moveDirectory(bundle.rootDir, storagePath);

      const skillDoc = await readFile(path.join(storagePath, skillSlug, SKILL_DOC_FILENAME), 'utf8');
      const frontmatter = parseSkillFrontmatter(skillDoc);
      const displayName = normalizeText(frontmatter.name) ?? skillSlug;
      const description = normalizeText(frontmatter.description);
      const version = normalizeText(frontmatter.version);
      const promptText = normalizeText(frontmatter.promptText);
      const promptEnabled = typeof frontmatter.promptEnabled === 'boolean' ? frontmatter.promptEnabled : false;
      const tags = normalizeSkillTags(frontmatter.tags);

      // Normalize stored storage paths for backend-root relative lookup. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
      const relativeStoragePath = path.relative(resolveBackendRootDir(), storagePath);
      const normalizedStoragePath = relativeStoragePath.startsWith('..') ? storagePath : relativeStoragePath;
      // Generate extra-skill IDs in app code for consistency with other UUID usage. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
      const extraSkillId = randomUUID();
      const created = await db.extraSkill.create({
        data: {
          id: extraSkillId,
          slug: skillSlug,
          displayName,
          description,
          version,
          enabled: true,
          promptText,
          promptEnabled,
          tags,
          storagePath: normalizedStoragePath
        }
      });

      return {
        id: created.id,
        slug: created.slug,
        name: created.displayName,
        description: created.description ?? null,
        version: created.version ?? null,
        source: 'extra',
        enabled: created.enabled,
        promptText: created.promptText ?? null,
        promptEnabled: created.promptEnabled,
        tags: normalizeSkillTags(created.tags)
      };
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }

  async buildPromptPrefix(selection: SkillSelectionKey[] | null = null): Promise<string> {
    // Combine built-in and extra skill prompts for prompt injection. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const [builtIn, extra] = await Promise.all([this.listBuiltInSkills(), this.listExtraSkills()]);
    const filtered = filterSkillsBySelection([...builtIn, ...extra], selection);
    return buildSkillPromptPrefix(filtered);
  }

  async resolveRepoSkillSelection(repoId: string): Promise<SkillSelectionState | null> {
    // Resolve repository-level skill defaults for UI and task-group inheritance. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const id = String(repoId ?? '').trim();
    if (!id) return null;
    const repo = await db.repository.findUnique({ where: { id }, select: { skillDefaults: true } });
    if (!repo) return null;
    const skills = await this.listAllSkills();
    const selection = normalizeOptionalSelection(repo.skillDefaults);
    const effective = selection === null ? skills.map(buildSkillKey) : resolveSelectionKeys(skills, selection);
    const mode: SkillSelectionMode = selection === null ? 'all' : 'custom';
    return { selection, effective, mode };
  }

  async updateRepoSkillSelection(repoId: string, selection: SkillSelectionKey[] | null): Promise<SkillSelectionState | null> {
    // Persist repo-level skill defaults and return the resolved selection. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const id = String(repoId ?? '').trim();
    if (!id) return null;
    const skills = await this.listAllSkills();
    const normalized = normalizeOptionalSelection(selection);
    const sanitized = normalized === null ? null : resolveSelectionKeys(skills, normalized);
    try {
      const jsonSelection = sanitized === null ? Prisma.DbNull : sanitized;
      // Persist repo defaults using SQL NULL for inheritance semantics. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
      await db.repository.update({ where: { id }, data: { skillDefaults: jsonSelection } });
    } catch {
      return null;
    }
    return this.resolveRepoSkillSelection(id);
  }

  async resolveTaskGroupSkillSelection(taskGroupId: string): Promise<SkillSelectionState | null> {
    // Resolve task-group skill selections with repo-default inheritance. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const id = String(taskGroupId ?? '').trim();
    if (!id) return null;
    const group = await db.taskGroup.findUnique({ where: { id }, select: { skillSelections: true, repoId: true } });
    if (!group) return null;
    const skills = await this.listAllSkills();
    const selection = normalizeOptionalSelection(group.skillSelections);
    if (selection !== null) {
      return { selection, effective: resolveSelectionKeys(skills, selection), mode: 'custom' };
    }
    let repoDefaults: SkillSelectionKey[] | null = null;
    if (group.repoId) {
      const repo = await db.repository.findUnique({ where: { id: group.repoId }, select: { skillDefaults: true } });
      repoDefaults = normalizeOptionalSelection(repo?.skillDefaults ?? null);
    }
    if (repoDefaults !== null) {
      return { selection: null, effective: resolveSelectionKeys(skills, repoDefaults), mode: 'repo_default' };
    }
    return { selection: null, effective: skills.map(buildSkillKey), mode: 'all' };
  }

  async updateTaskGroupSkillSelection(
    taskGroupId: string,
    selection: SkillSelectionKey[] | null
  ): Promise<SkillSelectionState | null> {
    // Persist task-group skill selections for conversation-level overrides. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const id = String(taskGroupId ?? '').trim();
    if (!id) return null;
    const skills = await this.listAllSkills();
    const normalized = normalizeOptionalSelection(selection);
    const sanitized = normalized === null ? null : resolveSelectionKeys(skills, normalized);
    try {
      const jsonSelection = sanitized === null ? Prisma.DbNull : sanitized;
      // Persist task-group overrides using SQL NULL for inheritance semantics. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
      await db.taskGroup.update({ where: { id }, data: { skillSelections: jsonSelection } });
    } catch {
      return null;
    }
    return this.resolveTaskGroupSkillSelection(id);
  }

  async syncBuiltInSkillsToTaskGroup(taskGroupDir: string): Promise<void> {
    // Copy built-in skill bundles into task-group workspaces with provider overrides. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const root = resolveBuiltinSkillsRoot();
    if (!root) return;
    let entries: string[] = [];
    try {
      const dirents = await readdir(root, { withFileTypes: true });
      entries = dirents.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map((entry) => entry.name);
    } catch {
      return;
    }

    for (const skillName of entries) {
      for (const providerDir of SKILL_PROVIDER_DIRS) {
        const sourceDir = await resolveSkillVariantDir({ rootDir: root, skillName, providerDir });
        if (!sourceDir) continue;
        const destRoot = path.join(taskGroupDir, providerDir, 'skills', skillName);
        if (existsSync(destRoot)) continue;
        await mkdir(path.dirname(destRoot), { recursive: true });
        await cp(sourceDir, destRoot, { recursive: true });
      }
    }
  }

  async syncExtraSkillsToTaskGroup(taskGroupDir: string, selection: SkillSelectionKey[] | null = null): Promise<void> {
    // Copy enabled extra skill bundles into task-group workspaces, filtered by selection. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const rows = await db.extraSkill.findMany({ where: { enabled: true } });
    if (!rows.length) return;
    const selectedKeys = selection === null ? null : new Set(selection);
    const selectedRows = selectedKeys ? rows.filter((row) => selectedKeys.has(`extra:${row.id}`)) : rows;
    const selectedSlugs = new Set(selectedRows.map((row) => row.slug));
    const allExtraSlugs = new Set(rows.map((row) => row.slug));

    for (const row of selectedRows) {
      const storagePath = this.resolveSkillStoragePath(row.storagePath);
      if (!storagePath || !existsSync(storagePath)) continue;
      if (!(await isDirectory(storagePath))) continue;

      for (const providerDir of SKILL_PROVIDER_DIRS) {
        const sourceDir = await resolveSkillVariantDir({ rootDir: storagePath, skillName: row.slug, providerDir });
        if (!sourceDir) continue;
        const destRoot = path.join(taskGroupDir, providerDir, 'skills', row.slug);
        if (existsSync(destRoot)) continue;
        await mkdir(path.dirname(destRoot), { recursive: true });
        await cp(sourceDir, destRoot, { recursive: true });
      }
    }

    // Remove extra skill folders that are no longer selected. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    for (const root of SKILL_PROVIDER_DIRS) {
      const skillsRoot = path.join(taskGroupDir, root, 'skills');
      let entries: string[] = [];
      try {
        const dirents = await readdir(skillsRoot, { withFileTypes: true });
        entries = dirents.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
      } catch {
        entries = [];
      }
      for (const entry of entries) {
        if (!allExtraSlugs.has(entry)) continue;
        if (selectedSlugs.has(entry)) continue;
        await rm(path.join(skillsRoot, entry), { recursive: true, force: true });
      }
    }
  }

  private resolveSkillStoragePath(raw: string): string | null {
    // Normalize extra skill storage paths to absolute filesystem locations. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return null;
    if (path.isAbsolute(trimmed)) return trimmed;
    const backendRoot = resolveBackendRootDir();
    const candidate = path.join(backendRoot, trimmed);
    if (existsSync(candidate)) return candidate;
    return path.join(process.cwd(), trimmed);
  }
}
