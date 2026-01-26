import { Injectable } from '@nestjs/common';
import { readFile } from 'fs/promises';
import path from 'path';
import { parse } from 'yaml';
import { z } from 'zod';
import type { HookcodeConfig } from '../types/dependency';

const RuntimeConfigSchema = z.object({
  language: z.enum(['node', 'python', 'java', 'ruby', 'go']),
  version: z.string().regex(/^\d+(\.\d+)*$/).optional(),
  install: z.string().max(500).optional(),
  workdir: z.string().max(200).optional()
});

const DependencyConfigSchema = z.object({
  failureMode: z.enum(['soft', 'hard']).default('soft'),
  runtimes: z.array(RuntimeConfigSchema).max(5)
});

const HookcodeConfigSchema = z.object({
  version: z.literal(1),
  dependency: DependencyConfigSchema.optional()
});

@Injectable()
export class HookcodeConfigService {
  async parseConfig(workspaceDir: string): Promise<HookcodeConfig | null> {
    // Read and validate `.hookcode.yml` from the repo workspace. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    const configPath = path.join(workspaceDir, '.hookcode.yml');
    let rawText = '';
    try {
      rawText = await readFile(configPath, 'utf8');
    } catch (err: any) {
      if (err?.code === 'ENOENT') return null;
      throw err;
    }

    const parsed = parse(rawText);
    return this.validateConfig(parsed);
  }

  validateConfig(raw: unknown): HookcodeConfig {
    // Enforce schema rules for dependency configuration files. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    const result = HookcodeConfigSchema.safeParse(raw);
    if (!result.success) {
      const message = result.error.errors.map((issue) => issue.message).join('; ');
      throw new Error(`Invalid .hookcode.yml: ${message}`);
    }
    return result.data;
  }
}
