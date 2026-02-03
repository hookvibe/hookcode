// Extract OpenAPI helper utilities for URL building and schema previews. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import type { OpenApiOperation, OpenApiRequestBody, OpenApiResponse, OpenApiSchema, OpenApiSpec } from './types';

export const buildUrl = (baseUrl: string, path: string) => {
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;
  if (!trimmedBase) return trimmedPath;
  if (trimmedBase.startsWith('http')) {
    return `${trimmedBase}${trimmedPath}`;
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const normalizedBase = trimmedBase.startsWith('/') ? trimmedBase : `/${trimmedBase}`;
  return `${origin}${normalizedBase}${trimmedPath}`;
};

export const findOperation = (spec: OpenApiSpec | null, operationId: string) => {
  if (!spec?.paths) return null;
  for (const path of Object.keys(spec.paths)) {
    const methods = spec.paths[path];
    for (const method of Object.keys(methods)) {
      const op = methods[method] as OpenApiOperation;
      if (op?.operationId === operationId) {
        return { path, method: method.toUpperCase(), operation: op };
      }
    }
  }
  return null;
};

export const formatJson = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
};

export const buildSchemaExample = (schema?: OpenApiSchema): unknown => {
  if (!schema) return undefined;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum?.length) return schema.enum[0];
  if (schema.type === 'object') {
    const result: Record<string, unknown> = {};
    if (schema.properties) {
      for (const key of Object.keys(schema.properties)) {
        result[key] = buildSchemaExample(schema.properties[key]);
      }
    }
    return result;
  }
  if (schema.type === 'array') {
    const item = buildSchemaExample(schema.items);
    return item === undefined ? [] : [item];
  }
  if (schema.type === 'number' || schema.type === 'integer') return 0;
  if (schema.type === 'boolean') return false;
  return '';
};

export const pickJsonSchema = (content?: OpenApiRequestBody['content'] | OpenApiResponse['content']) => {
  if (!content) return undefined;
  if (content['application/json']) return content['application/json'];
  const firstKey = Object.keys(content)[0];
  return firstKey ? content[firstKey] : undefined;
};
