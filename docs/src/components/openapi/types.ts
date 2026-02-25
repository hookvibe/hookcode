// Split OpenAPI docs types into a dedicated module for reuse. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

export type OpenApiSpec = {
  openapi?: string;
  info?: { title?: string; version?: string; description?: string };
  paths?: Record<string, Record<string, OpenApiOperation>>;
};

export type OpenApiOperation = {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses?: Record<string, OpenApiResponse>;
};

export type OpenApiParameter = {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: OpenApiSchema;
  example?: unknown;
};

export type OpenApiRequestBody = {
  required?: boolean;
  content?: Record<string, { schema?: OpenApiSchema; example?: unknown; examples?: Record<string, any> }>;
};

export type OpenApiResponse = {
  description?: string;
  content?: Record<string, { schema?: OpenApiSchema; example?: unknown; examples?: Record<string, any> }>;
};

export type OpenApiSchema = {
  type?: string;
  format?: string;
  description?: string;
  example?: unknown;
  default?: unknown;
  items?: OpenApiSchema;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  enum?: unknown[];
};

export type OpenApiContextValue = {
  spec: OpenApiSpec | null;
  specUrl: string;
  baseUrl: string;
  token: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  setSpecUrl: (value: string) => void;
  setBaseUrl: (value: string) => void;
  setToken: (value: string) => void;
  reloadSpec: () => void;
};
