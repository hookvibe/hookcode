import { Injectable } from '@nestjs/common';
import { readFile } from 'fs/promises';
import path from 'path';
import { parse } from 'yaml';
import { z } from 'zod';
import type { HookcodeConfig } from '../types/dependency';
import { envKeyRequiresPortPlaceholder, envValueHasFixedPort, envValueHasPortPlaceholder } from '../utils/previewEnv';

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

// Validate preview instance configuration in `.hookcode.yml` and disallow fixed ports. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
const PreviewInstanceSchema = z
  .object({
    name: z.string().min(1).max(64),
    command: z.string().min(1).max(500),
    workdir: z.string().min(1).max(200),
    env: z.record(z.string().min(1).max(80), z.string().max(500)).optional(),
    readyPattern: z.string().max(200).optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    // Enforce PORT placeholders in env values to avoid fixed-port previews. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const entries = Object.entries(value.env ?? {});
    for (const [key, raw] of entries) {
      const envValue = String(raw);
      if (envKeyRequiresPortPlaceholder(key) && !envValueHasPortPlaceholder(envValue)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `preview.instances env "${key}" must use {{PORT}}`
        });
        return;
      }
      if (envValueHasFixedPort(envValue)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `preview.instances env "${key}" must not hardcode ports; use :{{PORT}}`
        });
        return;
      }
    }
  });

// Validate preview config shape and limits. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
const PreviewConfigSchema = z
  .object({
    instances: z.array(PreviewInstanceSchema).min(1).max(5)
  })
  .superRefine((value, ctx) => {
    // Enforce unique preview instance names to keep proxy routing deterministic. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const seen = new Set<string>();
    for (const instance of value.instances) {
      const key = instance.name.trim();
      if (!key) continue;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `preview.instances name "${key}" must be unique`
        });
        return;
      }
      seen.add(key);
    }
  });

const HookcodeConfigSchema = z.object({
  version: z.literal(1),
  dependency: DependencyConfigSchema.optional(),
  preview: PreviewConfigSchema.optional()
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
