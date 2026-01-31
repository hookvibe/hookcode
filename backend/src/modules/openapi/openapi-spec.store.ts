import { Injectable } from '@nestjs/common';
import type { AdminToolsLocale } from '../../adminTools/i18n';

// Store prebuilt OpenAPI specs for docs consumption. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
@Injectable()
export class OpenApiSpecStore {
  private specs: Partial<Record<AdminToolsLocale, unknown>> = {};

  setSpec(locale: AdminToolsLocale, spec: unknown) {
    this.specs[locale] = spec;
  }

  getSpec(locale: AdminToolsLocale) {
    return this.specs[locale] ?? null;
  }
}
